"""Iteration 3 backend tests: order tracking timeline, product reviews, low-stock alerts, stock decrement."""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

SUPPLIER_EMAIL = "fournisseur@pagnemarket.com"
SUPPLIER_PASSWORD = "Fournisseur1234!"


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def supplier_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SUPPLIER_EMAIL, "password": SUPPLIER_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def other_buyer_headers():
    # Create a fresh buyer for isolation tests
    email = f"TEST_iter3_{int(time.time())}@example.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "firstName": "Test", "lastName": "Iter3", "email": email,
        "password": "Testpass1234!", "role": "buyer",
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


# ---------------- ORDER TRACKING TIMELINE ----------------

class TestOrderTracking:
    def test_list_orders_all_have_statusHistory(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) > 0
        for o in orders:
            assert "statusHistory" in o and isinstance(o["statusHistory"], list) and len(o["statusHistory"]) > 0
            entry = o["statusHistory"][0]
            assert "status" in entry and "at" in entry

    def test_order_detail_has_statusHistory_and_myReviews(self, auth_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        oid = orders[0]["id"]
        r = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("statusHistory"), list)
        assert isinstance(data.get("myReviews"), dict)

    def test_other_user_order_returns_404(self, auth_headers, other_buyer_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        oid = orders[0]["id"]
        r = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=other_buyer_headers)
        assert r.status_code == 404


# ---------------- REVIEWS ----------------

def _find_reviewable_item(orders, headers):
    """Find (order_id, product_id) from a delivered order where the buyer has NOT yet reviewed that product for THAT order."""
    for o in orders:
        if o.get("status") != "delivered":
            continue
        detail = requests.get(f"{BASE_URL}/api/orders/{o['id']}", headers=headers).json()
        already = set(detail.get("myReviews", {}).keys())
        for it in detail.get("items", []):
            if it["productId"] not in already:
                return o["id"], it["productId"]
    return None, None


