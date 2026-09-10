from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt

from deps import client, db, create_token, current_user
from routers import payments as payments_router
from routers import supplier as supplier_router
from routers import uploads as uploads_router
from routers import reco as reco_router
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
    firstName: str
    lastName: str
    email: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    roles: List[str]
    avatar: Optional[str] = None
    shopName: Optional[str] = None
    createdAt: datetime

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
    return {
        "id": u["id"],
        "firstName": u.get("firstName", ""),
        "lastName": u.get("lastName", ""),
        "email": u["email"],
        "phone": u.get("phone"),
        "country": u.get("country"),
        "city": u.get("city"),
        "roles": u.get("roles", ["buyer"]),
        "avatar": u.get("avatar"),
        "shopName": u.get("shopName"),
        "createdAt": u.get("createdAt", datetime.now(timezone.utc)),
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
    await db.users.insert_one(user_doc)
    return {"token": create_token(uid), "user": user_public(user_doc)}

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    return {"token": create_token(user["id"]), "user": user_public(user)}

@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return user_public(user)

# ------------------ CATALOG ROUTES ------------------

@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    return cats

@api_router.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None, sort: Optional[str] = None):
    query: dict = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
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
async def trending_products():
    return await db.products.find({}, {"_id": 0}).sort("rating", -1).limit(8).to_list(8)

@api_router.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return p

@api_router.get("/creators")
async def list_creators():
    return await db.creators.find({}, {"_id": 0}).to_list(100)

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
    await db.carts.update_one({"userId": user["id"]}, {"$set": {"items": []}})
    order.pop("_id", None)
    return order

