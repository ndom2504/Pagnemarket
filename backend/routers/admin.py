"""Admin dashboard API — seeded from ADMIN_EMAIL / ADMIN_PASSWORD."""
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import current_admin, db, user_public_safe

logger = logging.getLogger("pagnemarket.admin")
router = APIRouter(prefix="/admin")

COMMISSION_RATE = 0.10  # platform share on paid orders


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _now():
    return datetime.now(timezone.utc)


def _day_start(dt: Optional[datetime] = None) -> datetime:
    d = dt or _now()
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


async def _audit(admin: dict, action: str, *, target: Optional[str] = None, meta: Optional[dict] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "adminId": admin.get("id"),
        "adminEmail": admin.get("email"),
        "action": action,
        "target": target,
        "meta": meta or {},
        "createdAt": _now(),
    }
    await db.audit_logs.insert_one(doc.copy())
    return doc


async def ensure_admin_user():
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().strip('"').strip("'").lower()
    password = (os.environ.get("ADMIN_PASSWORD") or "").strip().strip('"').strip("'")
    if not email or not password:
        from pathlib import Path
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[1].parent / "frontend" / ".env", override=True)
        email = (os.environ.get("ADMIN_EMAIL") or "").strip().strip('"').strip("'").lower()
        password = (os.environ.get("ADMIN_PASSWORD") or "").strip().strip('"').strip("'")
    if not email or not password:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD manquants — pas de compte admin créé")
        return None
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        roles = list(existing.get("roles") or [])
        patch = {}
        if "admin" not in roles:
            patch["roles"] = list({*roles, "admin"})
        patch["passwordHash"] = _hash(password)
        patch["updatedAt"] = _now()
        await db.users.update_one({"id": existing["id"]}, {"$set": patch})
        logger.info("Compte admin à jour: %s", email)
        return existing["id"]
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "firstName": "Admin",
        "lastName": "PagneMarket",
        "email": email,
        "phone": None,
        "passwordHash": _hash(password),
        "country": "Canada",
        "city": None,
        "roles": ["admin"],
        "avatar": None,
        "shopName": None,
        "accountStatus": "active",
        "verified": True,
        "createdAt": _now(),
    }
    await db.users.insert_one(doc)
    logger.info("Compte admin créé: %s", email)
    return uid