class TestReviews:
    def test_create_review_on_delivered_order(self, auth_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        oid, pid = _find_reviewable_item(orders, auth_headers)
        assert oid and pid, "No reviewable item found on delivered orders (all products already reviewed)"

        # capture before counts
        prod_before = requests.get(f"{BASE_URL}/api/products/{pid}").json()
        before_count = prod_before["reviewsCount"]

        r = requests.post(f"{BASE_URL}/api/reviews", headers=auth_headers, json={
            "productId": pid, "orderId": oid, "rating": 5, "comment": "TEST_iter3 très beau tissu"
        })
        assert r.status_code == 200, r.text
        review = r.json()
        assert review["rating"] == 5
        assert review["productId"] == pid
        assert review.get("userName")  # userName present

        # duplicate should fail
        r2 = requests.post(f"{BASE_URL}/api/reviews", headers=auth_headers, json={
            "productId": pid, "orderId": oid, "rating": 4
        })
        assert r2.status_code == 400 and "déjà" in r2.text.lower()

        # product reviewsCount incremented
        prod_after = requests.get(f"{BASE_URL}/api/products/{pid}").json()
        assert prod_after["reviewsCount"] == before_count + 1

        # GET reviews endpoint contains it
        rl = requests.get(f"{BASE_URL}/api/products/{pid}/reviews").json()
        assert any(x["id"] == review["id"] for x in rl["items"])

        # myReviews now includes it
        detail = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=auth_headers).json()
        assert pid in detail.get("myReviews", {})

    def test_review_on_non_delivered_order_returns_400(self, auth_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        non_delivered = next((o for o in orders if o.get("status") != "delivered"), None)
        assert non_delivered, "No non-delivered order found"
        pid = non_delivered["items"][0]["productId"]
        r = requests.post(f"{BASE_URL}/api/reviews", headers=auth_headers, json={
            "productId": pid, "orderId": non_delivered["id"], "rating": 5
        })
        assert r.status_code == 400 and "livr" in r.text.lower()

    def test_review_productId_not_in_order(self, auth_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        delivered = next((o for o in orders if o.get("status") == "delivered"), None)
        assert delivered
        order_pids = {i["productId"] for i in delivered["items"]}
        # pick a product not in this order
        all_products = requests.get(f"{BASE_URL}/api/products").json()
        outside = next((p for p in all_products if p["id"] not in order_pids), None)
        assert outside
        r = requests.post(f"{BASE_URL}/api/reviews", headers=auth_headers, json={
            "productId": outside["id"], "orderId": delivered["id"], "rating": 5
        })
        assert r.status_code == 400

    def test_review_rating_out_of_range_returns_422(self, auth_headers):
        orders = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers).json()
        delivered = next((o for o in orders if o.get("status") == "delivered"), None)
        pid = delivered["items"][0]["productId"]
        r = requests.post(f"{BASE_URL}/api/reviews", headers=auth_headers, json={
            "productId": pid, "orderId": delivered["id"], "rating": 6
        })
        assert r.status_code == 422


# ---------------- SUPPLIER LOW-STOCK ALERTS ----------------

class TestSupplierAlerts:
    def test_supplier_alerts_contains_wax_pointe_noire(self, supplier_headers):
        r = requests.get(f"{BASE_URL}/api/supplier/alerts", headers=supplier_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["threshold"] == 3
        assert isinstance(data["items"], list) and len(data["items"]) > 0
        wpn = next((it for it in data["items"] if it["name"] == "Wax Pointe Noire"), None)
        assert wpn, f"'Wax Pointe Noire' not in alerts: {data}"
        assert wpn["stock"] == 2
        assert wpn["level"] == "low"
        assert "Plus que 2" in wpn["message"]

    def test_alerts_forbidden_for_buyer(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/supplier/alerts", headers=auth_headers)
        assert r.status_code == 403


# ---------------- SUPPLIER STATUS UPDATE PROPAGATES TO BUYER ----------------

class TestSupplierStatusPropagation:
    def test_shipped_status_reflects_in_buyer_history(self, supplier_headers, auth_headers):
        # find a supplier order not already delivered/shipped so we can bump it
        sup_orders = requests.get(f"{BASE_URL}/api/supplier/orders", headers=supplier_headers).json()
        target = next((o for o in sup_orders if o["status"] in ("confirmed", "processing")), None)
        assert target, "No mutable supplier order for shipping test"
        oid = target["id"]
        initial_status = target["status"]

        try:
            # Bump to shipped
            r = requests.patch(f"{BASE_URL}/api/supplier/orders/{oid}/status",
                               headers=supplier_headers, json={"status": "shipped"})
            assert r.status_code == 200, r.text
            assert r.json()["status"] == "shipped"

            # Buyer sees 'shipped' in statusHistory
            detail = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=auth_headers).json()
            statuses = [e["status"] for e in detail["statusHistory"]]
            assert "shipped" in statuses
            assert detail["status"] == "shipped"
        finally:
            # revert
            requests.patch(f"{BASE_URL}/api/supplier/orders/{oid}/status",
                           headers=supplier_headers, json={"status": initial_status})


# ---------------- STOCK DECREMENT ----------------

def _add_to_cart(headers, pid, qty=1):
    r = requests.post(f"{BASE_URL}/api/cart/add", headers=headers, json={"productId": pid, "quantity": qty})
    assert r.status_code == 200, r.text


def _pick_in_stock_product(exclude_name=None):
    products = requests.get(f"{BASE_URL}/api/products").json()
    # avoid low-stock demo & Wax Pointe Noire per instructions
    for p in products:
        if p.get("stock", 0) >= 5 and p["name"] != "Wax Pointe Noire":
            if exclude_name and p["name"] == exclude_name:
                continue
            return p
    return None


class TestStockDecrement:
    def test_stock_decrements_on_card_order(self, other_buyer_headers):
        # clear cart, pick product, add 1, checkout card
        requests.post(f"{BASE_URL}/api/cart/clear", headers=other_buyer_headers)
        p = _pick_in_stock_product()
        assert p, "No in-stock product to test"
        pid = p["id"]
        before = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]

        _add_to_cart(other_buyer_headers, pid, 1)
        r = requests.post(f"{BASE_URL}/api/orders", headers=other_buyer_headers, json={
            "address": "Test Addr", "city": "Libreville", "country": "Gabon",
            "phone": "+241 07 00 00 00", "paymentMethod": "card"
        })
        assert r.status_code == 200, r.text

        after = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
        assert after == before - 1, f"Stock did not decrement: before={before} after={after}"

    def test_stock_decrements_on_mobile_money_paid(self, other_buyer_headers):
        requests.post(f"{BASE_URL}/api/cart/clear", headers=other_buyer_headers)
        p = _pick_in_stock_product()
        assert p
        pid = p["id"]
        before = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]

        _add_to_cart(other_buyer_headers, pid, 1)
        init = requests.post(f"{BASE_URL}/api/payments/mobile-money/init",
                             headers=other_buyer_headers, json={
                                 "address": "Test Addr", "city": "Libreville", "country": "Gabon",
                                 "phone": "+241 07 00 00 00",
                                 "operator": "orange", "momoPhone": "+241 07 00 00 00"
                             })
        assert init.status_code == 200, init.text
        tx = init.json()["transactionId"]
        assert init.json()["mode"] == "simulation"

        # poll until PAID (simulation delay ~6s)
        paid = False
        for _ in range(15):
            time.sleep(1)
            s = requests.get(f"{BASE_URL}/api/payments/{tx}/status", headers=other_buyer_headers)
            if s.status_code == 200 and s.json().get("status") == "PAID":
                paid = True
                break
        assert paid, "Mobile money did not reach PAID"

        after = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
        assert after == before - 1, f"Stock not decremented on MoMo paid: before={before} after={after}"
