"""Personalised recommendations ("Pour vous") from product views + favorites."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from deps import current_user, db

router = APIRouter()


class ViewIn(BaseModel):
    productId: str


@router.post("/events/view")
async def track_view(body: ViewIn, user: dict = Depends(current_user)):
    await db.product_views.update_one(
        {"userId": user["id"], "productId": body.productId},
        {"$inc": {"count": 1}, "$set": {"lastViewedAt": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/recommendations")
async def recommendations(user: dict = Depends(current_user)):
    views = await db.product_views.find({"userId": user["id"]}, {"_id": 0}).sort("lastViewedAt", -1).to_list(50)
    fav_doc = await db.favorites.find_one({"userId": user["id"]}, {"_id": 0}) or {}
    fav_ids = fav_doc.get("productIds", [])
    viewed_ids = [v["productId"] for v in views]
    seed_ids = list(dict.fromkeys(fav_ids + viewed_ids))
    if not seed_ids:
        return {"items": [], "basis": None}

    seeds = await db.products.find({"id": {"$in": seed_ids}}, {"_id": 0}).to_list(100)
    cat_w: dict = {}
    tag_w: dict = {}
    sup_w: dict = {}
    view_count = {v["productId"]: v.get("count", 1) for v in views}
    for s in seeds:
        w = (3.0 if s["id"] in fav_ids else 0.0) + min(view_count.get(s["id"], 0), 5) * 1.0
        cat_w[s["category"]] = cat_w.get(s["category"], 0) + w
        sup_w[s.get("supplierId")] = sup_w.get(s.get("supplierId"), 0) + w * 0.5
        for t in s.get("tags", []):
            tag_w[t] = tag_w.get(t, 0) + w * 0.4

    exclude = set(fav_ids) | set(viewed_ids[:3])
    candidates = await db.products.find({"id": {"$nin": list(exclude)}}, {"_id": 0}).to_list(500)
    scored = []
    for p in candidates:
        score = cat_w.get(p["category"], 0) + sup_w.get(p.get("supplierId"), 0)
        score += sum(tag_w.get(t, 0) for t in p.get("tags", []))
        score += (p.get("rating") or 0) * 0.3
        if p.get("promoPrice"):
            score += 0.5
        if score > 0.5:
            scored.append((score, p))
    scored.sort(key=lambda x: x[0], reverse=True)

    top_cat = max(cat_w.items(), key=lambda x: x[1])[0] if cat_w else None
    cat_doc = await db.categories.find_one({"slug": top_cat}, {"_id": 0}) if top_cat else None
    return {
        "items": [p for _, p in scored[:10]],
        "basis": {
            "topCategory": (cat_doc or {}).get("name") or top_cat,
            "favorites": len(fav_ids),
            "views": len(viewed_ids),
        },
    }
