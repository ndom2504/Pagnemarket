"""Shared dependencies: database client, JWT auth, current user."""
import os
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
