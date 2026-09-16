"""Account deletion, content reports, and user blocking (App Store UGC / Guideline 5.1.1)."""
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import current_user, db

router = APIRouter()

ReportTarget = Literal["user", "product", "creator", "message", "review", "other"]
ReportReason = Literal[
    "spam",
    "harassment",
    "inappropriate",
    "scam",
    "ip",
    "other",
]


class DeleteAccountIn(BaseModel):
    confirm: Literal["DELETE"] = Field(
        description='Must be the string "DELETE" to confirm irreversible deletion'
    )


class ReportIn(BaseModel):
    targetType: ReportTarget
    targetId: str = Field(min_length=1)
    reason: ReportReason = "other"
    details: Optional[str] = Field(default=None, max_length=2000)


class BlockIn(BaseModel):
    userId: str = Field(min_length=1)


def _now():
    return datetime.now(timezone.utc)


async def blocked_ids_for(uid: str) -> set[str]:
    rows = await db.blocks.find(
        {"$or": [{"blockerId": uid}, {"blockedId": uid}]},
        {"_id": 0, "blockerId": 1, "blockedId": 1},
    ).to_list(2000)
    out: set[str] = set()
    for r in rows:
        a, b = r.get("blockerId"), r.get("blockedId")
        if a == uid and b:
            out.add(b)
        elif b == uid and a:
            out.add(a)
    return out


@router.post("/auth/delete-account")
@router.delete("/auth/me")
async def delete_account(body: DeleteAccountIn, user: dict = Depends(current_user)):
    if body.confirm != "DELETE":
        raise HTTPException(400, 'Confirmation requise: confirm="DELETE"')
    uid = user["id"]
    now = _now()
    anon_email = f"deleted_{uid[:8]}@deleted.pagnemarket.local"

    # Anonymize user record (keep id for order integrity)
    await db.users.update_one(
        {"id": uid},
        {
            "$set": {
                "firstName": "Compte",
                "lastName": "supprimé",
                "email": anon_email,
                "phone": None,
                "passwordHash": "",
                "avatar": None,
                "avatarUrl": None,
                "shopName": None,
                "shopCover": None,
                "specialty": None,
                "googleId": None,
                "appleId": None,
                "authProviders": [],
                "status": "deleted",
                "deletedAt": now,
                "updatedAt": now,
            }
        },
    )

    # Soft-hide public creator profile linked to this user
    await db.creators.update_many(
        {"$or": [{"userId": uid}, {"id": uid}]},
        {"$set": {"hidden": True, "name": "Profil supprimé", "avatar": None, "cover": None, "updatedAt": now}},
    )

    # Hide products owned by supplier
    await db.products.update_many(
        {"supplierId": uid},
        {"$set": {"hidden": True, "stock": 0, "updatedAt": now}},
    )

    # Clear favorites / cart / push tokens / blocks involving the user
    await db.favorites.delete_many({"userId": uid})
    await db.carts.delete_many({"userId": uid})
    await db.push_tokens.delete_many({"userId": uid})
    await db.blocks.delete_many({"$or": [{"blockerId": uid}, {"blockedId": uid}]})
    await db.notifications.delete_many({"userId": uid})

    return {
        "ok": True,
        "message": "Compte supprimé. Vos données personnelles ont été anonymisées.",
    }


@router.post("/reports")
async def create_report(body: ReportIn, user: dict = Depends(current_user)):
    if user.get("status") == "deleted":
        raise HTTPException(403, "Compte indisponible")
    tid = body.targetId.strip()
    if not tid:
        raise HTTPException(400, "Cible manquante")
    if body.targetType == "user" and tid == user["id"]:
        raise HTTPException(400, "Vous ne pouvez pas vous signaler vous-même")

    doc = {
        "id": str(uuid.uuid4()),
        "reporterId": user["id"],
        "reporterName": f"{user.get('firstName') or ''} {user.get('lastName') or ''}".strip() or user.get("email"),
        "targetType": body.targetType,
        "targetId": tid,
        "reason": body.reason,
        "details": (body.details or "").strip() or None,
        "status": "open",
        "createdAt": _now(),
    }
    await db.reports.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.post("/blocks")
async def block_user(body: BlockIn, user: dict = Depends(current_user)):
    peer = body.userId.strip()
    if not peer:
        raise HTTPException(400, "Utilisateur manquant")
    if peer == user["id"]:
        raise HTTPException(400, "Vous ne pouvez pas vous bloquer vous-même")
    existing = await db.blocks.find_one({"blockerId": user["id"], "blockedId": peer}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "blockerId": user["id"],
        "blockedId": peer,
        "createdAt": _now(),
    }
    await db.blocks.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("/blocks")
async def list_blocks(user: dict = Depends(current_user)):
    rows = await db.blocks.find({"blockerId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    ids = [r["blockedId"] for r in rows]
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "firstName": 1, "lastName": 1, "shopName": 1, "avatar": 1, "avatarUrl": 1}).to_list(500)
    by_id = {u["id"]: u for u in users}
    out = []
    for r in rows:
        u = by_id.get(r["blockedId"]) or {}
        name = (u.get("shopName") or f"{u.get('firstName') or ''} {u.get('lastName') or ''}".strip() or "Utilisateur")
        out.append({**r, "name": name, "avatar": u.get("avatar") or u.get("avatarUrl")})
    return out


@router.delete("/blocks/{blocked_user_id}")
async def unblock_user(blocked_user_id: str, user: dict = Depends(current_user)):
    res = await db.blocks.delete_one({"blockerId": user["id"], "blockedId": blocked_user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Blocage introuvable")
    return {"ok": True}
