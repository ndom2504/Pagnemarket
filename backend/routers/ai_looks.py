"""AI fashion looks: client picks a fabric, imagines a garment, then opens the tailor panel."""
import base64
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from urllib.parse import urlparse

import httpx

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from deps import current_user, db
from routers.uploads import save_json_image
from storage import get_object

logger = logging.getLogger("pagnemarket.ai")
router = APIRouter()

GarmentT = Literal["Robe", "Boubou", "Ensemble", "Chemise", "Pantalon", "Mariage"]

STORIES = {
    "Robe": "Une robe qui épouse le motif, comme si ce tissu avait toujours attendu cette coupe.",
    "Boubou": "Le boubou déploie le pagne. Chaque pas fait vivre le dessin.",
    "Ensemble": "Un ensemble taillé pour la ville — le tissu devient architecture.",
    "Chemise": "La chemise porte le motif au quotidien, sans rien lui enlever de sa noblesse.",
    "Pantalon": "Une ligne nette, un pagne qui marche. L'élégance se joue dans le mouvement.",
    "Mariage": "Le grand jour, cousu dans ce tissu. Une pièce-souvenir, pas seulement une tenue.",
}


class GenerateLookIn(BaseModel):
    productId: str
    garment: GarmentT = "Robe"


FASHN_PROMPTS = {
    "Robe": "African woman wearing an elegant midi dress sewn from this exact wax fabric print, full body, studio, luxury editorial",
    "Boubou": "African model wearing a majestic flowing boubou made from this exact fabric print, full body, regal drape",
    "Ensemble": "African model wearing a tailored two-piece set made from this exact fabric print, jacket and trousers",
    "Chemise": "African model wearing an oversized shirt made from this exact fabric print, contemporary luxury",
    "Pantalon": "African model wearing high-waisted tailored trousers made from this exact fabric print",
    "Mariage": "African model in ceremonial wedding attire sewn from this exact fabric print, gold accents, haute couture",
}


def _fashn_key() -> str:
    return (os.environ.get("API_FASHN") or os.environ.get("FASHN_API_KEY") or "").strip()


