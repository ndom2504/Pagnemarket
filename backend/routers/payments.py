"""Mobile Money payments (Orange, MTN, Moov) via CinetPay, with simulation fallback when keys are absent."""
import logging
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from deps import current_user, db, decrement_stock, public_base_url, push_order_status, status_entry

logger = logging.getLogger("pagnemarket.payments")
router = APIRouter()

CINETPAY_PAYMENT = "https://api-checkout.cinetpay.com/v2/payment"
CINETPAY_CHECK = "https://api-checkout.cinetpay.com/v2/payment/check"
SIMULATION_DELAY_S = 6

COUNTRY_CODES = {
    "côte d'ivoire": ("CI", "XOF"), "cote d'ivoire": ("CI", "XOF"), "cameroun": ("CM", "XAF"),
    "sénégal": ("SN", "XOF"), "senegal": ("SN", "XOF"), "burkina faso": ("BF", "XOF"),
    "mali": ("ML", "XOF"), "togo": ("TG", "XOF"), "bénin": ("BJ", "XOF"), "benin": ("BJ", "XOF"),
    "guinée": ("GN", "GNF"), "gabon": ("GA", "XAF"), "congo": ("CG", "XAF"), "niger": ("NE", "XOF"),
}

OPERATORS = {
    "orange": "Orange Money",
    "mtn": "MTN Mobile Money",
    "moov": "Moov Money",
}


def cinetpay_config() -> Optional[dict]:
    api_key = (os.environ.get("CINETPAY_APIKEY") or "").strip()
    site_id = (os.environ.get("CINETPAY_SITE_ID") or "").strip()
    if api_key and site_id:
        return {"apikey": api_key, "site_id": site_id}
    return None


class OrderDraft(BaseModel):
    address: str
    city: str
    country: str
    phone: str


class MobileMoneyInit(OrderDraft):
    operator: Literal["orange", "mtn", "moov"]
    momoPhone: str


async def build_order_from_cart(user: dict, body: OrderDraft, payment_method: str) -> dict:
    cart = await db.carts.find_one({"userId": user["id"]}) or {"items": []}
    if not cart.get("items"):
        raise HTTPException(400, "Panier vide")
    items, total = [], 0.0
    for it in cart["items"]:
        p = await db.products.find_one({"id": it["productId"]}, {"_id": 0})
        if not p:
            continue
        price = p.get("promoPrice") or p["price"]
        line_total = price * it["quantity"]
        total += line_total
        items.append({
            "productId": p["id"],
            "name": p["name"],
            "image": p["images"][0] if p.get("images") else None,
            "quantity": it["quantity"],
            "price": price,
            "category": p.get("category"),
            "supplierId": p.get("supplierId"),
            "supplierName": p.get("supplierName"),
        })
    if not items:
        raise HTTPException(400, "Panier vide")
    return {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "customerName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "items": items,
        "supplierIds": sorted({i["supplierId"] for i in items if i.get("supplierId")}),
        "total": total,
        "currency": "XAF",
        "status": "confirmed",
        "paymentStatus": "paid",
        "address": body.address,
        "city": body.city,
        "country": body.country,
        "phone": body.phone,
        "paymentMethod": payment_method,
        "statusHistory": [status_entry("confirmed")],
        "createdAt": datetime.now(timezone.utc),
    }


async def mark_order_paid(payment: dict):
    now = datetime.now(timezone.utc)
    res = await db.payments.update_one(
        {"transactionId": payment["transactionId"], "status": {"$ne": "PAID"}},
        {"$set": {"status": "PAID", "updatedAt": now}},
    )
    if res.modified_count:
        await push_order_status({"id": payment["orderId"]}, "confirmed", {"paymentStatus": "paid", "paidAt": now})
        order = await db.orders.find_one({"id": payment["orderId"]}, {"_id": 0, "items": 1})
        if order:
            await decrement_stock(order.get("items", []))
        await db.carts.update_one({"userId": payment["userId"]}, {"$set": {"items": []}})


async def mark_order_failed(payment: dict):
    await db.payments.update_one({"transactionId": payment["transactionId"]}, {"$set": {"status": "FAILED"}})
    await push_order_status({"id": payment["orderId"]}, "cancelled", {"paymentStatus": "failed"})


