"""Shared dependencies: database client, JWT auth, current user."""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
# Frontend .env carries shared secrets for local/dev (ADMIN_*, DATABASE_URL, …)
load_dotenv(ROOT_DIR.parent / "frontend" / ".env", override=True)

database_url = (os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or "").strip()
mongo_url = os.environ.get("MONGO_URL", "mock://local")
db_name = os.environ.get("DB_NAME", "pagnemarket")


def _make_db():
    if database_url.startswith("postgres"):
        from pg_store import PgDatabase
        store = PgDatabase(database_url)
        return store, store
    if mongo_url.startswith("mock://"):
        from mongomock_motor import AsyncMongoMockClient
        mongo = AsyncMongoMockClient()
        return mongo, mongo[db_name]
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo = AsyncIOMotorClient(mongo_url)
    return mongo, mongo[db_name]


client, db = _make_db()

JWT_SECRET = os.environ.get("JWT_SECRET", "pagnemarket-secret-key-change-me-2026")
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30

security = HTTPBearer(auto_error=False)


def create_token(uid: str) -> str:
    payload = {"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(cred: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not cred:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def current_supplier(user: dict = Depends(current_user)) -> dict:
    if "supplier" not in user.get("roles", []) and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Accès réservé aux fournisseurs")
    return user


async def current_tailor(user: dict = Depends(current_user)) -> dict:
    if "tailor" not in user.get("roles", []) and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Accès réservé aux tailleurs")
    return user


async def current_admin(user: dict = Depends(current_user)) -> dict:
    if "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administration")
    return user


def user_public_safe(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "firstName": u.get("firstName") or "",
        "lastName": u.get("lastName") or "",
        "email": u.get("email") or "",
        "phone": u.get("phone"),
        "country": u.get("country"),
        "city": u.get("city"),
        "roles": u.get("roles") or ["buyer"],
        "avatar": u.get("avatar") or u.get("avatarUrl"),
        "avatarUrl": u.get("avatar") or u.get("avatarUrl"),
        "shopName": u.get("shopName"),
        "specialty": u.get("specialty"),
        "accountStatus": u.get("accountStatus") or "active",
        "verified": bool(u.get("verified")),
        "createdAt": u.get("createdAt"),
    }


async def ensure_creator_profile(user: dict) -> dict:
    existing = await db.creators.find_one(
        {"$or": [{"userId": user["id"]}, {"id": user["id"]}]},
        {"_id": 0},
    )
    if existing:
        return existing
    name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("shopName") or "Tailleur"
    doc = {
        "id": user["id"],
        "userId": user["id"],
        "name": name,
        "city": user.get("city") or "",
        "country": user.get("country") or "",
        "specialty": user.get("specialty") or user.get("shopName") or "Couture sur mesure",
        "yearsExperience": int(user.get("yearsExperience") or 0),
        "rating": 5.0,
        "modelsCount": 0,
        "ordersCount": 0,
        "bio": user.get("bio") or "",
        "avatar": user.get("avatar"),
        "cover": None,
        "verified": bool(user.get("emailVerified") or user.get("phoneVerified")),
    }
    await db.creators.insert_one(doc)
    return doc


def public_base_url(request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme) or "https"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    if host and "localhost" not in host and "127.0.0.1" not in host:
        if proto == "http" and "vercel.app" in host:
            proto = "https"
        return f"{proto}://{host}"
    env = (os.environ.get("PUBLIC_BASE_URL") or os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") or "").strip()
    if env:
        if not env.startswith("http"):
            env = f"https://{env}"
        return env.rstrip("/")
    return "https://pagnemarket.vercel.app"


LOW_STOCK_THRESHOLD = 3  # alert when stock drops under 3 pieces


def status_entry(status: str) -> dict:
    return {"status": status, "at": datetime.now(timezone.utc)}


async def push_order_status(order_filter: dict, status: str, extra: Optional[dict] = None):
    """Set order status and append to its statusHistory timeline."""
    update = {"$set": {"status": status, "updatedAt": datetime.now(timezone.utc), **(extra or {})},
              "$push": {"statusHistory": status_entry(status)}}
    return await db.orders.update_one(order_filter, update)


async def decrement_stock(items: list):
    for it in items:
        await db.products.update_one({"id": it["productId"]}, {"$inc": {"stock": -int(it.get("quantity", 1))}})
    await db.products.update_many({"stock": {"$lt": 0}}, {"$set": {"stock": 0}})


async def create_inbox_notification(
    user_id: str,
    *,
    kind: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    """Persist an in-app inbox notification (bell + local ringtone poll)."""
    if not user_id:
        return None
    payload = data or {}
    doc = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "kind": kind,
        "title": title,
        "body": body,
        "data": payload,
        "conversationId": payload.get("conversationId"),
        "read": False,
        "createdAt": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(doc.copy())
    return doc


async def notify_suppliers_new_order(order: dict):
    """Alert each supplier when a marketplace order is confirmed/paid."""
    supplier_ids = list(order.get("supplierIds") or [])
    if not supplier_ids:
        for it in order.get("items") or []:
            sid = it.get("supplierId")
            if sid and sid not in supplier_ids:
                supplier_ids.append(sid)
    if not supplier_ids:
        return
    total = float(order.get("total") or 0)
    currency = order.get("currency") or "XAF"
    buyer = (
        order.get("customerName")
        or order.get("buyerName")
        or (order.get("address") if isinstance(order.get("address"), str) else None)
        or "Client"
    )
    if isinstance(order.get("address"), dict) and order["address"].get("name"):
        buyer = order["address"]["name"]
    n_items = sum(int(i.get("quantity") or 1) for i in (order.get("items") or []))
    body = f"{buyer} · {n_items} article(s) · {int(total)} {currency}"
    for sid in supplier_ids:
        await create_inbox_notification(
            sid,
            kind="order",
            title="Nouvelle commande reçue",
            body=body[:160],
            data={
                "kind": "order",
                "orderId": order.get("id"),
                "role": "supplier",
                "href": "/supplier",
            },
        )


async def notify_tailor_new_sewing_order(order: dict, *, tailor_id: str):
    """Alert tailor when a sewing / custom order is received."""
    client = order.get("clientName") or "Client"
    title_txt = order.get("title") or "Commande sur-mesure"
    price = float(order.get("price") or 0)
    body = f"{client} · {title_txt}"
    if price > 0:
        body += f" · {int(price)} XAF"
    await create_inbox_notification(
        tailor_id,
        kind="sewing_order",
        title="Nouvelle commande couture",
        body=body[:160],
        data={
            "kind": "sewing_order",
            "sewingOrderId": order.get("id"),
            "role": "tailor",
            "href": "/tailor/orders",
        },
    )
