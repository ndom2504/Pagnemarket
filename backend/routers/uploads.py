"""Image uploads for suppliers (product photos) via Emergent Object Storage."""
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from deps import current_user, db, public_base_url
from storage import APP_NAME, get_object, put_object

logger = logging.getLogger("pagnemarket.uploads")
router = APIRouter()

MAX_BYTES = 8 * 1024 * 1024
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


@router.post("/uploads/image")
async def upload_image(request: Request, file: UploadFile = File(...), user: dict = Depends(current_user)):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(400, "Format d'image non supporté (JPEG, PNG, WebP)")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Image trop lourde (max 8 Mo)")
    if not data:
        raise HTTPException(400, "Fichier vide")

    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ALLOWED[content_type]}"
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:  # noqa: BLE001
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status == 402:
            raise HTTPException(402, "Crédits de stockage épuisés, réessayez plus tard")
        logger.exception("Upload failed")
        raise HTTPException(502, "Échec de l'envoi de l'image")

    await db.files.insert_one({
        "id": file_id,
        "ownerId": user["id"],
        "path": result["path"],
        "contentType": content_type,
        "size": len(data),
        "originalName": file.filename,
    })
    return {"id": file_id, "url": f"{public_base_url(request)}/api/files/{file_id}"}


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    # Product photos are public marketplace content.
    doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Fichier introuvable")
    try:
        content, ctype = await run_in_threadpool(get_object, doc["path"])
    except Exception:  # noqa: BLE001
        logger.exception("Download failed")
        raise HTTPException(502, "Fichier indisponible")
    return Response(content=content, media_type=doc.get("contentType") or ctype,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})