async def verify_with_cinetpay(cfg: dict, transaction_id: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(CINETPAY_CHECK, json={**cfg, "transaction_id": transaction_id})
    return r.json()


async def refresh_payment(payment: dict) -> dict:
    """Refresh status from CinetPay (or simulate), apply side effects, return updated payment."""
    if payment["status"] in ("PAID", "FAILED"):
        return payment
    if payment["mode"] == "simulation":
        elapsed = (datetime.now(timezone.utc) - payment["createdAt"].replace(tzinfo=timezone.utc)).total_seconds()
        if elapsed >= SIMULATION_DELAY_S:
            await mark_order_paid(payment)
    else:
        cfg = cinetpay_config()
        if cfg:
            data = (await verify_with_cinetpay(cfg, payment["transactionId"])).get("data", {}) or {}
            gw = data.get("status")
            if gw == "ACCEPTED":
                await mark_order_paid(payment)
            elif gw == "REFUSED":
                await mark_order_failed(payment)
            else:
                await db.payments.update_one({"transactionId": payment["transactionId"]}, {"$set": {"gatewayStatus": gw}})
    return await db.payments.find_one({"transactionId": payment["transactionId"]}, {"_id": 0})


@router.get("/payments/config")
async def payments_config():
    return {"mobileMoneyMode": "live" if cinetpay_config() else "simulation", "operators": OPERATORS}


@router.post("/payments/mobile-money/init")
async def init_mobile_money(body: MobileMoneyInit, request: Request, user: dict = Depends(current_user)):
    order = await build_order_from_cart(user, body, f"mobile_money_{body.operator}")
    order["status"] = "pending_payment"
    order["paymentStatus"] = "pending"
    order["statusHistory"] = [status_entry("pending_payment")]
    await db.orders.insert_one(order.copy())

    mapped = COUNTRY_CODES.get(body.country.strip().lower())
    if mapped:
        country_code, currency = mapped
    else:
        from countries import iso_for_country
        country_code, currency = iso_for_country(body.country), "XOF"
    amount = int(math.ceil(order["total"] / 5.0) * 5)
    transaction_id = f"pm_{uuid.uuid4().hex}"
    cfg = cinetpay_config()
    payment = {
        "transactionId": transaction_id,
        "orderId": order["id"],
        "userId": user["id"],
        "amount": amount,
        "currency": currency,
        "operator": body.operator,
        "operatorLabel": OPERATORS[body.operator],
        "momoPhone": body.momoPhone,
        "status": "PENDING",
        "mode": "cinetpay" if cfg else "simulation",
        "paymentUrl": None,
        "createdAt": datetime.now(timezone.utc),
    }

    if cfg:
        base = public_base_url(request)
        payload = {
            **cfg,
            "transaction_id": transaction_id,
            "amount": amount,
            "currency": currency,
            "description": f"PagneMarket commande {order['id'][:8]}",
            "notify_url": f"{base}/api/payments/cinetpay/webhook",
            "return_url": f"{base}/api/payments/return",
            "channels": "MOBILE_MONEY",
            "lang": "fr",
            "metadata": order["id"],
            "customer_name": user.get("firstName", "Client"),
            "customer_surname": user.get("lastName", "PagneMarket"),
            "customer_phone_number": body.momoPhone,
            "customer_country": country_code,
            "customer_email": user.get("email", ""),
            "customer_address": body.address,
            "customer_city": body.city,
        }
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post(CINETPAY_PAYMENT, json=payload)
            result = r.json()
        except Exception:  # noqa: BLE001
            logger.exception("CinetPay init error")
            result = {}
        if str(result.get("code")) != "201":
            logger.error("CinetPay init failed: %s", result)
            await push_order_status({"id": order["id"]}, "cancelled", {"paymentStatus": "failed"})
            raise HTTPException(502, result.get("description") or "Initialisation du paiement Mobile Money échouée")
        payment["paymentUrl"] = result["data"]["payment_url"]
        payment["paymentToken"] = result["data"].get("payment_token")

    await db.payments.insert_one(payment.copy())
    payment.pop("_id", None)
    return {
        "transactionId": transaction_id,
        "orderId": order["id"],
        "amount": amount,
        "currency": currency,
        "operator": body.operator,
        "mode": payment["mode"],
        "paymentUrl": payment["paymentUrl"],
        "status": "PENDING",
    }


@router.get("/payments/{transaction_id}/status")
async def payment_status(transaction_id: str, user: dict = Depends(current_user)):
    payment = await db.payments.find_one({"transactionId": transaction_id, "userId": user["id"]}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Paiement introuvable")
    payment = await refresh_payment(payment)
    return {
        "transactionId": transaction_id,
        "orderId": payment["orderId"],
        "status": payment["status"],
        "mode": payment["mode"],
        "operator": payment["operator"],
        "amount": payment["amount"],
        "currency": payment["currency"],
    }


@router.api_route("/payments/cinetpay/webhook", methods=["GET", "POST"])
async def cinetpay_webhook(request: Request):
    if request.method == "GET":
        return {"ok": True}
    form = await request.form()
    transaction_id = form.get("cpm_trans_id")
    cfg = cinetpay_config()
    if not transaction_id or not cfg or str(form.get("cpm_site_id", "")) != str(cfg["site_id"]):
        raise HTTPException(400, "Notification invalide")
    payment = await db.payments.find_one({"transactionId": transaction_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Transaction inconnue")
    if payment["status"] == "PAID":
        return {"ok": True}
    data = (await verify_with_cinetpay(cfg, transaction_id)).get("data", {}) or {}
    if str(data.get("amount")) != str(payment["amount"]) or data.get("currency") != payment["currency"]:
        raise HTTPException(409, "Montant/devise incompatibles")
    if data.get("status") == "ACCEPTED":
        await mark_order_paid(payment)
    elif data.get("status") == "REFUSED":
        await mark_order_failed(payment)
    return {"ok": True}


@router.get("/payments/return", response_class=HTMLResponse)
async def payment_return():
    return """<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PagneMarket</title></head><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#FAF8F3;color:#111;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-weight:500">Paiement transmis</h1><p>Vous pouvez fermer cette fenêtre et revenir dans l'application PagneMarket.</p></div></body></html>"""
