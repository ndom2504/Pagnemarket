"""Sign in with Apple: verify identityToken → JWT session."""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from deps import create_token, db, ensure_creator_profile

logger = logging.getLogger("pagnemarket.apple_auth")
router = APIRouter()

RoleT = Literal["buyer", "supplier", "tailor"]
APPLE_ISS = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
_jwks_client: Optional[PyJWKClient] = None


class AppleAuthIn(BaseModel):
    identityToken: str = Field(min_length=20)
    role: RoleT = "buyer"
    city: Optional[str] = None
    country: Optional[str] = None
    shopName: Optional[str] = None
    specialty: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None


def _apple_audiences() -> list[str]:
    ids: list[str] = []
    raw = (os.environ.get("APPLE_CLIENT_IDS") or "").strip()
    if raw:
        ids.extend([x.strip() for x in raw.split(",") if x.strip()])
    for key in (
        "APPLE_CLIENT_ID",
        "EXPO_PUBLIC_APPLE_CLIENT_ID",
        "IOS_BUNDLE_IDENTIFIER",
    ):
        v = (os.environ.get(key) or "").strip()
        if v and v not in ids:
            ids.append(v)
    # Native iOS audience = bundle ID
    default_bundle = "com.emergent.tissuehub.gpxlrs"
    if default_bundle not in ids:
        ids.append(default_bundle)
    return ids


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True)
    return _jwks_client


def verify_apple_identity_token(token: str) -> dict:
    audiences = _apple_audiences()
    try:
        signing_key = _jwks().get_signing_key_from_jwt(token)
    except Exception as e:  # noqa: BLE001
        logger.warning("Apple JWKS lookup failed: %s", e)
        raise HTTPException(401, "Jeton Apple invalide") from e

    last_err: Optional[Exception] = None
    for aud in audiences:
        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=aud,
                issuer=APPLE_ISS,
            )
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    logger.warning("Apple token verify failed: %s", last_err)
    raise HTTPException(401, "Jeton Apple invalide ou expiré")


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "firstName": u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "email": u.get("email") or "",
        "phone": u.get("phone"),
        "country": u.get("country"),
        "city": u.get("city"),
        "roles": u.get("roles", ["buyer"]),
        "avatar": u.get("avatar") or u.get("avatarUrl"),
        "avatarUrl": u.get("avatar") or u.get("avatarUrl"),
        "shopName": u.get("shopName"),
        "specialty": u.get("specialty"),
        "createdAt": u.get("createdAt", datetime.now(timezone.utc)),
    }


def _dummy_password_hash() -> str:
    return bcrypt.hashpw(uuid.uuid4().hex.encode(), bcrypt.gensalt()).decode()


@router.post("/auth/apple")
async def auth_apple(body: AppleAuthIn):
    info = verify_apple_identity_token(body.identityToken)
    sub = str(info.get("sub") or "").strip()
    if not sub:
        raise HTTPException(400, "Compte Apple invalide")

    email = (info.get("email") or body.email or "").strip().lower() or None
    given = (body.firstName or "").strip()
    family = (body.lastName or "").strip()

    user = await db.users.find_one({"appleId": sub}, {"_id": 0})
    if not user and email:
        user = await db.users.find_one({"email": email}, {"_id": 0})

    if user:
        patch = {
            "appleId": sub,
            "emailVerified": True,
            "updatedAt": datetime.now(timezone.utc),
        }
        providers = list(user.get("authProviders") or [])
        if "apple" not in providers:
            providers.append("apple")
            patch["authProviders"] = providers
        if email and not user.get("email"):
            patch["email"] = email
        if given and not user.get("firstName"):
            patch["firstName"] = given
        if family and not user.get("lastName"):
            patch["lastName"] = family
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
        user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        return {"token": create_token(user["id"]), "user": user_public(user)}

    if not email:
        # Hide My Email / subsequent sign-in without email claim
        email = f"{sub}@privaterelay.appleid.com"

    role = body.role or "buyer"
    if role == "supplier":
        if not (body.city or "").strip() or not (body.country or "").strip():
            raise HTTPException(400, "Indiquez le pays et la ville de votre boutique")
        if not (body.shopName or "").strip():
            raise HTTPException(400, "Indiquez le nom de votre boutique")
    if role == "tailor":
        if not (body.city or "").strip() or not (body.country or "").strip():
            raise HTTPException(400, "Indiquez le pays et la ville de votre atelier")

    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "firstName": given or "Client",
        "lastName": family or "Apple",
        "email": email,
        "phone": None,
        "passwordHash": _dummy_password_hash(),
        "country": (body.country or "").strip() or None,
        "city": (body.city or "").strip() or None,
        "roles": [role],
        "avatar": None,
        "shopName": (body.shopName or "").strip() or None,
        "specialty": (body.specialty or "").strip() or None,
        "appleId": sub,
        "emailVerified": True,
        "authProviders": ["apple"],
        "createdAt": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    if role == "tailor":
        await ensure_creator_profile(user_doc)
    return {"token": create_token(uid), "user": user_public(user_doc)}


@router.get("/auth/apple/config")
async def apple_auth_config():
    return {
        "enabled": True,
        "audiences": _apple_audiences(),
    }