def _is_private_url(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:  # noqa: BLE001
        return True
    return (
        host in {"localhost", "127.0.0.1", "::1"}
        or host.startswith("10.")
        or host.startswith("192.168.")
        or bool(re.match(r"^172\.(1[6-9]|2\d|3[01])\.", host))
    )


def _first_output(body: dict) -> Optional[str]:
    out = body.get("output")
    if isinstance(out, list) and out:
        first = out[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            return (first.get("url") or first.get("image") or "").strip() or None
    if isinstance(out, str) and out.strip():
        return out.strip()
    return None


def _bytes_from_output(raw: str) -> bytes:
    s = (raw or "").strip()
    if s.startswith("data:") and "," in s:
        return base64.b64decode(s.split(",", 1)[1])
    r = httpx.get(s, timeout=40, follow_redirects=True)
    r.raise_for_status()
    if not r.content:
        raise RuntimeError("empty fashn output")
    return r.content


async def _fabric_for_fashn(url: Optional[str]) -> Optional[str]:
    """FASHN cannot fetch LAN URLs — send a data URI or a public https URL."""
    if not url:
        return None
    s = str(url).strip()
    if s.startswith("data:"):
        return s
    file_id = None
    m = re.search(r"/files/([0-9a-fA-F-]{36})", s)
    if m:
        file_id = m.group(1)
    if file_id:
        doc = await db.files.find_one({"id": file_id}, {"_id": 0})
        if doc:
            if doc.get("data"):
                ctype = doc.get("contentType") or "image/jpeg"
                return f"data:{ctype};base64,{doc['data']}"
            if doc.get("path"):
                try:
                    content, ctype = await run_in_threadpool(get_object, doc["path"])
                    b64 = base64.b64encode(content).decode("ascii")
                    return f"data:{ctype or 'image/jpeg'};base64,{b64}"
                except Exception as e:  # noqa: BLE001
                    logger.warning("Could not read fabric file for FASHN: %s", e)
    if s.startswith("http") and not _is_private_url(s):
        return s
    return None


def _try_fashn_product_to_model(product_image: str, garment: str) -> bytes:
    """Turn a fabric photo into a person wearing a garment cut from that cloth."""
    key = _fashn_key()
    if not key:
        raise RuntimeError("Clé FASHN absente")
    prompt = FASHN_PROMPTS.get(garment, FASHN_PROMPTS["Robe"])
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    run = httpx.post(
        "https://api.fashn.ai/v1/run",
        headers=headers,
        json={
            "model_name": "product-to-model",
            "inputs": {
                "product_image": product_image,
                "prompt": prompt,
                "aspect_ratio": "3:4",
                "resolution": "1k",
                "generation_mode": "fast",
                "output_format": "png",
                "return_base64": True,
            },
        },
        timeout=45,
    )
    if run.status_code == 401:
        raise RuntimeError("Clé FASHN invalide")
    if run.status_code == 402:
        raise RuntimeError("Crédits FASHN épuisés")
    if run.status_code >= 400:
        detail = ""
        try:
            detail = str((run.json() or {}).get("error") or run.text)[:300]
        except Exception:  # noqa: BLE001
            detail = run.text[:200]
        raise RuntimeError(detail or f"FASHN HTTP {run.status_code}")
    pred_id = (run.json() or {}).get("id")
    if not pred_id:
        raise RuntimeError("FASHN n'a pas renvoyé d'identifiant")
    for _ in range(30):
        time.sleep(2)
        st = httpx.get(f"https://api.fashn.ai/v1/status/{pred_id}", headers=headers, timeout=20)
        body = st.json() if st.content else {}
        status = (body.get("status") or "").lower()
        if status == "completed":
            raw = _first_output(body)
            if not raw:
                raise RuntimeError("FASHN n'a pas renvoyé d'image")
            return _bytes_from_output(raw)
        if status in {"failed", "error"}:
            err = body.get("error")
            msg = err.get("message") if isinstance(err, dict) else (err or "échec FASHN")
            raise RuntimeError(str(msg)[:300])
    raise RuntimeError("FASHN a mis trop longtemps")


@router.post("/ai/looks")
async def generate_look(body: GenerateLookIn, request: Request, user: dict = Depends(current_user)):
    product = await db.products.find_one({"id": body.productId}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Tissu introuvable")

    fabric = (product.get("images") or [None])[0]
    payload = await _fabric_for_fashn(fabric)
    if not payload:
        raise HTTPException(400, "Ce tissu n'a pas de photo utilisable pour l'IA.")
    if not _fashn_key():
        raise HTTPException(503, "Le service de génération n'est pas configuré.")

    try:
        png = await run_in_threadpool(_try_fashn_product_to_model, payload, body.garment)
    except Exception as e:  # noqa: BLE001
        logger.warning("FASHN product-to-model failed: %s", e)
        raise HTTPException(502, "La génération du modèle a échoué. Réessayez.") from e

    saved = await save_json_image(request, user, {
        "data": base64.b64encode(png).decode("ascii"),
        "contentType": "image/png",
        "fileName": "look.png",
    })
    image_url = saved["url"]

    tailors = await db.creators.find({}, {"_id": 0}).to_list(8)
    look = {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "productId": product["id"],
        "productName": product.get("name"),
        "productImage": fabric,
        "category": product.get("category"),
        "garment": body.garment,
        "image": image_url,
        "title": f"{body.garment} · {product.get('name')}",
        "story": STORIES.get(body.garment, STORIES["Robe"]),
        "source": "fashn",
        "tailors": tailors,
        "createdAt": datetime.now(timezone.utc),
    }
    await db.ai_looks.insert_one(look)
    look.pop("_id", None)
    return look


@router.get("/ai/looks")
async def list_looks(productId: Optional[str] = None, user: dict = Depends(current_user)):
    query = {"userId": user["id"]}
    if productId:
        query["productId"] = productId
    items = await db.ai_looks.find(query, {"_id": 0}).sort("createdAt", -1).to_list(20)
    return {"items": items}
