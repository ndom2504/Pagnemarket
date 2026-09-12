"""Supplier (fournisseur) dashboard: stats, products CRUD, orders management."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import LOW_STOCK_THRESHOLD, current_supplier, db, push_order_status

router = APIRouter()

IN_PROGRESS = ["confirmed", "processing", "shipped"]
StatusT = Literal["confirmed", "processing", "shipped", "delivered", "cancelled"]


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=5, max_length=2000)
    category: str
    price: float = Field(gt=0)
    promoPrice: Optional[float] = Field(default=None, gt=0)
    stock: int = Field(ge=0, default=10)
    images: List[str] = Field(min_length=1)
    tags: List[str] = []
    location: Optional[str] = None


class StatusIn(BaseModel):
    status: StatusT


def supplier_lines(order: dict, sid: str) -> list:
    return [i for i in order.get("items", []) if i.get("supplierId") == sid]


def supplier_view(order: dict, sid: str) -> dict:
    lines = supplier_lines(order, sid)
    return {
        "id": order["id"],
        "customerName": order.get("customerName") or "Client",
        "city": order.get("city"),
        "phone": order.get("phone"),
        "address": order.get("address"),
        "status": order.get("status"),
        "paymentStatus": order.get("paymentStatus"),
        "paymentMethod": order.get("paymentMethod"),
        "createdAt": order.get("createdAt"),
        "items": lines,
        "total": sum(l["price"] * l["quantity"] for l in lines),
        "currency": order.get("currency", "XAF"),
    }


@router.get("/supplier/stats")
async def supplier_stats(user: dict = Depends(current_supplier)):
    sid = user["id"]
    now = datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = start_today - timedelta(days=6)

    orders = await db.orders.find(
        {"supplierIds": sid, "paymentStatus": "paid"}, {"_id": 0}
    ).sort("createdAt", -1).to_list(2000)

    revenue_total = 0.0
    revenue_today = 0.0
    orders_today = 0
    in_progress = 0
    per_day = {(start_week + timedelta(days=i)).date().isoformat(): 0.0 for i in range(7)}
    product_sales: dict = {}

    for o in orders:
        created = o["createdAt"]
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        lines = supplier_lines(o, sid)
        amount = sum(l["price"] * l["quantity"] for l in lines)
        revenue_total += amount
        if o.get("status") in IN_PROGRESS:
            in_progress += 1
        if created >= start_today:
            revenue_today += amount
            orders_today += 1
        key = created.date().isoformat()
        if key in per_day:
            per_day[key] += amount
        for l in lines:
            entry = product_sales.setdefault(l["productId"], {"productId": l["productId"], "name": l["name"], "image": l.get("image"), "quantity": 0, "revenue": 0.0})
            entry["quantity"] += l["quantity"]
            entry["revenue"] += l["price"] * l["quantity"]

    top = sorted(product_sales.values(), key=lambda x: x["quantity"], reverse=True)[:5]
    products_count = await db.products.count_documents({"supplierId": sid})
    low_stock = await db.products.count_documents({"supplierId": sid, "stock": {"$lt": LOW_STOCK_THRESHOLD}})

    return {
        "revenueToday": revenue_today,
        "ordersToday": orders_today,
        "revenueTotal": revenue_total,
        "ordersTotal": len(orders),
        "ordersInProgress": in_progress,
        "productsCount": products_count,
        "lowStockCount": low_stock,
        "grossRevenue": revenue_total,
        "commissionRate": 0.10,
        "platformCommission": round(revenue_total * 0.10, 2),
        "netRevenue": round(revenue_total * 0.90, 2),
        "payoutStatus": "manual",
        "payoutNote": "Versements manuels — Stripe Connect non activé",
        "last7Days": [{"date": d, "revenue": v} for d, v in per_day.items()],
        "topProducts": top,
        "recentOrders": [supplier_view(o, sid) for o in orders[:5]],
        "currency": "XAF",
    }


@router.get("/supplier/alerts")
async def supplier_alerts(user: dict = Depends(current_supplier)):
    """In-app alerts: fabrics whose stock dropped under the threshold (out of stock first)."""
    products = await db.products.find(
        {"supplierId": user["id"], "stock": {"$lt": LOW_STOCK_THRESHOLD}},
        {"_id": 0, "id": 1, "name": 1, "images": 1, "stock": 1, "category": 1},
    ).sort("stock", 1).to_list(200)
    return {
        "threshold": LOW_STOCK_THRESHOLD,
        "count": len(products),
        "items": [
            {
                "productId": p["id"],
                "name": p["name"],
                "image": (p.get("images") or [None])[0],
                "stock": p["stock"],
                "level": "out" if p["stock"] <= 0 else "low",
                "message": "Rupture de stock" if p["stock"] <= 0 else f"Plus que {p['stock']} pièce{'s' if p['stock'] > 1 else ''}",
            }
            for p in products
        ],
    }


@router.get("/supplier/products")
async def supplier_products(user: dict = Depends(current_supplier)):
    return await db.products.find({"supplierId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(500)


@router.post("/supplier/products")
async def create_product(body: ProductIn, user: dict = Depends(current_supplier)):
    if body.promoPrice and body.promoPrice >= body.price:
        raise HTTPException(400, "Le prix promo doit être inférieur au prix")
    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "currency": "XAF",
        "supplierId": user["id"],
        "supplierName": user.get("shopName") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "country": user.get("country"),
        "city": user.get("city"),
        "location": body.location or ", ".join([x for x in [user.get("city"), user.get("country")] if x]) or "Afrique",
        "rating": 0.0,
        "reviewsCount": 0,
        "tags": body.tags or [body.category],
        "createdAt": datetime.now(timezone.utc),
    }
    await db.products.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.put("/supplier/products/{pid}")
async def update_product(pid: str, body: ProductIn, user: dict = Depends(current_supplier)):
    if body.promoPrice and body.promoPrice >= body.price:
        raise HTTPException(400, "Le prix promo doit être inférieur au prix")
    res = await db.products.update_one(
        {"id": pid, "supplierId": user["id"]},
        {"$set": {**body.model_dump(), "updatedAt": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Produit introuvable")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/supplier/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(current_supplier)):
    res = await db.products.delete_one({"id": pid, "supplierId": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Produit introuvable")
    return {"ok": True}


@router.get("/supplier/orders")
async def supplier_orders(user: dict = Depends(current_supplier)):
    orders = await db.orders.find(
        {"supplierIds": user["id"], "paymentStatus": "paid"}, {"_id": 0}
    ).sort("createdAt", -1).to_list(500)
    return [supplier_view(o, user["id"]) for o in orders]


@router.patch("/supplier/orders/{oid}/status")
async def update_order_status(oid: str, body: StatusIn, user: dict = Depends(current_supplier)):
    res = await push_order_status({"id": oid, "supplierIds": user["id"]}, body.status)
    if res.matched_count == 0:
        raise HTTPException(404, "Commande introuvable")
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    return supplier_view(o, user["id"])
