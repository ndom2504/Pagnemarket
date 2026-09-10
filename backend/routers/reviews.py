"""Product reviews: buyers rate fabrics after delivery."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import current_user, db

router = APIRouter()


class ReviewIn(BaseModel):
    productId: str
    orderId: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)


@router.post("/reviews")
async def create_review(body: ReviewIn, user: dict = Depends(current_user)):
    order = await db.orders.find_one({"id": body.orderId, "userId": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    if order.get("status") != "delivered":
        raise HTTPException(400, "Vous pourrez noter ce tissu une fois la commande livrée")
    if not any(i["productId"] == body.productId for i in order.get("items", [])):
        raise HTTPException(400, "Ce tissu ne fait pas partie de la commande")
    if await db.reviews.find_one({"userId": user["id"], "orderId": body.orderId, "productId": body.productId}):
        raise HTTPException(400, "Vous avez déjà noté ce tissu pour cette commande")

    product = await db.products.find_one({"id": body.productId}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produit introuvable")

    review = {
        "id": str(uuid.uuid4()),
        "productId": body.productId,
        "orderId": body.orderId,
        "userId": user["id"],
        "userName": f"{user.get('firstName', '')} {user.get('lastName', '')[:1]}.".strip(),
        "supplierId": product.get("supplierId"),
        "rating": body.rating,
        "comment": (body.comment or "").strip() or None,
        "createdAt": datetime.now(timezone.utc),
    }
    await db.reviews.insert_one(review.copy())

    # Incremental average (works on top of seeded rating/reviewsCount)
    count = int(product.get("reviewsCount") or 0)
    rating = float(product.get("rating") or 0)
    new_count = count + 1
    new_rating = round((rating * count + body.rating) / new_count, 2)
    await db.products.update_one({"id": body.productId}, {"$set": {"rating": new_rating, "reviewsCount": new_count}})

    review.pop("_id", None)
    return review


@router.get("/products/{pid}/reviews")
async def product_reviews(pid: str):
    reviews = await db.reviews.find({"productId": pid}, {"_id": 0}).sort("createdAt", -1).to_list(50)
    dist = {str(i): 0 for i in range(1, 6)}
    for r in reviews:
        dist[str(r["rating"])] += 1
    return {"items": reviews, "count": len(reviews), "distribution": dist}


@router.get("/supplier/reviews")
async def supplier_reviews(user: dict = Depends(current_user)):
    return await db.reviews.find({"supplierId": user["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(100)
