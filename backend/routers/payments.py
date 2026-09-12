"""Payments: Mobile Money (CinetPay) + Stripe Checkout (card)."""
import logging
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import httpx
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from deps import (
    current_user,
    db,
    decrement_stock,
    notify_suppliers_new_order,
    public_base_url,
    push_order_status,
    status_entry,
)

logger = logging.getLogger("pagnemarket.payments")
router = APIRouter()

CINETPAY_PAYMENT = "https://api-checkout.cinetpay.com/v2/payment"
CINETPAY_CHECK = "https://api-checkout.cinetpay.com/v2/payment/check"
SIMULATION_DELAY_S = 6
SHIPPING_FEE_XAF = 2500
PAID_LIKE = ("PAID", "SUCCEEDED")
PLATFORM_COMMISSION_RATE = 0.10  # informational only — no Stripe Connect payouts

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


def stripe_secret_key() -> Optional[str]:
    key = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    return key or None


def stripe_webhook_secret() -> Optional[str]:
    return (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip() or None


def stripe_publishable_key() -> Optional[str]:
    return (os.environ.get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") or "").strip() or None


def configure_stripe() -> str:
    secret = stripe_secret_key()
    if not secret:
        raise HTTPException(503, "STRIPE_SECRET_KEY manquante")
    stripe.api_key = secret
    return secret


class OrderDraft(BaseModel):
    address: str
    city: str
    country: str
    phone: str


class MobileMoneyInit(OrderDraft):
    operator: Literal["orange", "mtn", "moov"]
    momoPhone: str


class StripeCheckoutInit(OrderDraft):
    pass


async def build_order_from_cart(user: dict, body: OrderDraft, payment_method: str) -> dict:
    cart = await db.carts.find_one({"userId": user["id"]}) or {"items": []}
    if not cart.get("items"):
        raise HTTPException(400, "Panier vide")
    items, subtotal = [], 0.0
    for it in cart["items"]:
        qty = int(it.get("quantity") or 0)
        if qty < 1:
            continue
        p = await db.products.find_one({"id": it["productId"]}, {"_id": 0})
        if not p:
            continue
        stock = int(p.get("stock") or 0)
        if stock < qty:
            raise HTTPException(400, f"Stock insuffisant pour « {p.get('name', 'produit')} » (dispo {stock})")
        price = float(p.get("promoPrice") or p["price"])
        if price <= 0:
            raise HTTPException(400, f"Prix invalide pour « {p.get('name')} »")
        line_total = price * qty
        subtotal += line_total
        items.append({
            "productId": p["id"],
            "name": p["name"],
            "image": p["images"][0] if p.get("images") else None,
            "quantity": qty,
            "price": price,
            "category": p.get("category"),
            "supplierId": p.get("supplierId"),
            "supplierName": p.get("supplierName"),
        })
    if not items:
        raise HTTPException(400, "Panier vide")
    shipping = SHIPPING_FEE_XAF if items else 0
    total = subtotal + shipping
    return {
        "id": str(uuid.uuid4()),
        "userId": user["id"],
        "customerName": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "items": items,
        "supplierIds": sorted({i["supplierId"] for i in items if i.get("supplierId")}),
        "subtotal": subtotal,
        "shippingFee": shipping,
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


def _payment_is_paid(payment: dict) -> bool:
    return payment.get("status") in PAID_LIKE


async def mark_order_paid(payment: dict, *, provider_payment_id: Optional[str] = None):
    if _payment_is_paid(payment):
        return
    now = datetime.now(timezone.utc)
    paid_status = "SUCCEEDED" if payment.get("mode") == "stripe" else "PAID"
    patch = {"status": paid_status, "updatedAt": now, "paidAt": now}
    if provider_payment_id:
        patch["providerPaymentId"] = provider_payment_id
    res = await db.payments.update_one(
        {"transactionId": payment["transactionId"], "status": {"$nin": list(PAID_LIKE)}},
        {"$set": patch},
    )
    if res.modified_count:
        await push_order_status({"id": payment["orderId"]}, "confirmed", {"paymentStatus": "paid", "paidAt": now})
        order = await db.orders.find_one({"id": payment["orderId"]}, {"_id": 0})
        if order:
            await decrement_stock(order.get("items", []))
            await notify_suppliers_new_order(order)
        await db.carts.update_one({"userId": payment["userId"]}, {"$set": {"items": []}})


async def mark_order_failed(payment: dict):
    if _payment_is_paid(payment):
        return
    await db.payments.update_one(
        {"transactionId": payment["transactionId"]},
        {"$set": {"status": "FAILED", "updatedAt": datetime.now(timezone.utc)}},
    )
    await push_order_status({"id": payment["orderId"]}, "cancelled", {"paymentStatus": "failed"})


async def mark_order_refunded(payment: dict):
    now = datetime.now(timezone.utc)
    await db.payments.update_one(
        {"transactionId": payment["transactionId"]},
        {"$set": {"status": "REFUNDED", "updatedAt": now, "refundedAt": now}},
    )
    await push_order_status({"id": payment["orderId"]}, "cancelled", {"paymentStatus": "refunded"})


async def already_processed_event(event_id: str) -> bool:
    existing = await db.stripe_events.find_one({"id": event_id}, {"_id": 0, "id": 1})
    return bool(existing)


async def remember_event(event_id: str, event_type: str):
    await db.stripe_events.insert_one({
        "id": event_id,
        "type": event_type,
        "processedAt": datetime.now(timezone.utc),
    })


async def verify_with_cinetpay(cfg: dict, transaction_id: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(CINETPAY_CHECK, json={**cfg, "transaction_id": transaction_id})
    return r.json()


async def refresh_payment(payment: dict) -> dict:
    """Refresh status from gateway (or simulate), apply side effects, return updated payment."""
    if _payment_is_paid(payment) or payment.get("status") in ("FAILED", "REFUNDED"):
        return payment
    if payment.get("mode") == "stripe":
        configure_stripe()
        session_id = payment.get("providerSessionId") or payment.get("stripeSessionId")
        if session_id:
            try:
                session = stripe.checkout.Session.retrieve(session_id)
                if session.payment_status == "paid":
                    await mark_order_paid(payment, provider_payment_id=session.payment_intent)
                elif session.status == "expired":
                    await mark_order_failed(payment)
            except Exception:  # noqa: BLE001
                logger.exception("Stripe session refresh failed")
        return await db.payments.find_one({"transactionId": payment["transactionId"]}, {"_id": 0})
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
    stripe_ok = bool(stripe_secret_key())
    return {
        "mobileMoneyMode": "live" if cinetpay_config() else "simulation",
        "operators": OPERATORS,
        "stripeEnabled": stripe_ok,
        "stripePublishableKey": stripe_publishable_key() if stripe_ok else None,
        "shippingFee": SHIPPING_FEE_XAF,
        "currency": "XAF",
    }


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
        "provider": "cinetpay" if cfg else "simulation",
        "operator": body.operator,
        "operatorLabel": OPERATORS[body.operator],
        "momoPhone": body.momoPhone,
        "status": "PENDING",
        "mode": "cinetpay" if cfg else "simulation",
        "paymentMethod": f"mobile_money_{body.operator}",
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
    status = payment["status"]
    if status in PAID_LIKE:
        status = "PAID"
    return {
        "transactionId": transaction_id,
        "orderId": payment["orderId"],
        "status": status,
        "mode": payment.get("mode"),
        "operator": payment.get("operator"),
        "amount": payment["amount"],
        "currency": payment["currency"],
        "provider": payment.get("provider"),
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
    if payment["status"] in PAID_LIKE:
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


# ------------------ STRIPE CHECKOUT ------------------

@router.post("/payments/stripe/checkout")
async def init_stripe_checkout(body: StripeCheckoutInit, request: Request, user: dict = Depends(current_user)):
    configure_stripe()
    order = await build_order_from_cart(user, body, "card")
    order["status"] = "pending_payment"
    order["paymentStatus"] = "pending"
    order["statusHistory"] = [status_entry("pending_payment")]
    await db.orders.insert_one(order.copy())

    amount = int(round(order["total"]))
    if amount < 100:
        await push_order_status({"id": order["id"]}, "cancelled", {"paymentStatus": "failed"})
        raise HTTPException(400, "Montant trop faible pour Stripe")

    transaction_id = f"st_{uuid.uuid4().hex}"
    base = public_base_url(request)
    line_items = []
    for it in order["items"]:
        unit = int(round(float(it["price"])))
        if unit < 1:
            continue
        line_items.append({
            "price_data": {
                "currency": "xaf",
                "unit_amount": unit,
                "product_data": {
                    "name": (it.get("name") or "Article PagneMarket")[:120],
                },
            },
            "quantity": int(it["quantity"]),
        })
    if order.get("shippingFee"):
        line_items.append({
            "price_data": {
                "currency": "xaf",
                "unit_amount": int(order["shippingFee"]),
                "product_data": {"name": "Livraison"},
            },
            "quantity": 1,
        })
    if not line_items:
        await push_order_status({"id": order["id"]}, "cancelled", {"paymentStatus": "failed"})
        raise HTTPException(400, "Aucun article payable")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=line_items,
            success_url=f"{base}/api/payments/stripe/return?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base}/api/payments/stripe/cancel?order_id={order['id']}&transaction_id={transaction_id}",
            client_reference_id=order["id"],
            customer_email=user.get("email") or None,
            metadata={
                "orderId": order["id"],
                "userId": user["id"],
                "transactionId": transaction_id,
                "app": "pagnemarket",
            },
            locale="fr",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Stripe Checkout session create failed")
        await push_order_status({"id": order["id"]}, "cancelled", {"paymentStatus": "failed"})
        raise HTTPException(502, "Impossible de créer la session Stripe") from e

    payment = {
        "id": str(uuid.uuid4()),
        "transactionId": transaction_id,
        "orderId": order["id"],
        "userId": user["id"],
        "amount": amount,
        "currency": "XAF",
        "provider": "stripe",
        "providerSessionId": session.id,
        "stripeSessionId": session.id,
        "providerPaymentId": None,
        "status": "PENDING",
        "mode": "stripe",
        "paymentMethod": "card",
        "paymentUrl": session.url,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    await db.payments.insert_one(payment.copy())
    payment.pop("_id", None)
    return {
        "transactionId": transaction_id,
        "orderId": order["id"],
        "amount": amount,
        "currency": "XAF",
        "mode": "stripe",
        "paymentUrl": session.url,
        "sessionId": session.id,
        "status": "PENDING",
    }


async def _payment_from_stripe_meta(meta: dict) -> Optional[dict]:
    tid = (meta or {}).get("transactionId")
    oid = (meta or {}).get("orderId")
    if tid:
        p = await db.payments.find_one({"transactionId": tid}, {"_id": 0})
        if p:
            return p
    if oid:
        return await db.payments.find_one({"orderId": oid, "mode": "stripe"}, {"_id": 0})
    return None


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Dedicated PagneMarket Stripe webhook — do not reuse other apps' endpoints."""
    wh_secret = stripe_webhook_secret()
    if not wh_secret:
        raise HTTPException(503, "STRIPE_WEBHOOK_SECRET manquante")
    configure_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not sig:
        raise HTTPException(400, "Signature Stripe manquante")
    try:
        event = stripe.Webhook.construct_event(payload, sig, wh_secret)
    except ValueError:
        raise HTTPException(400, "Payload invalide")
    except Exception as e:  # noqa: BLE001
        # stripe.error.SignatureVerificationError (and aliases)
        if e.__class__.__name__ == "SignatureVerificationError" or "signature" in str(e).lower():
            raise HTTPException(400, "Signature Stripe invalide") from e
        raise

    event_id = event.get("id")
    event_type = event.get("type")
    if event_id and await already_processed_event(event_id):
        return {"ok": True, "duplicate": True}

    data_obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        payment = await _payment_from_stripe_meta(data_obj.get("metadata") or {})
        if not payment and data_obj.get("id"):
            payment = await db.payments.find_one({"stripeSessionId": data_obj["id"]}, {"_id": 0})
        if payment and data_obj.get("payment_status") == "paid":
            await mark_order_paid(payment, provider_payment_id=data_obj.get("payment_intent"))
        elif payment and data_obj.get("status") == "expired":
            await mark_order_failed(payment)

    elif event_type == "payment_intent.succeeded":
        meta = data_obj.get("metadata") or {}
        payment = await _payment_from_stripe_meta(meta)
        if not payment and data_obj.get("id"):
            payment = await db.payments.find_one({"providerPaymentId": data_obj["id"]}, {"_id": 0})
        if payment:
            await mark_order_paid(payment, provider_payment_id=data_obj.get("id"))

    elif event_type == "payment_intent.payment_failed":
        meta = data_obj.get("metadata") or {}
        payment = await _payment_from_stripe_meta(meta)
        if payment:
            await mark_order_failed(payment)

    elif event_type == "charge.refunded":
        pi = data_obj.get("payment_intent")
        payment = None
        if pi:
            payment = await db.payments.find_one({"providerPaymentId": pi}, {"_id": 0})
        if payment:
            await mark_order_refunded(payment)

    if event_id:
        try:
            await remember_event(event_id, event_type)
        except Exception:  # noqa: BLE001
            # Unique constraint race → treat as ok
            pass

    return {"ok": True}


@router.get("/payments/stripe/return", response_class=HTMLResponse)
async def stripe_return(session_id: Optional[str] = None):
    # Never trust return URL alone — refresh against Stripe when possible.
    if session_id and stripe_secret_key():
        try:
            configure_stripe()
            session = stripe.checkout.Session.retrieve(session_id)
            payment = await db.payments.find_one({"stripeSessionId": session_id}, {"_id": 0})
            if payment and session.payment_status == "paid":
                await mark_order_paid(payment, provider_payment_id=session.payment_intent)
        except Exception:  # noqa: BLE001
            logger.exception("stripe return refresh failed")
    return """<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PagneMarket — Paiement</title></head><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#FAF8F3;color:#111;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-weight:500">Merci</h1><p>Si le paiement a réussi, votre commande sera confirmée sous peu. Fermez cette fenêtre et revenez dans PagneMarket.</p></div></body></html>"""


@router.get("/payments/stripe/cancel", response_class=HTMLResponse)
async def stripe_cancel(order_id: Optional[str] = None, transaction_id: Optional[str] = None):
    if transaction_id:
        payment = await db.payments.find_one({"transactionId": transaction_id}, {"_id": 0})
        if payment and not _payment_is_paid(payment):
            await db.payments.update_one(
                {"transactionId": transaction_id},
                {"$set": {"status": "FAILED", "updatedAt": datetime.now(timezone.utc)}},
            )
            await push_order_status({"id": payment["orderId"]}, "cancelled", {"paymentStatus": "failed"})
    elif order_id:
        payment = await db.payments.find_one({"orderId": order_id, "mode": "stripe"}, {"_id": 0})
        if payment and not _payment_is_paid(payment):
            await mark_order_failed(payment)
    return """<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PagneMarket</title></head><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#FAF8F3;color:#111;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-weight:500">Paiement annulé</h1><p>Vous pouvez fermer cette fenêtre et réessayer dans PagneMarket.</p></div></body></html>"""
