"""Google Sign-In: HTTPS OAuth (Expo Go compatible) + ID token verify → JWT."""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from urllib.parse import urlencode

import bcrypt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, Field

from deps import JWT_SECRET, create_token, db, ensure_creator_profile, public_base_url

logger = logging.getLogger("pagnemarket.google_auth")
router = APIRouter()

RoleT = Literal["buyer", "supplier", "tailor"]


class GoogleAuthIn(BaseModel):
    idToken: str = Field(min_length=20)
    role: RoleT = "buyer"
    city: Optional[str] = None
    country: Optional[str] = None
    shopName: Optional[str] = None
    specialty: Optional[str] = None


def _google_audiences() -> list[str]:
    raw = (os.environ.get("GOOGLE_CLIENT_IDS") or "").strip()
    ids: list[str] = []
    if raw:
        ids.extend([x.strip() for x in raw.split(",") if x.strip()])
    for key in (
        "GOOGLE_CLIENT_ID",
        "GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
    ):
        v = (os.environ.get(key) or "").strip()
        if v and v not in ids:
            ids.append(v)
    return ids


def _web_client_id() -> Optional[str]:
    for key in (
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
        "GOOGLE_WEB_CLIENT_ID",
        "GOOGLE_CLIENT_ID",
    ):
        v = (os.environ.get(key) or "").strip()
        if v:
            return v
    audiences = _google_audiences()
    return audiences[0] if audiences else None


