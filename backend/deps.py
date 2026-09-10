"""Shared dependencies: database client, JWT auth, current user."""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR.parent / "frontend" / ".env", override=False)

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


def public_base_url(request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


LOW_STOCK_THRESHOLD = 3  # alert when stock drops under 3 pieces


def status_entry(status: str) -> dict:
    return {"status": status, "at": datetime.now(timezone.utc)}


async def push_order_status(order_filter: dict, status: str, extra: dict | None = None):
    """Set order status and append to its statusHistory timeline."""
    update = {"$set": {"status": status, "updatedAt": datetime.now(timezone.utc), **(extra or {})},
              "$push": {"statusHistory": status_entry(status)}}
    return await db.orders.update_one(order_filter, update)


async def decrement_stock(items: list):
    for it in items:
        await db.products.update_one({"id": it["productId"]}, {"$inc": {"stock": -int(it.get("quantity", 1))}})
    await db.products.update_many({"stock": {"$lt": 0}}, {"$set": {"stock": 0}})
