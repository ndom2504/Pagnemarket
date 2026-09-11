"""Twilio Verify OTP: send SMS code, then login or create the account."""
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import bcrypt
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from countries import dial_for_iso
from deps import create_token, db


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
        "avatar": u.get("avatar"),
        "shopName": u.get("shopName"),
        "createdAt": u.get("createdAt", datetime.now(timezone.utc)),
    }

logger = logging.getLogger("pagnemarket.otp")
router = APIRouter()

RoleT = Literal["buyer", "supplier"]


class OtpSendIn(BaseModel):
    phone: str = Field(min_length=6, max_length=24)
    countryIso: Optional[str] = None


class OtpVerifyIn(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=10)
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = "Gabon"
    countryIso: Optional[str] = None
    role: RoleT = "buyer"
    shopName: Optional[str] = None


def normalize_phone(raw: str, country_iso: Optional[str] = None) -> str:
    s = re.sub(r"[^\d+]", "", raw or "")
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        return s
    digits = re.sub(r"\D", "", s)
    if digits.startswith("0"):
        digits = digits[1:]
    return f"{dial_for_iso(country_iso)}{digits}"


def _twilio_creds():
    sid = (os.environ.get("TWILIO_ACCOUNT_SID") or "").strip()
    token = (os.environ.get("TWILIO_AUTH_TOKEN") or "").strip()
    service = (os.environ.get("TWILIO_VERIFY_SERVICE_SID") or "").strip()
    if not (sid and token and service):
        raise HTTPException(500, "Twilio Verify n'est pas configuré")
    return sid, token, service


async def _find_by_phone(phone: str):
    return await db.users.find_one({"phone": phone}, {"_id": 0})


@router.post("/auth/otp/send")
async def otp_send(body: OtpSendIn):
    phone = normalize_phone(body.phone, body.countryIso)
    sid, token, service = _twilio_creds()
    url = f"https://verify.twilio.com/v2/Services/{service}/Verifications"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(url, auth=(sid, token), data={"To": phone, "Channel": "sms"})
    if r.status_code >= 400:
        logger.warning("Twilio send failed %s %s", r.status_code, r.text[:300])
        detail = "Impossible d'envoyer le SMS. Vérifiez le numéro et l'indicatif du pays."
        try:
            msg = (r.json() or {}).get("message")
            if msg:
                detail = msg
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(400, detail)
    return {"ok": True, "phone": phone, "status": (r.json() or {}).get("status", "pending")}


@router.post("/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn):
    phone = normalize_phone(body.phone, body.countryIso)
    sid, token, service = _twilio_creds()
    url = f"https://verify.twilio.com/v2/Services/{service}/VerificationCheck"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(url, auth=(sid, token), data={"To": phone, "Code": body.code.strip()})
    data = r.json() if r.content else {}
    if r.status_code >= 400 or data.get("status") != "approved":
        raise HTTPException(401, "Code incorrect ou expiré")

    user = await _find_by_phone(phone)
    if not user:
        first = (body.firstName or "").strip()
        last = (body.lastName or "").strip()
        if not first or not last:
            raise HTTPException(400, "Nouveau numéro : indiquez votre prénom et votre nom")
        if body.role == "supplier":
            if not (body.city or "").strip():
                raise HTTPException(400, "Indiquez la ville de votre boutique")
            if not (body.country or "").strip():
                raise HTTPException(400, "Indiquez le pays de votre boutique")
            if not (body.shopName or "").strip():
                raise HTTPException(400, "Indiquez le nom de votre boutique")
        uid = str(uuid.uuid4())
        dummy = bcrypt.hashpw(uuid.uuid4().hex.encode(), bcrypt.gensalt()).decode()
        user = {
            "id": uid,
            "firstName": first,
            "lastName": last,
            "email": f"{re.sub(r'\D', '', phone)}@otp.pagnemarket.com",
            "phone": phone,
            "passwordHash": dummy,
            "country": body.country or "Gabon",
            "city": body.city,
            "roles": [body.role],
            "avatar": None,
            "shopName": body.shopName,
            "createdAt": datetime.now(timezone.utc),
            "phoneVerified": True,
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"phoneVerified": True, "phone": phone}})
        user["phone"] = phone
        user["phoneVerified"] = True

    return {"token": create_token(user["id"]), "user": user_public(user)}
