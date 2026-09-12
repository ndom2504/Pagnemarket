"""Admin dashboard API — seeded from ADMIN_EMAIL / ADMIN_PASSWORD."""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import current_admin, db, user_public_safe

logger = logging.getLogger("pagnemarket.admin")
router = APIRouter(prefix="/admin")


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def ensure_admin_user():
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().strip('"').strip("'").lower()
    password = (os.environ.get("ADMIN_PASSWORD") or "").strip().strip('"').strip("'")
    if not email or not password:
        # Fallback: reload frontend .env with override so local ops works
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
        # Keep password in sync with .env for ops convenience
        patch["passwordHash"] = _hash(password)
        patch["updatedAt"] = datetime.now(timezone.utc)
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
        "createdAt": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    logger.info("Compte admin créé: %s", email)
    return uid


@router.get("/stats")
async def admin_stats(_admin: dict = Depends(current_admin)):
    users = await db.users.find({}, {"_id": 0, "roles": 1}).to_list(5000)
    role_counts = {"buyer": 0, "supplier": 0, "tailor": 0, "admin": 0}
    for u in users:
        for r in u.get("roles") or ["buyer"]:
            if r in role_counts:
                role_counts[r] += 1
    products = await db.products.count_documents({})
    orders = await db.orders.find({"paymentStatus": "paid"}, {"_id": 0, "total": 1}).to_list(5000)
    revenue = sum(float(o.get("total") or 0) for o in orders)
    convs = await db.conversations.count_documents({})
    return {
        "usersTotal": len(users),
        "roles": role_counts,
        "products": products,
        "ordersPaid": len(orders),
        "revenue": revenue,
        "conversations": convs,
    }


@router.get("/users")
async def admin_users(role: Optional[str] = None, _admin: dict = Depends(current_admin)):
    query = {}
    if role and role != "all":
        query["roles"] = role
    users = await db.users.find(query, {"_id": 0, "passwordHash": 0}).sort("createdAt", -1).to_list(500)
    return [user_public_safe(u) for u in users]


@router.get("/products")
async def admin_products(_admin: dict = Depends(current_admin)):
    return await db.products.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)


@router.get("/orders")
async def admin_orders(_admin: dict = Depends(current_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)


@router.get("/payments")
async def admin_payments(_admin: dict = Depends(current_admin)):
    items = await db.payments.find({}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    # Attach order totals / city when present
    out = []
    for p in items:
        order = await db.orders.find_one({"id": p.get("orderId")}, {"_id": 0, "total": 1, "city": 1, "customerName": 1, "status": 1})
        row = dict(p)
        row["order"] = order
        out.append(row)
    return out


@router.get("/conversations")
async def admin_conversations(_admin: dict = Depends(current_admin)):
    return await db.conversations.find({}, {"_id": 0}).sort("updatedAt", -1).to_list(200)


class RoleIn(BaseModel):
    roles: list[str]


@router.patch("/users/{uid}/roles")
async def set_user_roles(uid: str, body: RoleIn, _admin: dict = Depends(current_admin)):
    allowed = {"buyer", "supplier", "tailor", "admin"}
    roles = [r for r in body.roles if r in allowed]
    if not roles:
        raise HTTPException(400, "Indiquez au moins un rôle valide")
    res = await db.users.update_one({"id": uid}, {"$set": {"roles": roles, "updatedAt": datetime.now(timezone.utc)}})
    if res.matched_count == 0:
        raise HTTPException(404, "Utilisateur introuvable")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "passwordHash": 0})
    return user_public_safe(user or {})
