"""Image uploads (profile + product photos). Object storage, with DB fallback."""
import base64
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from deps import current_user, db, public_base_url
from storage import APP_NAME, get_object, put_object

logger = logging.getLogger("pagnemarket.uploads")
router = APIRouter()

MAX_BYTES = 8 * 1024 * 1024
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


class ImageJsonIn(BaseModel):
    data: str
    contentType: Optional[str] = "image/jpeg"
    fileName: Optional[str] = None


def _strip_data_url(raw: str) -> str:
    s = (raw or "").strip()
    if "," in s and s.lower().startswith("data:"):
        return s.split(",", 1)[1]
    return s


async def _save_image(request: Request, user: dict, data: bytes, content_type: str, filename: Optional[str]):
    content_type = (content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(400, "Format d'image non supporté (JPEG, PNG, WebP)")
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Image trop lourde (max 8 Mo)")
    if not data:
        raise HTTPException(400, "Fichier vide")

    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ALLOWED[content_type]}"
    backend = "object"
    stored_path = path
    stored_data = None
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
        stored_path = result.get("path") or path
    except Exception as e:  # noqa: BLE001
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status == 402:
            raise HTTPException(402, "Crédits de stockage épuisés, réessayez plus tard")
        logger.warning("Object storage unavailable, saving image in database: %s", e)
        backend = "db"
        stored_data = base64.b64encode(data).decode("ascii")

    await db.files.insert_one({
        "id": file_id,
        "ownerId": user["id"],
        "path": stored_path,
        "backend": backend,
        "data": stored_data,
        "contentType": content_type,
        "size": len(data),
        "originalName": filename,
    })
    return {"id": file_id, "url": f"{public_base_url(request)}/api/files/{file_id}"}


async def _from_json(request: Request, user: dict, payload: dict):
    body = ImageJsonIn.model_validate(payload)
    try:
        data = base64.b64decode(_strip_data_url(body.data), validate=False)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Image invalide")
    ctype = (body.contentType or "image/jpeg").lower()
    if ctype == "image/jpg":
        ctype = "image/jpeg"
    return await _save_image(request, user, data, ctype, body.fileName)


@router.post("/uploads/image")
async def upload_image(request: Request, user: dict = Depends(current_user)):
    ctype = (request.headers.get("content-type") or "").lower()
    if "application/json" in ctype:
        return await _from_json(request, user, await request.json())
    form = await request.form()
    file = form.get("file")
    if not isinstance(file, UploadFile):
        raise HTTPException(400, "Fichier image manquant")
    return await _save_image(request, user, await file.read(), file.content_type or "", file.filename)


@router.post("/uploads/image-json")
async def upload_image_json(request: Request, body: ImageJsonIn, user: dict = Depends(current_user)):
    return await _from_json(request, user, body.model_dump())


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Fichier introuvable")
    if doc.get("backend") == "db" and doc.get("data"):
        try:
            content = base64.b64decode(doc["data"])
        except Exception:  # noqa: BLE001
            raise HTTPException(502, "Fichier indisponible")
        return Response(
            content=content,
            media_type=doc.get("contentType") or "image/jpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    try:
        content, ctype = await run_in_threadpool(get_object, doc["path"])
    except Exception:  # noqa: BLE001
        logger.exception("Download failed")
        raise HTTPException(502, "Fichier indisponible")
    return Response(content=content, media_type=doc.get("contentType") or ctype,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})