def verify_google_id_token(token: str) -> dict:
    audiences = _google_audiences()
    if not audiences:
        raise HTTPException(
            503,
            "Google Auth non configuré (GOOGLE_CLIENT_IDS ou EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)",
        )
    last_err: Optional[Exception] = None
    for aud in audiences:
        try:
            info = id_token.verify_oauth2_token(token, google_requests.Request(), aud)
            if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
                raise ValueError("Issuer Google invalide")
            return info
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    logger.warning("Google token verify failed: %s", last_err)
    raise HTTPException(401, "Jeton Google invalide ou expiré")


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


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign_state(payload: dict) -> str:
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64url(hmac.new(JWT_SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def _verify_state(state: str) -> dict:
    try:
        body, sig = state.split(".", 1)
        expect = _b64url(hmac.new(JWT_SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expect):
            raise ValueError("bad sig")
        return json.loads(_b64url_decode(body))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, "State OAuth invalide") from e


def _safe_app_redirect(url: Optional[str]) -> str:
    u = (url or "").strip()
    if u.startswith("pagnemarket://") or u.startswith("exp://"):
        return u
    return "pagnemarket://google-auth"


@router.get("/auth/google/start")
async def google_oauth_start(
    request: Request,
    role: RoleT = "buyer",
    city: Optional[str] = None,
    country: Optional[str] = None,
    shopName: Optional[str] = None,
    specialty: Optional[str] = None,
    appRedirect: Optional[str] = None,
):
    """Start Google OAuth via HTTPS (works in Expo Go — no exp:// redirect to Google)."""
    client_id = _web_client_id()
    if not client_id:
        raise HTTPException(503, "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID manquant")
    base = public_base_url(request)
    redirect_uri = f"{base}/api/auth/google/callback"
    nonce = secrets.token_urlsafe(16)
    state = _sign_state(
        {
            "role": role,
            "city": city,
            "country": country,
            "shopName": shopName,
            "specialty": specialty,
            "nonce": nonce,
            "appRedirect": _safe_app_redirect(appRedirect),
        }
    )
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "id_token",
        "scope": "openid email profile",
        "nonce": nonce,
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/auth/google/callback", response_class=HTMLResponse)
async def google_oauth_callback():
    """Google returns id_token in the URL hash — bridge it back into the app."""
    return """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PagneMarket — Google</title>
<style>
  body{font-family:-apple-system,Segoe UI,sans-serif;background:#FAF8F3;color:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
  p{opacity:.75}
</style></head><body>
<p id="msg">Connexion Google…</p>
<script>
(function () {
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }
  try {
    var hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    var q = new URLSearchParams(location.search || '');
    var idToken = hash.get('id_token') || q.get('id_token');
    var state = hash.get('state') || q.get('state') || '';
    var err = hash.get('error') || q.get('error');
    if (err) {
      document.getElementById('msg').textContent = 'Erreur Google : ' + err;
      return;
    }
    if (!idToken) {
      document.getElementById('msg').textContent = 'Jeton Google manquant. Fermez et réessayez.';
      return;
    }
    var appRedirect = 'pagnemarket://google-auth';
    try {
      var payload = JSON.parse(b64urlDecode(state.split('.')[0]));
      if (payload && payload.appRedirect) appRedirect = payload.appRedirect;
    } catch (e) {}
    var sep = appRedirect.indexOf('?') >= 0 ? '&' : '?';
    var target = appRedirect + sep + 'idToken=' + encodeURIComponent(idToken) + '&state=' + encodeURIComponent(state);
    document.getElementById('msg').textContent = 'Retour dans PagneMarket…';
    window.location.replace(target);
    setTimeout(function () {
      document.getElementById('msg').innerHTML = 'Si l\\'app ne s\\'ouvre pas, <a href=\"' + target + '\">touchez ici</a>.';
    }, 1200);
  } catch (e) {
    document.getElementById('msg').textContent = 'Erreur de redirection.';
  }
})();
</script>
</body></html>"""


@router.post("/auth/google")
async def auth_google(body: GoogleAuthIn):
    info = verify_google_id_token(body.idToken)
    sub = str(info.get("sub") or "").strip()
    email = (info.get("email") or "").strip().lower()
    if not sub or not email:
        raise HTTPException(400, "Compte Google sans email")
    if info.get("email_verified") is False:
        raise HTTPException(401, "Email Google non vérifié")

    given = (info.get("given_name") or "").strip()
    family = (info.get("family_name") or "").strip()
    full = (info.get("name") or "").strip()
    if not given and full:
        parts = full.split(" ", 1)
        given = parts[0]
        family = parts[1] if len(parts) > 1 else family
    picture = (info.get("picture") or "").strip() or None

    user = await db.users.find_one({"googleId": sub}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"email": email}, {"_id": 0})

    if user:
        patch = {
            "googleId": sub,
            "emailVerified": True,
            "updatedAt": datetime.now(timezone.utc),
        }
        providers = list(user.get("authProviders") or [])
        if "google" not in providers:
            providers.append("google")
            patch["authProviders"] = providers
        if picture and not (user.get("avatar") or user.get("avatarUrl")):
            patch["avatar"] = picture
        if given and not user.get("firstName"):
            patch["firstName"] = given
        if family and not user.get("lastName"):
            patch["lastName"] = family
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
        user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        return {"token": create_token(user["id"]), "user": user_public(user)}

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
        "lastName": family or "Google",
        "email": email,
        "phone": None,
        "passwordHash": _dummy_password_hash(),
        "country": (body.country or "").strip() or None,
        "city": (body.city or "").strip() or None,
        "roles": [role],
        "avatar": picture,
        "shopName": (body.shopName or "").strip() or None,
        "specialty": (body.specialty or "").strip() or None,
        "googleId": sub,
        "emailVerified": True,
        "authProviders": ["google"],
        "createdAt": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    if role == "tailor":
        await ensure_creator_profile(user_doc)
    return {"token": create_token(uid), "user": user_public(user_doc)}


@router.get("/auth/google/config")
async def google_auth_config(request: Request):
    enabled = bool(_web_client_id())
    base = public_base_url(request)
    return {
        "enabled": enabled,
        "startPath": "/api/auth/google/start",
        "callbackUrl": f"{base}/api/auth/google/callback",
    }
