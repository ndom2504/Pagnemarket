"""AI fashion looks: client picks a fabric, imagines a garment, then opens the tailor panel."""
import concurrent.futures
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from deps import current_user, db, public_base_url
from storage import APP_NAME, put_object

logger = logging.getLogger("pagnemarket.ai")
router = APIRouter()

GarmentT = Literal["Robe", "Boubou", "Ensemble", "Chemise", "Pantalon", "Mariage"]

GARMENT_PROMPT = {
    "Robe": "an elegant contemporary African wax-print midi dress, fluid silhouette, editorial fashion pose",
    "Boubou": "a majestic flowing boubou grand boubou, wide sleeves, regal drape, luxury editorial",
    "Ensemble": "a tailored two-piece Ankara co-ord set, jacket and trousers, modern African couture",
    "Chemise": "a crisp oversized shirt made of African print fabric, contemporary street-luxury",
    "Pantalon": "high-waisted tailored trousers in African wax print, sharp crease, fashion editorial",
    "Mariage": "a ceremonial African wedding attire in the fabric, gold accents, haute couture lighting",
}

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


def _build_prompt(product: dict, garment: str) -> str:
    cut = GARMENT_PROMPT.get(garment, GARMENT_PROMPT["Robe"])
    name = product.get("name") or "African wax fabric"
    desc = (product.get("description") or "")[:220]
    cat = product.get("category") or "wax"
    return (
        f"Luxury fashion photograph, full body, African model wearing {cut}, "
        f"garment sewn from authentic {cat} fabric named '{name}'. "
        f"Fabric details: {desc}. "
        f"The clothing MUST clearly show the colorful African print pattern of the fabric. "
        f"Soft studio light, cream backdrop, tactile textile, Vogue Africa editorial, "
        f"no text, no watermark, no logo."
    )


def _pollinations_url(prompt: str, seed: int) -> str:
    return (
        "https://image.pollinations.ai/prompt/"
        f"{quote(prompt, safe='')}?width=768&height=1024&nologo=true&model=flux&seed={seed}"
    )


def _try_emergent_image(prompt: str) -> Optional[bytes]:
    key = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    if not key:
        return None
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
    except Exception:
        try:
            from emergentintegrations.llm.openai import OpenAIImageGeneration
        except Exception:
            logger.info("emergentintegrations image generation not available")
            return None
    try:
        gen = OpenAIImageGeneration(api_key=key)
        result = gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1, quality="low")
        if result and isinstance(result, list) and result[0]:
            data = result[0]
            return data if isinstance(data, (bytes, bytearray)) else None
    except TypeError:
        try:
            gen = OpenAIImageGeneration(key)
            result = gen.generate_images(prompt, "gpt-image-1", 1, "low")
            if result and isinstance(result, list) and result[0]:
                data = result[0]
                return data if isinstance(data, (bytes, bytearray)) else None
        except Exception as e:  # noqa: BLE001
            logger.warning("Emergent image gen failed: %s", e)
    except Exception as e:  # noqa: BLE001
        logger.warning("Emergent image gen failed: %s", e)
    return None


def _try_emergent_image_timed(prompt: str, timeout: float = 12) -> Optional[bytes]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(_try_emergent_image, prompt)
        try:
            return fut.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            logger.warning("Emergent image gen timed out")
            return None


async def _store_png(request: Request, user_id: str, data: bytes) -> Optional[str]:
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/looks/{user_id}/{file_id}.png"
    try:
        await run_in_threadpool(put_object, path, data, "image/png")
    except Exception as e:  # noqa: BLE001
        logger.warning("Look upload failed: %s", e)
        return None
    await db.files.insert_one({
        "id": file_id,
        "ownerId": user_id,
        "path": path,
        "contentType": "image/png",
        "size": len(data),
        "originalName": f"look-{file_id}.png",
    })
    return f"{public_base_url(request)}/api/files/{file_id}"


@router.post("/ai/looks")
async def generate_look(body: GenerateLookIn, request: Request, user: dict = Depends(current_user)):
    product = await db.products.find_one({"id": body.productId}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Tissu introuvable")

    prompt = _build_prompt(product, body.garment)
    seed = int(uuid.uuid4().hex[:8], 16) % 1_000_000
    source = "pollinations"
    image_url = _pollinations_url(prompt, seed)

    png = await run_in_threadpool(_try_emergent_image_timed, prompt)
    if png:
        stored = await _store_png(request, user["id"], png)
        if stored:
            image_url = stored
            source = "emergent"

    tailors = await db.creators.find({}, {"_id": 0}).to_list(8)
    look = {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "productId": product["id"],
        "productName": product.get("name"),
        "productImage": (product.get("images") or [None])[0],
        "category": product.get("category"),
        "garment": body.garment,
        "image": image_url,
        "title": f"{body.garment} · {product.get('name')}",
        "story": STORIES.get(body.garment, STORIES["Robe"]),
        "source": source,
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
