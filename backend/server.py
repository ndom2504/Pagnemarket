from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt

from deps import client, db, create_token, current_user, decrement_stock
from routers import payments as payments_router
from routers import supplier as supplier_router
from routers import uploads as uploads_router
from routers.uploads import save_avatar_bytes, save_json_image
from routers import reco as reco_router
from routers import reviews as reviews_router
from routers import ai_looks as ai_looks_router
from routers import otp_auth as otp_auth_router
from routers.payments import OrderDraft, build_order_from_cart
from storage import init_storage

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("pagnemarket")

app = FastAPI(title="PagneMarket API")
api_router = APIRouter(prefix="/api")

# ------------------ MODELS ------------------

RoleT = Literal["buyer", "supplier", "tailor", "admin"]

class UserRegister(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    country: Optional[str] = "Gabon"
    city: Optional[str] = None
    role: RoleT = "buyer"
    shopName: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    roles: List[str] = []
    avatar: Optional[str] = None
    avatarUrl: Optional[str] = None
    shopName: Optional[str] = None
    createdAt: Optional[datetime] = None

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    image: Optional[str] = None

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str
    price: float
    currency: str = "XAF"
    promoPrice: Optional[float] = None
    stock: int = 10
    images: List[str] = []
    supplierId: str
    supplierName: str
    location: str = "Libreville, Gabon"
    country: Optional[str] = None
    rating: float = 4.6
    reviewsCount: int = 0
    tags: List[str] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Creator(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    city: str
    country: str
    specialty: str
    yearsExperience: int
    rating: float = 4.8
    modelsCount: int = 0
    ordersCount: int = 0
    bio: str
    avatar: str
    cover: str

class Model(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    creatorId: str
    creatorName: str
    category: str
    description: str
    indicativePrice: float
    currency: str = "XAF"
    difficulty: str = "Intermédiaire"
    image: str
    fabricRecommendation: Optional[str] = None

class CartItem(BaseModel):
    productId: str
    quantity: int = 1

class AddCartItem(BaseModel):
    productId: str
    quantity: int = 1

class OrderCreate(BaseModel):
    address: str
    city: str
    country: str
    phone: str
    paymentMethod: str = "card"

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversationId: str
    fromUserId: str
    fromName: str
    text: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SendMessage(BaseModel):
    toUserId: str
    toName: str
    text: str

# ------------------ HELPERS ------------------

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def user_public(u: dict) -> dict:
    created = u.get("createdAt") or datetime.now(timezone.utc)
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except ValueError:
            created = datetime.now(timezone.utc)
    return {
        "id": u["id"],
        "firstName": u.get("firstName") or "",
        "lastName": u.get("lastName") or "",
        "email": u.get("email") or "",
        "phone": u.get("phone"),
        "country": u.get("country"),
        "city": u.get("city"),
        "roles": u.get("roles") or ["buyer"],
        "avatar": u.get("avatar") or u.get("avatarUrl"),
        "avatarUrl": u.get("avatar") or u.get("avatarUrl"),
        "shopName": u.get("shopName"),
        "createdAt": created,
    }

# ------------------ AUTH ROUTES ------------------

@api_router.post("/auth/register", response_model=AuthResponse)
async def register(body: UserRegister):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "firstName": body.firstName,
        "lastName": body.lastName,
        "email": body.email.lower(),
        "phone": body.phone,
        "passwordHash": hash_password(body.password),
        "country": body.country,
        "city": body.city,
        "roles": [body.role],
        "avatar": None,
        "shopName": body.shopName,
        "createdAt": datetime.now(timezone.utc),
    }
    if body.role == "supplier":
        if not (body.city or "").strip():
            raise HTTPException(status_code=400, detail="Indiquez la ville de votre boutique")
        if not (body.country or "").strip():
            raise HTTPException(status_code=400, detail="Indiquez le pays de votre boutique")
        if not (body.shopName or "").strip():
            raise HTTPException(status_code=400, detail="Indiquez le nom de votre boutique")
    await db.users.insert_one(user_doc)
    return {"token": create_token(uid), "user": user_public(user_doc)}

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    return {"token": create_token(user["id"]), "user": user_public(user)}

class UserUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    shopName: Optional[str] = None
    avatar: Optional[str] = None
    avatarUrl: Optional[str] = None


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user_public(user)


@api_router.post("/profile/avatar")
async def set_profile_avatar(request: Request, user: dict = Depends(current_user)):
    content_type = (request.headers.get("content-type") or "").split(";", 1)[0].lower()
    if content_type.startswith("image/") or content_type == "application/octet-stream":
        data = await request.body()
        return await save_avatar_bytes(
            request,
            user,
            data,
            "image/jpeg" if content_type == "application/octet-stream" else content_type,
            request.headers.get("x-file-name") or "avatar.jpg",
        )
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    payload["asAvatar"] = True
    return await save_json_image(request, user, payload)


@api_router.patch("/profile")
@api_router.patch("/auth/me")
async def update_me(body: UserUpdate, user: dict = Depends(current_user)):
    raw = body.model_dump(exclude_unset=True)
    if "avatarUrl" in raw:
        raw["avatar"] = raw.pop("avatarUrl")
    patch = {}
    for k, v in raw.items():
        if k == "avatar":
            patch[k] = v
        elif v is not None:
            patch[k] = v
    if "firstName" in patch and not str(patch["firstName"]).strip():
        raise HTTPException(400, "Indiquez votre prénom")
    if "lastName" in patch and not str(patch["lastName"]).strip():
        raise HTTPException(400, "Indiquez votre nom")
    if "firstName" in patch:
        patch["firstName"] = str(patch["firstName"]).strip()
    if "lastName" in patch:
        patch["lastName"] = str(patch["lastName"]).strip()
    if "shopName" in patch:
        patch["shopName"] = str(patch["shopName"]).strip() or None
    if "avatar" in patch and patch["avatar"] is not None:
        patch["avatar"] = str(patch["avatar"]).strip() or None
    if "supplier" in user.get("roles", []) and "city" in patch and not str(patch.get("city") or "").strip():
        raise HTTPException(400, "Indiquez la ville de votre boutique")
    patch["updatedAt"] = datetime.now(timezone.utc)
    await db.users.update_one({"id": user["id"]}, {"$set": patch})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_public(updated or {**user, **patch})

# ------------------ CATALOG ROUTES ------------------

DEFAULT_CATEGORIES = [
    {"id": "wax", "slug": "wax", "name": "Pagne Wax", "image": None},
    {"id": "bazin", "slug": "bazin", "name": "Bazin", "image": None},
    {"id": "kente", "slug": "kente", "name": "Kente", "image": None},
    {"id": "bogolan", "slug": "bogolan", "name": "Bogolan", "image": None},
    {"id": "vlisco", "slug": "vlisco", "name": "Vlisco", "image": None},
    {"id": "accessoires", "slug": "accessoires", "name": "Accessoires", "image": None},
]


@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    return cats or DEFAULT_CATEGORIES

def _country_clause(country: Optional[str]) -> Optional[dict]:
    if not country or country.lower() in ("all", "tous"):
        return None
    return {
        "$or": [
            {"country": country},
            {"location": {"$regex": country, "$options": "i"}},
        ]
    }


def _city_clause(city: Optional[str]) -> Optional[dict]:
    if not city or city.lower() in ("all", "tous", "toutes les villes"):
        return None
    return {
        "$or": [
            {"city": city},
            {"location": {"$regex": city, "$options": "i"}},
        ]
    }


@api_router.get("/markets")
async def list_markets():
    products = await db.products.find({}, {"_id": 0, "country": 1, "location": 1}).to_list(2000)
    names = set()
    for p in products:
        if p.get("country"):
            names.add(p["country"])
        loc = (p.get("location") or "")
        if "," in loc:
            names.add(loc.split(",")[-1].strip())
    return sorted(n for n in names if n)


@api_router.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
):
    filters: list = []
    if category and category != "all":
        filters.append({"category": category})
    if q:
        filters.append({
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"tags": {"$regex": q, "$options": "i"}},
            ]
        })
    country_q = _country_clause(country)
    if country_q:
        filters.append(country_q)
    city_q = _city_clause(city)
    if city_q:
        filters.append(city_q)
    query: dict = {"$and": filters} if len(filters) > 1 else (filters[0] if filters else {})
    cursor = db.products.find(query, {"_id": 0})
    if sort == "price_asc":
        cursor = cursor.sort("price", 1)
    elif sort == "price_desc":
        cursor = cursor.sort("price", -1)
    elif sort == "rating":
        cursor = cursor.sort("rating", -1)
    else:
        cursor = cursor.sort("createdAt", -1)
    return await cursor.to_list(200)

