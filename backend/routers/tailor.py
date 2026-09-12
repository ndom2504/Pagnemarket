"""Tailor (tailleur) atelier: dashboard, creations, sewing orders, clients, measures, appointments."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import (
    current_tailor,
    current_user,
    create_inbox_notification,
    db,
    ensure_creator_profile,
    notify_tailor_new_sewing_order,
    status_entry,
)

router = APIRouter()

SEWING_FLOW = ["received", "measurements", "sewing", "fitting", "done", "delivered"]
StatusT = Literal["received", "measurements", "sewing", "fitting", "done", "delivered", "cancelled"]
IN_PROGRESS = ["received", "measurements", "sewing", "fitting"]


class ModelIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=5, max_length=2000)
    category: str = "sur-mesure"
    indicativePrice: float = Field(gt=0)
    difficulty: str = "Intermédiaire"
    image: str
    images: List[str] = []
    sizes: List[str] = []
    leadDays: int = Field(default=7, ge=1, le=180)
    fabricRecommendation: Optional[str] = None


class SewingOrderIn(BaseModel):
    clientId: Optional[str] = None
    clientName: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=2, max_length=160)
    price: float = Field(ge=0, default=0)
    dueDate: Optional[str] = None
    modelId: Optional[str] = None
    notes: Optional[str] = None


class StatusIn(BaseModel):
    status: StatusT


class MeasurementIn(BaseModel):
    clientId: Optional[str] = None
    clientName: str = Field(min_length=1, max_length=120)
    label: str = "Mensurations"
    values: dict = Field(default_factory=dict)
    notes: Optional[str] = None


class AppointmentIn(BaseModel):
    clientId: Optional[str] = None
    clientName: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=2, max_length=160)
    at: str
    notes: Optional[str] = None


class ProfileIn(BaseModel):
    bio: Optional[str] = None
    specialty: Optional[str] = None
    yearsExperience: Optional[int] = None
    verified: Optional[bool] = None
    cover: Optional[str] = None


async def _creator(user: dict) -> dict:
    return await ensure_creator_profile(user)


def _now():
    return datetime.now(timezone.utc)


@router.get("/tailor/dashboard")
async def tailor_dashboard(user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    tid = user["id"]
    orders = await db.sewing_orders.find({"tailorId": tid}, {"_id": 0}).sort("updatedAt", -1).to_list(500)
    models = await db.models.find({"creatorId": creator["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(200)
    appts = await db.appointments.find({"tailorId": tid}, {"_id": 0}).sort("at", 1).to_list(100)
    measures = await db.measurements.find({"tailorId": tid}, {"_id": 0}).sort("updatedAt", -1).to_list(200)
    convs = await db.conversations.find({"participantIds": tid}, {"_id": 0}).to_list(200)

    unread = 0
    clients = {}
    for c in convs:
        unread += int((c.get("unreadBy") or {}).get(tid) or 0)
        for p in c.get("participants") or []:
            if p.get("id") and p["id"] != tid:
                clients[p["id"]] = p

    in_progress = [o for o in orders if o.get("status") in IN_PROGRESS]
    done = [o for o in orders if o.get("status") in ("done", "delivered")]
    revenue = sum(float(o.get("price") or 0) for o in done if o.get("paymentStatus") == "paid" or o.get("status") == "delivered")
    # Also count done orders with price as potential revenue
    if revenue == 0:
        revenue = sum(float(o.get("price") or 0) for o in done)

    now = _now()
    upcoming = []
    for a in appts:
        at = a.get("at")
        if isinstance(at, str):
            try:
                at = datetime.fromisoformat(at.replace("Z", "+00:00"))
            except ValueError:
                continue
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if at >= now - timedelta(hours=1):
            upcoming.append(a)
        if len(upcoming) >= 5:
            break

    deliveries = [
        o for o in orders
        if o.get("status") in ("done", "fitting") and o.get("dueDate")
    ][:5]

    return {
        "creator": creator,
        "stats": {
            "ordersInProgress": len(in_progress),
            "ordersDone": len(done),
            "revenue": revenue,
            "clients": len(clients),
            "rating": float(creator.get("rating") or 5),
            "modelsCount": len(models),
            "unreadMessages": unread,
            "verified": bool(creator.get("verified") or user.get("emailVerified") or user.get("phoneVerified")),
        },
        "recentOrders": orders[:6],
        "upcomingAppointments": [_iso_at(a) for a in upcoming],
        "upcomingDeliveries": deliveries,
        "popularCreations": sorted(models, key=lambda m: float(m.get("views") or 0), reverse=True)[:4]
        or models[:4],
        "alerts": _alerts(in_progress, upcoming, unread),
        "currency": "XAF",
    }


def _alerts(in_progress, upcoming, unread):
    alerts = []
    if unread:
        alerts.append({"kind": "messages", "text": f"{unread} message(s) non lu(s)"})
    late = [o for o in in_progress if o.get("dueDate")]
    if late:
        alerts.append({"kind": "orders", "text": f"{len(in_progress)} commande(s) en cours"})
    if upcoming:
        alerts.append({"kind": "calendar", "text": f"{len(upcoming)} rendez-vous à venir"})
    return alerts


def _iso_at(doc: dict) -> dict:
    out = dict(doc)
    at = out.get("at")
    if isinstance(at, datetime):
        out["at"] = at.isoformat()
    return out


@router.get("/tailor/profile")
async def tailor_profile(user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    return {"user": {k: user.get(k) for k in ("id", "firstName", "lastName", "email", "phone", "city", "country", "specialty", "avatar", "avatarUrl")}, "creator": creator}


@router.patch("/tailor/profile")
async def update_tailor_profile(body: ProfileIn, user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "specialty" in patch:
        await db.users.update_one({"id": user["id"]}, {"$set": {"specialty": patch["specialty"]}})
    if patch:
        patch["updatedAt"] = _now()
        await db.creators.update_one({"id": creator["id"]}, {"$set": patch})
    return await tailor_profile(user)


# ---- Creations (models) ----

@router.get("/tailor/models")
async def list_models(user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    return await db.models.find({"creatorId": creator["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(200)


@router.post("/tailor/models")
async def create_model(body: ModelIn, user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    images = body.images or ([body.image] if body.image else [])
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "description": body.description.strip(),
        "category": body.category,
        "indicativePrice": float(body.indicativePrice),
        "currency": "XAF",
        "difficulty": body.difficulty,
        "image": images[0] if images else body.image,
        "images": images,
        "sizes": body.sizes,
        "leadDays": body.leadDays,
        "fabricRecommendation": body.fabricRecommendation,
        "creatorId": creator["id"],
        "creatorName": creator.get("name"),
        "views": 0,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await db.models.insert_one(doc.copy())
    count = await db.models.count_documents({"creatorId": creator["id"]})
    await db.creators.update_one({"id": creator["id"]}, {"$set": {"modelsCount": count}})
    doc.pop("_id", None)
    return doc


@router.put("/tailor/models/{mid}")
async def update_model(mid: str, body: ModelIn, user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    existing = await db.models.find_one({"id": mid, "creatorId": creator["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Création introuvable")
    images = body.images or ([body.image] if body.image else existing.get("images") or [])
    patch = {
        "name": body.name.strip(),
        "description": body.description.strip(),
        "category": body.category,
        "indicativePrice": float(body.indicativePrice),
        "difficulty": body.difficulty,
        "image": images[0] if images else body.image,
        "images": images,
        "sizes": body.sizes,
        "leadDays": body.leadDays,
        "fabricRecommendation": body.fabricRecommendation,
        "updatedAt": _now(),
    }
    await db.models.update_one({"id": mid}, {"$set": patch})
    return {**existing, **patch}


@router.delete("/tailor/models/{mid}")
async def delete_model(mid: str, user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    res = await db.models.delete_one({"id": mid, "creatorId": creator["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Création introuvable")
    count = await db.models.count_documents({"creatorId": creator["id"]})
    await db.creators.update_one({"id": creator["id"]}, {"$set": {"modelsCount": count}})
    return {"ok": True}


class SewingRequestIn(BaseModel):
    tailorUserId: Optional[str] = None
    creatorId: Optional[str] = None
    modelId: Optional[str] = None
    title: str = Field(default="Demande de confection", min_length=2, max_length=160)
    notes: Optional[str] = None
    price: float = Field(ge=0, default=0)


@router.post("/sewing-requests")
async def create_sewing_request(body: SewingRequestIn, user: dict = Depends(current_user)):
    """Buyer asks a tailor for a custom sewing order — rings the tailor inbox."""
    tailor_user_id = body.tailorUserId
    creator = None
    if body.creatorId:
        creator = await db.creators.find_one(
            {"$or": [{"id": body.creatorId}, {"userId": body.creatorId}]},
            {"_id": 0},
        )
        if creator:
            tailor_user_id = creator.get("userId") or creator.get("id")
    if not tailor_user_id and body.tailorUserId:
        tailor_user_id = body.tailorUserId
    if not tailor_user_id:
        raise HTTPException(400, "Tailleur introuvable")
    tailor = await db.users.find_one({"id": tailor_user_id}, {"_id": 0})
    if not tailor or ("tailor" not in (tailor.get("roles") or []) and "admin" not in (tailor.get("roles") or [])):
        # Still allow if creator profile exists (legacy)
        if not creator:
            raise HTTPException(404, "Tailleur introuvable")
    if not creator:
        creator = await ensure_creator_profile(tailor) if tailor else None
    client_name = f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get("email") or "Client"
    model_name = None
    if body.modelId:
        model = await db.models.find_one({"id": body.modelId}, {"_id": 0, "name": 1, "indicativePrice": 1})
        if model:
            model_name = model.get("name")
    title = body.title.strip()
    if model_name and title == "Demande de confection":
        title = f"Confection · {model_name}"
    price = float(body.price or 0)
    if price <= 0 and body.modelId:
        model = await db.models.find_one({"id": body.modelId}, {"_id": 0, "indicativePrice": 1})
        if model:
            price = float(model.get("indicativePrice") or 0)
    doc = {
        "id": str(uuid.uuid4()),
        "tailorId": tailor_user_id,
        "creatorId": (creator or {}).get("id") or tailor_user_id,
        "clientId": user["id"],
        "clientName": client_name,
        "title": title,
        "price": price,
        "currency": "XAF",
        "dueDate": None,
        "modelId": body.modelId,
        "notes": body.notes,
        "status": "received",
        "paymentStatus": "pending",
        "source": "client_request",
        "statusHistory": [status_entry("received")],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await db.sewing_orders.insert_one(doc.copy())
    if creator:
        await db.creators.update_one({"id": creator["id"]}, {"$inc": {"ordersCount": 1}})
    await notify_tailor_new_sewing_order(doc, tailor_id=tailor_user_id)
    doc.pop("_id", None)
    return doc


# ---- Sewing orders ----

@router.get("/tailor/orders")
async def list_sewing_orders(user: dict = Depends(current_tailor)):
    return await db.sewing_orders.find({"tailorId": user["id"]}, {"_id": 0}).sort("updatedAt", -1).to_list(300)


@router.post("/tailor/orders")
async def create_sewing_order(body: SewingOrderIn, user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    doc = {
        "id": str(uuid.uuid4()),
        "tailorId": user["id"],
        "creatorId": creator["id"],
        "clientId": body.clientId,
        "clientName": body.clientName.strip(),
        "title": body.title.strip(),
        "price": float(body.price),
        "currency": "XAF",
        "dueDate": body.dueDate,
        "modelId": body.modelId,
        "notes": body.notes,
        "status": "received",
        "paymentStatus": "pending",
        "source": "tailor",
        "statusHistory": [status_entry("received")],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await db.sewing_orders.insert_one(doc.copy())
    await db.creators.update_one({"id": creator["id"]}, {"$inc": {"ordersCount": 1}})
    if body.clientId:
        await create_inbox_notification(
            body.clientId,
            kind="sewing_order",
            title="Commande couture enregistrée",
            body=doc.get("title") or "Votre demande a été prise en charge",
            data={"kind": "sewing_order", "sewingOrderId": doc.get("id"), "href": "/orders"},
        )
    doc.pop("_id", None)
    return doc


@router.get("/tailor/orders/{oid}")
async def get_sewing_order(oid: str, user: dict = Depends(current_tailor)):
    o = await db.sewing_orders.find_one({"id": oid, "tailorId": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    return o


@router.patch("/tailor/orders/{oid}/status")
async def patch_sewing_status(oid: str, body: StatusIn, user: dict = Depends(current_tailor)):
    o = await db.sewing_orders.find_one({"id": oid, "tailorId": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    patch = {"status": body.status, "updatedAt": _now()}
    if body.status == "delivered":
        patch["paymentStatus"] = "paid"
        patch["deliveredAt"] = _now()
    await db.sewing_orders.update_one(
        {"id": oid},
        {"$set": patch, "$push": {"statusHistory": status_entry(body.status)}},
    )
    return await get_sewing_order(oid, user)


# ---- Clients ----

@router.get("/tailor/clients")
async def list_clients(user: dict = Depends(current_tailor)):
    tid = user["id"]
    convs = await db.conversations.find({"participantIds": tid}, {"_id": 0}).to_list(300)
    orders = await db.sewing_orders.find({"tailorId": tid}, {"_id": 0}).to_list(500)
    measures = await db.measurements.find({"tailorId": tid}, {"_id": 0}).to_list(500)
    clients = {}
    for c in convs:
        for p in c.get("participants") or []:
            if p.get("id") and p["id"] != tid:
                entry = clients.setdefault(p["id"], {**p, "ordersCount": 0, "hasMeasures": False, "lastMessage": c.get("lastMessage")})
                entry["lastMessage"] = c.get("lastMessage") or entry.get("lastMessage")
    for o in orders:
        key = o.get("clientId") or f"name:{o.get('clientName')}"
        entry = clients.setdefault(key, {"id": o.get("clientId"), "name": o.get("clientName"), "ordersCount": 0, "hasMeasures": False})
        entry["ordersCount"] = int(entry.get("ordersCount") or 0) + 1
        entry["name"] = entry.get("name") or o.get("clientName")
    for m in measures:
        key = m.get("clientId") or f"name:{m.get('clientName')}"
        entry = clients.setdefault(key, {"id": m.get("clientId"), "name": m.get("clientName"), "ordersCount": 0, "hasMeasures": False})
        entry["hasMeasures"] = True
        entry["name"] = entry.get("name") or m.get("clientName")
    return sorted(clients.values(), key=lambda x: x.get("name") or "")


# ---- Measurements ----

@router.get("/tailor/measurements")
async def list_measurements(user: dict = Depends(current_tailor)):
    return await db.measurements.find({"tailorId": user["id"]}, {"_id": 0}).sort("updatedAt", -1).to_list(300)


@router.post("/tailor/measurements")
async def upsert_measurement(body: MeasurementIn, user: dict = Depends(current_tailor)):
    doc = {
        "id": str(uuid.uuid4()),
        "tailorId": user["id"],
        "clientId": body.clientId,
        "clientName": body.clientName.strip(),
        "label": body.label,
        "values": body.values or {},
        "notes": body.notes,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await db.measurements.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.delete("/tailor/measurements/{mid}")
async def delete_measurement(mid: str, user: dict = Depends(current_tailor)):
    res = await db.measurements.delete_one({"id": mid, "tailorId": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Fiche introuvable")
    return {"ok": True}


# ---- Appointments ----

@router.get("/tailor/appointments")
async def list_appointments(user: dict = Depends(current_tailor)):
    items = await db.appointments.find({"tailorId": user["id"]}, {"_id": 0}).sort("at", 1).to_list(300)
    return [_iso_at(a) for a in items]


@router.post("/tailor/appointments")
async def create_appointment(body: AppointmentIn, user: dict = Depends(current_tailor)):
    try:
        at = datetime.fromisoformat(body.at.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(400, "Date invalide") from e
    doc = {
        "id": str(uuid.uuid4()),
        "tailorId": user["id"],
        "clientId": body.clientId,
        "clientName": body.clientName.strip(),
        "title": body.title.strip(),
        "at": at,
        "notes": body.notes,
        "status": "scheduled",
        "createdAt": _now(),
    }
    await db.appointments.insert_one(doc.copy())
    doc.pop("_id", None)
    out = {**doc, "at": at.isoformat()}
    return out


@router.delete("/tailor/appointments/{aid}")
async def delete_appointment(aid: str, user: dict = Depends(current_tailor)):
    res = await db.appointments.delete_one({"id": aid, "tailorId": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Rendez-vous introuvable")
    return {"ok": True}


@router.get("/tailor/reviews")
async def tailor_reviews(user: dict = Depends(current_tailor)):
    creator = await _creator(user)
    # Product-style reviews tagged to creator if any; else empty with rating summary
    items = await db.reviews.find({"creatorId": creator["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)
    return {
        "rating": float(creator.get("rating") or 5),
        "count": len(items) or int(creator.get("reviewsCount") or 0),
        "items": items,
    }


@router.get("/tailor/revenue")
async def tailor_revenue(user: dict = Depends(current_tailor)):
    orders = await db.sewing_orders.find({"tailorId": user["id"]}, {"_id": 0}).to_list(1000)
    paid = [o for o in orders if o.get("status") in ("done", "delivered")]
    total = sum(float(o.get("price") or 0) for o in paid)
    pending = sum(float(o.get("price") or 0) for o in orders if o.get("status") in IN_PROGRESS)
    return {
        "currency": "XAF",
        "gross": total,
        "pending": pending,
        "ordersPaid": len(paid),
        "payoutStatus": "manual",
        "note": "Versements manuels — Connect non activé",
        "recent": paid[:10],
    }