def _parse_dt(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            d = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


@router.get("/stats")
async def admin_stats(_admin: dict = Depends(current_admin)):
    users = await db.users.find({}, {"_id": 0, "roles": 1, "accountStatus": 1, "verified": 1}).to_list(5000)
    role_counts = {"buyer": 0, "supplier": 0, "tailor": 0, "admin": 0}
    active_suppliers = 0
    active_tailors = 0
    for u in users:
        roles = u.get("roles") or ["buyer"]
        for r in roles:
            if r in role_counts:
                role_counts[r] += 1
        suspended = (u.get("accountStatus") or "active") == "suspended"
        if not suspended and "supplier" in roles:
            active_suppliers += 1
        if not suspended and "tailor" in roles:
            active_tailors += 1

    products = await db.products.count_documents({})
    pending_products = await db.products.count_documents({"status": "pending"})
    paid_orders = await db.orders.find({"paymentStatus": "paid"}, {"_id": 0, "total": 1, "createdAt": 1}).to_list(5000)
    revenue = sum(float(o.get("total") or 0) for o in paid_orders)
    commissions = round(revenue * COMMISSION_RATE, 0)

    start = _day_start()
    orders_today = 0
    for o in await db.orders.find({}, {"_id": 0, "createdAt": 1}).to_list(5000):
        created = _parse_dt(o.get("createdAt"))
        if created and created >= start:
            orders_today += 1

    pending_orders = await db.orders.count_documents(
        {"$or": [{"status": {"$in": ["pending_payment", "confirmed", "processing"]}}, {"paymentStatus": "pending"}]}
    )
    failed_payments = await db.payments.count_documents({"status": {"$in": ["FAILED", "failed"]}})
    refunds = await db.payments.count_documents({"status": {"$in": ["REFUNDED", "refunded"]}})
    unverified = sum(
        1
        for u in users
        if ("supplier" in (u.get("roles") or []) or "tailor" in (u.get("roles") or []))
        and not u.get("verified")
        and (u.get("accountStatus") or "active") != "suspended"
    )

    return {
        "usersTotal": len(users),
        "roles": role_counts,
        "activeSuppliers": active_suppliers,
        "activeTailors": active_tailors,
        "products": products,
        "pendingProducts": pending_products,
        "ordersPaid": len(paid_orders),
        "ordersToday": orders_today,
        "ordersPending": pending_orders,
        "revenue": revenue,
        "commissions": commissions,
        "commissionRate": COMMISSION_RATE,
        "conversations": await db.conversations.count_documents({}),
        "failedPayments": failed_payments,
        "refunds": refunds,
        "verificationRequests": unverified,
        "currency": "XAF",
    }


@router.get("/overview")
async def admin_overview(_admin: dict = Depends(current_admin)):
    """Central widgets: chart, recent lists, alerts."""
    now = _now()
    days = []
    for i in range(6, -1, -1):
        day = _day_start(now - timedelta(days=i))
        days.append(day)

    paid = await db.orders.find({"paymentStatus": "paid"}, {"_id": 0, "total": 1, "createdAt": 1}).to_list(5000)
    sales_chart = []
    for day in days:
        nxt = day + timedelta(days=1)
        total = 0.0
        count = 0
        for o in paid:
            created = _parse_dt(o.get("createdAt"))
            if created and day <= created < nxt:
                total += float(o.get("total") or 0)
                count += 1
        sales_chart.append({
            "date": day.date().isoformat(),
            "label": day.strftime("%a"),
            "revenue": total,
            "orders": count,
        })

    recent_orders = await db.orders.find({}, {"_id": 0}).sort("createdAt", -1).to_list(8)
    new_users = await db.users.find({}, {"_id": 0, "passwordHash": 0}).sort("createdAt", -1).to_list(8)
    pending_products = await db.products.find({"status": "pending"}, {"_id": 0}).sort("createdAt", -1).to_list(8)
    to_verify = []
    for u in await db.users.find({}, {"_id": 0, "passwordHash": 0}).sort("createdAt", -1).to_list(300):
        roles = u.get("roles") or []
        if ("supplier" in roles or "tailor" in roles) and not u.get("verified"):
            to_verify.append(user_public_safe(u))
        if len(to_verify) >= 8:
            break
    failed_payments = await db.payments.find(
        {"status": {"$in": ["FAILED", "failed"]}}, {"_id": 0}
    ).sort("createdAt", -1).to_list(8)
    reports = await db.reports.find({}, {"_id": 0}).sort("createdAt", -1).to_list(8)
    if not reports:
        reviews = await db.reviews.find({}, {"_id": 0}).sort("createdAt", -1).to_list(8)
        reports = [
            {
                "id": r.get("id"),
                "kind": "review",
                "text": r.get("comment") or r.get("text") or "Avis",
                "rating": r.get("rating"),
                "createdAt": r.get("createdAt"),
            }
            for r in reviews
        ]
    security_alerts = await db.audit_logs.find(
        {"action": {"$in": ["user.suspend", "user.roles", "product.delete", "payment.refund"]}},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(8)

    return {
        "salesChart": sales_chart,
        "recentOrders": recent_orders,
        "newUsers": [user_public_safe(u) for u in new_users],
        "pendingProducts": pending_products,
        "toVerify": to_verify,
        "failedPayments": failed_payments,
        "reports": reports,
        "securityAlerts": security_alerts,
    }


@router.get("/users")
async def admin_users(role: Optional[str] = None, status: Optional[str] = None, _admin: dict = Depends(current_admin)):
    users = await db.users.find({}, {"_id": 0, "passwordHash": 0}).sort("createdAt", -1).to_list(800)
    out = []
    for u in users:
        roles = u.get("roles") or ["buyer"]
        if role and role != "all" and role not in roles:
            continue
        st = u.get("accountStatus") or "active"
        if status and status != "all" and st != status:
            continue
        out.append(user_public_safe({**u, "accountStatus": st, "verified": bool(u.get("verified"))}))
    return out


@router.get("/products")
async def admin_products(status: Optional[str] = None, _admin: dict = Depends(current_admin)):
    query = {}
    if status and status != "all":
        query["status"] = status
    return await db.products.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)


@router.get("/orders")
async def admin_orders(_admin: dict = Depends(current_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)


@router.get("/payments")
async def admin_payments(status: Optional[str] = None, _admin: dict = Depends(current_admin)):
    query = {}
    if status == "failed":
        query["status"] = {"$in": ["FAILED", "failed"]}
    elif status == "refunded":
        query["status"] = {"$in": ["REFUNDED", "refunded"]}
    elif status == "paid":
        query["status"] = {"$in": ["PAID", "SUCCEEDED", "paid"]}
    items = await db.payments.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)
    out = []
    for p in items:
        order = await db.orders.find_one(
            {"id": p.get("orderId")},
            {"_id": 0, "total": 1, "city": 1, "customerName": 1, "status": 1},
        )
        row = dict(p)
        row["order"] = order
        amt = float(p.get("amount") or (order or {}).get("total") or 0)
        if str(p.get("status") or "").upper() in ("PAID", "SUCCEEDED"):
            row["commission"] = round(amt * COMMISSION_RATE, 0)
        out.append(row)
    return out


@router.get("/commissions")
async def admin_commissions(_admin: dict = Depends(current_admin)):
    paid = await db.orders.find({"paymentStatus": "paid"}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    rows = []
    total = 0.0
    for o in paid:
        amt = float(o.get("total") or 0)
        fee = round(amt * COMMISSION_RATE, 0)
        total += fee
        rows.append({
            "orderId": o.get("id"),
            "customerName": o.get("customerName"),
            "total": amt,
            "commission": fee,
            "rate": COMMISSION_RATE,
            "createdAt": o.get("createdAt"),
            "currency": o.get("currency") or "XAF",
        })
    return {"rate": COMMISSION_RATE, "total": total, "currency": "XAF", "items": rows}


@router.get("/conversations")
async def admin_conversations(_admin: dict = Depends(current_admin)):
    return await db.conversations.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(200)


@router.get("/categories")
async def admin_categories(_admin: dict = Depends(current_admin)):
    cats = await db.categories.find({}, {"_id": 0}).to_list(200)
    return cats


@router.get("/audit")
async def admin_audit(_admin: dict = Depends(current_admin)):
    return await db.audit_logs.find({}, {"_id": 0}).sort("createdAt", -1).to_list(200)


@router.get("/settings")
async def admin_settings(_admin: dict = Depends(current_admin)):
    return {
        "commissionRate": COMMISSION_RATE,
        "currency": "XAF",
        "shippingFee": 2500,
        "platform": "PagneMarket",
        "supportEmail": os.environ.get("ADMIN_EMAIL") or "admin@pagnemarket.com",
    }


class RoleIn(BaseModel):
    roles: list[str]


class StatusIn(BaseModel):
    status: Literal["active", "suspended"]
    reason: Optional[str] = None


class VerifyIn(BaseModel):
    verified: bool = True


class ProductStatusIn(BaseModel):
    status: Literal["published", "pending", "rejected"]


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    slug: Optional[str] = None
    group: Optional[str] = "wax"


class NotifyIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=500)
    userId: Optional[str] = None  # all admins broadcast stub if None → all users limited


@router.patch("/users/{uid}/roles")
async def set_user_roles(uid: str, body: RoleIn, admin: dict = Depends(current_admin)):
    allowed = {"buyer", "supplier", "tailor", "admin"}
    roles = [r for r in body.roles if r in allowed]
    if not roles:
        raise HTTPException(400, "Indiquez au moins un rôle valide")
    res = await db.users.update_one({"id": uid}, {"$set": {"roles": roles, "updatedAt": _now()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Utilisateur introuvable")
    await _audit(admin, "user.roles", target=uid, meta={"roles": roles})
    user = await db.users.find_one({"id": uid}, {"_id": 0, "passwordHash": 0})
    return user_public_safe(user or {})


@router.patch("/users/{uid}/status")
async def set_user_status(uid: str, body: StatusIn, admin: dict = Depends(current_admin)):
    if uid == admin.get("id") and body.status == "suspended":
        raise HTTPException(400, "Vous ne pouvez pas suspendre votre propre compte")
    res = await db.users.update_one(
        {"id": uid},
        {"$set": {"accountStatus": body.status, "suspendReason": body.reason, "updatedAt": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Utilisateur introuvable")
    await _audit(admin, "user.suspend" if body.status == "suspended" else "user.activate", target=uid, meta={"reason": body.reason})
    user = await db.users.find_one({"id": uid}, {"_id": 0, "passwordHash": 0})
    return user_public_safe(user or {})


@router.patch("/users/{uid}/verify")
async def verify_user(uid: str, body: VerifyIn, admin: dict = Depends(current_admin)):
    res = await db.users.update_one({"id": uid}, {"$set": {"verified": body.verified, "updatedAt": _now()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Utilisateur introuvable")
    # Sync creator verified for tailors
    await db.creators.update_one(
        {"$or": [{"userId": uid}, {"id": uid}]},
        {"$set": {"verified": body.verified}},
    )
    await _audit(admin, "user.verify", target=uid, meta={"verified": body.verified})
    user = await db.users.find_one({"id": uid}, {"_id": 0, "passwordHash": 0})
    return user_public_safe(user or {})


@router.patch("/products/{pid}/status")
async def set_product_status(pid: str, body: ProductStatusIn, admin: dict = Depends(current_admin)):
    res = await db.products.update_one({"id": pid}, {"$set": {"status": body.status, "updatedAt": _now()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Produit introuvable")
    await _audit(admin, "product.status", target=pid, meta={"status": body.status})
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(current_admin)):
    slug = (body.slug or body.name).strip().lower().replace(" ", "-")
    existing = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Catégorie déjà existante")
    doc = {
        "id": slug,
        "slug": slug,
        "name": body.name.strip(),
        "group": body.group or "wax",
        "image": f"/images/categories/{slug}.png",
        "createdAt": _now(),
    }
    await db.categories.insert_one(doc.copy())
    await _audit(admin, "category.create", target=slug, meta={"name": doc["name"]})
    doc.pop("_id", None)
    return doc


@router.patch("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, admin: dict = Depends(current_admin)):
    patch = {"name": body.name.strip(), "updatedAt": _now()}
    if body.group:
        patch["group"] = body.group
    res = await db.categories.update_one({"$or": [{"id": cid}, {"slug": cid}]}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(404, "Catégorie introuvable")
    await _audit(admin, "category.update", target=cid, meta=patch)
    return await db.categories.find_one({"$or": [{"id": cid}, {"slug": cid}]}, {"_id": 0})


@router.post("/notify")
async def admin_notify(body: NotifyIn, admin: dict = Depends(current_admin)):
    from deps import create_inbox_notification

    targets = []
    if body.userId:
        targets = [body.userId]
    else:
        users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(200)
        targets = [u["id"] for u in users if u.get("id")]
    for tid in targets[:200]:
        await create_inbox_notification(
            tid,
            kind="admin",
            title=body.title,
            body=body.body,
            data={"kind": "admin", "href": "/notifications"},
        )
    await _audit(admin, "notify.send", meta={"title": body.title, "count": len(targets[:200])})
    return {"ok": True, "sent": len(targets[:200])}