@api_router.get("/products/trending")
async def trending_products(country: Optional[str] = None):
    query = _country_clause(country) or {}
    items = await db.products.find(query, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
    if not items and query:
        items = await db.products.find({}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)
    return items

@api_router.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return p

@api_router.get("/creators")
async def list_creators(country: Optional[str] = None):
    query = _country_clause(country) or {}
    items = await db.creators.find(query, {"_id": 0}).to_list(100)
    if not items and query:
        items = await db.creators.find({}, {"_id": 0}).to_list(100)
    return items

@api_router.get("/creators/{cid}")
async def get_creator(cid: str):
    c = await db.creators.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Créateur introuvable")
    models = await db.models.find({"creatorId": cid}, {"_id": 0}).to_list(50)
    return {"creator": c, "models": models}

@api_router.get("/models")
async def list_models(category: Optional[str] = None):
    query: dict = {}
    if category and category != "all":
        query["category"] = category
    return await db.models.find(query, {"_id": 0}).sort("indicativePrice", 1).to_list(200)

@api_router.get("/models/{mid}")
async def get_model(mid: str):
    m = await db.models.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Modèle introuvable")
    return m

# ------------------ CART ROUTES ------------------

@api_router.get("/cart")
async def get_cart(user: dict = Depends(current_user)):
    cart = await db.carts.find_one({"userId": user["id"]}, {"_id": 0}) or {"userId": user["id"], "items": []}
    detailed = []
    total = 0.0
    for it in cart.get("items", []):
        p = await db.products.find_one({"id": it["productId"]}, {"_id": 0})
        if p:
            price = p.get("promoPrice") or p["price"]
            line_total = price * it["quantity"]
            total += line_total
            detailed.append({"product": p, "quantity": it["quantity"], "lineTotal": line_total})
    return {"items": detailed, "total": total, "currency": "XAF"}

@api_router.post("/cart/add")
async def add_to_cart(body: AddCartItem, user: dict = Depends(current_user)):
    cart = await db.carts.find_one({"userId": user["id"]})
    if not cart:
        await db.carts.insert_one({"userId": user["id"], "items": [{"productId": body.productId, "quantity": body.quantity}]})
    else:
        items = cart.get("items", [])
        found = False
        for it in items:
            if it["productId"] == body.productId:
                it["quantity"] += body.quantity
                found = True
                break
        if not found:
            items.append({"productId": body.productId, "quantity": body.quantity})
        await db.carts.update_one({"userId": user["id"]}, {"$set": {"items": items}})
    return {"ok": True}

@api_router.post("/cart/update")
async def update_cart(body: AddCartItem, user: dict = Depends(current_user)):
    cart = await db.carts.find_one({"userId": user["id"]}) or {"items": []}
    items = cart.get("items", [])
    items = [it for it in items if it["productId"] != body.productId]
    if body.quantity > 0:
        items.append({"productId": body.productId, "quantity": body.quantity})
    await db.carts.update_one({"userId": user["id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True}

@api_router.post("/cart/clear")
async def clear_cart(user: dict = Depends(current_user)):
    await db.carts.update_one({"userId": user["id"]}, {"$set": {"items": []}}, upsert=True)
    return {"ok": True}

# ------------------ FAVORITES ------------------

@api_router.get("/favorites")
async def get_favorites(user: dict = Depends(current_user)):
    doc = await db.favorites.find_one({"userId": user["id"]}, {"_id": 0}) or {"productIds": []}
    ids = doc.get("productIds", [])
    prods = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    return prods

class FavToggle(BaseModel):
    productId: str

@api_router.post("/favorites/toggle")
async def toggle_fav(body: FavToggle, user: dict = Depends(current_user)):
    pid = body.productId
    doc = await db.favorites.find_one({"userId": user["id"]}) or {"userId": user["id"], "productIds": []}
    ids = doc.get("productIds", [])
    if pid in ids:
        ids.remove(pid)
        added = False
    else:
        ids.append(pid)
        added = True
    await db.favorites.update_one({"userId": user["id"]}, {"$set": {"productIds": ids}}, upsert=True)
    return {"favorited": added}

# ------------------ ORDERS ------------------

@api_router.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(current_user)):
    # Card payment (simulation) — Mobile Money goes through /payments/mobile-money/init
    order = await build_order_from_cart(user, OrderDraft(**body.model_dump(exclude={"paymentMethod"})), body.paymentMethod)
    await db.orders.insert_one(order.copy())
    await decrement_stock(order["items"])
    await db.carts.update_one({"userId": user["id"]}, {"$set": {"items": []}})
    order.pop("_id", None)
    return order

@api_router.get("/orders")
async def list_orders(user: dict = Depends(current_user)):
    return await db.orders.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)

@api_router.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "userId": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if not o.get("statusHistory"):
        o["statusHistory"] = [{"status": o.get("status", "confirmed"), "at": o.get("createdAt")}]
    reviews = await db.reviews.find({"userId": user["id"], "orderId": oid}, {"_id": 0}).to_list(50)
    o["myReviews"] = {r["productId"]: r for r in reviews}
    return o

# ------------------ MESSAGES ------------------

@api_router.get("/conversations")
async def list_conversations(user: dict = Depends(current_user)):
    convs = await db.conversations.find({"participantIds": user["id"]}, {"_id": 0}).sort("updatedAt", -1).to_list(100)
    return convs

@api_router.post("/messages/send")
async def send_message(body: SendMessage, user: dict = Depends(current_user)):
    conv = await db.conversations.find_one({
        "participantIds": {"$all": [user["id"], body.toUserId]}
    })
    now = datetime.now(timezone.utc)
    if not conv:
        conv_id = str(uuid.uuid4())
        conv = {
            "id": conv_id,
            "participantIds": [user["id"], body.toUserId],
            "participants": [
                {"id": user["id"], "name": f"{user.get('firstName','')} {user.get('lastName','')}".strip()},
                {"id": body.toUserId, "name": body.toName},
            ],
            "lastMessage": body.text,
            "updatedAt": now,
        }
        await db.conversations.insert_one(conv.copy())
    else:
        conv_id = conv["id"]
        await db.conversations.update_one({"id": conv_id}, {"$set": {"lastMessage": body.text, "updatedAt": now}})
    msg = {
        "id": str(uuid.uuid4()),
        "conversationId": conv_id,
        "fromUserId": user["id"],
        "fromName": f"{user.get('firstName','')} {user.get('lastName','')}".strip(),
        "text": body.text,
        "createdAt": now,
    }
    await db.messages.insert_one(msg.copy())
    msg.pop("_id", None)
    return msg

@api_router.get("/messages/{conversation_id}")
async def get_messages(conversation_id: str, user: dict = Depends(current_user)):
    return await db.messages.find({"conversationId": conversation_id}, {"_id": 0}).sort("createdAt", 1).to_list(500)

# ------------------ APP WIRING ------------------

@api_router.get("/")
async def root():
    return {"app": "PagneMarket", "status": "ok"}

api_router.include_router(payments_router.router)
api_router.include_router(supplier_router.router)
api_router.include_router(uploads_router.router)
api_router.include_router(reco_router.router)
api_router.include_router(reviews_router.router)
api_router.include_router(ai_looks_router.router)
api_router.include_router(otp_auth_router.router)
app.include_router(api_router)
# Vercel serves this function at /api and sometimes strips that prefix.
app.include_router(uploads_router.router)


@app.middleware("http")
async def vercel_api_prefix(request, call_next):
    path = request.scope.get("path") or ""
    if path and not path.startswith("/api") and path not in ("/docs", "/openapi.json", "/redoc"):
        request.scope["path"] = "/api" + (path if path.startswith("/") else f"/{path}")
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    if hasattr(db, "ready"):
        await db.ready()
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage ready")
    except Exception as e:  # noqa: BLE001
        logger.warning("Object storage init failed: %s", e)

@app.on_event("shutdown")
async def shutdown_db_client():
    close = getattr(client, "aclose", None)
    if close:
        await close()
    elif hasattr(client, "close"):
        client.close()