@api_router.get("/orders")
async def list_orders(user: dict = Depends(current_user)):
    return await db.orders.find({"userId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)

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

# ------------------ SEED ------------------

async def seed_database():
    # Ensure demo buyer exists (idempotent)
    demo_email = "demo@pagnemarket.com"
    if not await db.users.find_one({"email": demo_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "firstName": "Demo",
            "lastName": "User",
            "email": demo_email,
            "phone": None,
            "passwordHash": hash_password("Demo1234!"),
            "country": "Gabon",
            "city": "Libreville",
            "roles": ["buyer"],
            "avatar": None,
            "createdAt": datetime.now(timezone.utc),
        })
        logger.info("Demo user seeded: %s", demo_email)

    # Demo supplier (owns "Maison Adjoua" products, id v1)
    supplier_email = "fournisseur@pagnemarket.com"
    if not await db.users.find_one({"email": supplier_email}):
        await db.users.insert_one({
            "id": "v1",
            "firstName": "Adjoua",
            "lastName": "Kouassi",
            "email": supplier_email,
            "phone": "+241 06 00 00 00",
            "passwordHash": hash_password("Fournisseur1234!"),
            "country": "Gabon",
            "city": "Libreville",
            "roles": ["supplier"],
            "shopName": "Maison Adjoua",
            "avatar": None,
            "createdAt": datetime.now(timezone.utc),
        })
        logger.info("Demo supplier seeded: %s", supplier_email)

    # Migration vendor -> supplier (naming change)
    await db.users.update_many({"roles": "vendor"}, {"$set": {"roles.$": "supplier"}})
    await db.products.update_many({"vendorId": {"$exists": True}}, {"$rename": {"vendorId": "supplierId", "vendorName": "supplierName"}})

    if await db.categories.count_documents({}) == 0:
        await seed_catalog()
    await seed_demo_orders()


async def seed_demo_orders():
    """A few paid orders for the demo supplier so the dashboard has data (idempotent)."""
    if await db.orders.count_documents({"seeded": True}) > 0:
        return
    buyer = await db.users.find_one({"email": "demo@pagnemarket.com"}, {"_id": 0})
    products = await db.products.find({"supplierId": "v1"}, {"_id": 0}).to_list(10)
    if not buyer or not products:
        return
    now = datetime.now(timezone.utc)
    plan = [
        (0, [(0, 2)], "confirmed", "mobile_money_orange"),
        (0, [(1, 1)], "processing", "card"),
        (1, [(0, 1), (2, 1)], "shipped", "mobile_money_mtn"),
        (2, [(2, 3)], "delivered", "mobile_money_moov"),
        (4, [(1, 2)], "delivered", "card"),
        (6, [(0, 1)], "delivered", "mobile_money_orange"),
    ]
    docs = []
    for days_ago, lines, status, method in plan:
        items = []
        for idx, qty in lines:
            p = products[idx % len(products)]
            items.append({
                "productId": p["id"], "name": p["name"], "image": p["images"][0] if p.get("images") else None,
                "quantity": qty, "price": p.get("promoPrice") or p["price"], "category": p["category"],
                "supplierId": "v1", "supplierName": p["supplierName"],
            })
        created = now - timedelta(days=days_ago, hours=2 if days_ago else 0)
        if days_ago == 0 and created.hour < 2:
            created = now
        docs.append({
            "id": str(uuid.uuid4()), "userId": buyer["id"], "customerName": "Demo User", "items": items,
            "supplierIds": ["v1"], "total": sum(i["price"] * i["quantity"] for i in items), "currency": "XAF",
            "status": status, "paymentStatus": "paid", "address": "Quartier Louis", "city": "Libreville",
            "country": "Gabon", "phone": "+241 07 00 00 00", "paymentMethod": method, "createdAt": created, "seeded": True,
        })
    await db.orders.insert_many(docs)
    logger.info("Seeded %d demo orders", len(docs))


async def seed_catalog():
    logger.info("Seeding PagneMarket database…")
    categories = [
        {"id": str(uuid.uuid4()), "slug": "wax", "name": "Pagne Wax", "image": "https://images.unsplash.com/photo-1552710307-537199cd41c0?w=600&q=80"},
        {"id": str(uuid.uuid4()), "slug": "bazin", "name": "Bazin", "image": "https://images.unsplash.com/photo-1596939454008-ecff9c3d1eb2?w=600&q=80"},
        {"id": str(uuid.uuid4()), "slug": "kente", "name": "Kente", "image": "https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=600&q=80"},
        {"id": str(uuid.uuid4()), "slug": "bogolan", "name": "Bogolan", "image": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80"},
        {"id": str(uuid.uuid4()), "slug": "vlisco", "name": "Vlisco", "image": "https://images.unsplash.com/photo-1610030006636-a4d5b8a8f5e2?w=600&q=80"},
        {"id": str(uuid.uuid4()), "slug": "accessoires", "name": "Accessoires", "image": "https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=600&q=80"},
    ]
    await db.categories.insert_many([c.copy() for c in categories])

    suppliers = [
        {"id": "v1", "name": "Maison Adjoua"},
        {"id": "v2", "name": "Sahel Textiles"},
        {"id": "v3", "name": "Cotonou Fabric House"},
        {"id": "v4", "name": "Kwame & Fils"},
        {"id": "v5", "name": "Atelier Dakar"},
    ]
    locations = ["Libreville, Gabon", "Douala, Cameroun", "Abidjan, Côte d'Ivoire", "Dakar, Sénégal", "Cotonou, Bénin"]

    fabric_images = [
        "https://images.unsplash.com/photo-1552710307-537199cd41c0?w=800&q=80",
        "https://images.unsplash.com/photo-1596939454008-ecff9c3d1eb2?w=800&q=80",
        "https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=800&q=80",
        "https://images.unsplash.com/photo-1610030006636-a4d5b8a8f5e2?w=800&q=80",
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80",
        "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80",
        "https://images.unsplash.com/photo-1583334391651-4a19c1a3aef7?w=800&q=80",
        "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=800&q=80",
        "https://images.unsplash.com/photo-1768212566108-4ce4f329e4d2?w=800&q=80",
    ]
    names = [
        ("Wax Royal Éclat", "wax", 12000),
        ("Bazin Riche Nuit d'ivoire", "bazin", 28000),
        ("Kente Doré Ashanti", "kente", 22000),
        ("Bogolan Terre de Bamako", "bogolan", 15000),
        ("Vlisco Élégance", "vlisco", 35000),
        ("Wax Fleur d'Hibiscus", "wax", 9500),
        ("Kente Feu Ancestral", "kente", 24000),
        ("Bazin Perle Blanche", "bazin", 26000),
        ("Wax Tropical", "wax", 11000),
        ("Bogolan Symboles", "bogolan", 16500),
        ("Wax Pointe Noire", "wax", 10500),
        ("Vlisco Or Rouge", "vlisco", 38000),
    ]
    products = []
    for i, (nm, cat, price) in enumerate(names):
        supplier = suppliers[i % len(suppliers)]
        products.append({
            "id": str(uuid.uuid4()),
            "name": nm,
            "description": "Tissu authentique tissé à la main, motifs riches et couleurs profondes. Idéal pour tenues de cérémonie, robes et boubous d'exception.",
            "category": cat,
            "price": float(price),
            "currency": "XAF",
            "promoPrice": float(price * 0.85) if i % 4 == 0 else None,
            "stock": 15 + i,
            "images": [fabric_images[i % len(fabric_images)], fabric_images[(i + 3) % len(fabric_images)]],
            "supplierId": supplier["id"],
            "supplierName": supplier["name"],
            "location": locations[i % len(locations)],
            "rating": round(4.3 + (i % 5) * 0.12, 2),
            "reviewsCount": 20 + i * 3,
            "tags": [cat, "authentique", "premium"],
            "createdAt": datetime.now(timezone.utc),
        })
    await db.products.insert_many([p.copy() for p in products])

    creator_covers = [
        "https://images.unsplash.com/photo-1760907949889-eb62b7fd9f75?w=1200&q=80",
        "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=1200&q=80",
        "https://images.unsplash.com/photo-1583334391651-4a19c1a3aef7?w=1200&q=80",
        "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1200&q=80",
    ]
    creator_avatars = [
        "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80",
    ]
    creators = [
        {"id": "c1", "name": "Aïcha Diallo", "city": "Dakar", "country": "Sénégal", "specialty": "Robes de cérémonie", "yearsExperience": 12, "rating": 4.9, "modelsCount": 8, "ordersCount": 240, "bio": "Créatrice pionnière de la mode africaine contemporaine, Aïcha marie tradition et lignes épurées.", "avatar": creator_avatars[0], "cover": creator_covers[0]},
        {"id": "c2", "name": "Kwame Mensah", "city": "Accra", "country": "Ghana", "specialty": "Tenues Kente modernes", "yearsExperience": 8, "rating": 4.8, "modelsCount": 6, "ordersCount": 180, "bio": "Spécialiste du Kente revisité pour l'homme urbain africain.", "avatar": creator_avatars[1], "cover": creator_covers[1]},
        {"id": "c3", "name": "Mariame Coulibaly", "city": "Bamako", "country": "Mali", "specialty": "Boubous & Bogolan", "yearsExperience": 15, "rating": 4.9, "modelsCount": 10, "ordersCount": 320, "bio": "Ambassadrice du Bogolan malien, elle crée des pièces uniques inspirées des symboles ancestraux.", "avatar": creator_avatars[2], "cover": creator_covers[2]},
        {"id": "c4", "name": "Chiamaka Okafor", "city": "Lagos", "country": "Nigeria", "specialty": "Ankara couture", "yearsExperience": 10, "rating": 4.7, "modelsCount": 7, "ordersCount": 210, "bio": "Ankara couture d'exception, mariage entre héritage yoruba et coupes internationales.", "avatar": creator_avatars[3], "cover": creator_covers[3]},
    ]
    await db.creators.insert_many([c.copy() for c in creators])

    model_images = [
        "https://images.unsplash.com/photo-1760907949889-eb62b7fd9f75?w=800&q=80",
        "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=800&q=80",
        "https://images.unsplash.com/photo-1583334391651-4a19c1a3aef7?w=800&q=80",
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80",
        "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80",
    ]
    models_data = [
        ("Robe Djénéba", "Robes", 45000, "c1"),
        ("Ensemble Boubou Royal", "Boubous", 62000, "c3"),
        ("Chemise Kente Urbain", "Chemises", 28000, "c2"),
        ("Robe de mariage Aïcha", "Mariage", 180000, "c1"),
        ("Tenue Cérémonie Bogolan", "Cérémonie", 75000, "c3"),
        ("Ensemble Ankara Executive", "Ensembles", 55000, "c4"),
        ("Pantalon Wax Slim", "Pantalons", 22000, "c2"),
        ("Robe Bogolan Moderne", "Robes", 48000, "c3"),
        ("Boubou Homme Prestige", "Boubous", 68000, "c4"),
        ("Robe Enfant Fleurie", "Enfants", 18000, "c1"),
    ]
    models = []
    for i, (nm, cat, price, cid) in enumerate(models_data):
        creator = next(c for c in creators if c["id"] == cid)
        models.append({
            "id": str(uuid.uuid4()),
            "name": nm,
            "creatorId": cid,
            "creatorName": creator["name"],
            "category": cat,
            "description": "Modèle unique confectionné à la main, coupe contemporaine et détails soignés. Peut être adapté à vos mesures.",
            "indicativePrice": float(price),
            "currency": "XAF",
            "difficulty": ["Intermédiaire", "Avancé", "Expert"][i % 3],
            "image": model_images[i % len(model_images)],
            "fabricRecommendation": ["Wax", "Kente", "Bogolan", "Bazin"][i % 4],
        })
    await db.models.insert_many([m.copy() for m in models])
    logger.info("Seed complete: %d products, %d models, %d creators.", len(products), len(models), len(creators))

# ------------------ APP WIRING ------------------

@api_router.get("/")
async def root():
    return {"app": "PagneMarket", "status": "ok"}

api_router.include_router(payments_router.router)
api_router.include_router(supplier_router.router)
api_router.include_router(uploads_router.router)
api_router.include_router(reco_router.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await seed_database()
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage ready")
    except Exception as e:  # noqa: BLE001
        logger.warning("Object storage init failed: %s", e)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
