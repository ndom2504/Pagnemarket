"""PagneMarket iteration 2 — Supplier, Mobile Money, Uploads, Reco."""
import io
import time
import uuid

import pytest
import requests
from PIL import Image


SUPPLIER_EMAIL = "fournisseur@pagnemarket.com"
SUPPLIER_PASSWORD = "Fournisseur1234!"
BUYER_EMAIL = "demo@pagnemarket.com"
BUYER_PASSWORD = "Demo1234!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def supplier_auth(api, base_url):
    r = api.post(f"{base_url}/api/auth/login", json={"email": SUPPLIER_EMAIL, "password": SUPPLIER_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def supplier_headers(supplier_auth):
    return {"Authorization": f"Bearer {supplier_auth['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def buyer_auth(api, base_url):
    r = api.post(f"{base_url}/api/auth/login", json={"email": BUYER_EMAIL, "password": BUYER_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def buyer_headers(buyer_auth):
    return {"Authorization": f"Bearer {buyer_auth['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def fresh_buyer(api, base_url):
    """Register a brand-new buyer for recommendations empty-state check."""
    email = f"TEST_reco_{uuid.uuid4().hex[:8]}@pagnemarket.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "firstName": "Reco", "lastName": "TEST",
        "email": email, "password": "Passw0rd!",
        "city": "Libreville", "role": "buyer",
    })
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- 1. Supplier login ----------------
class TestSupplierLogin:
    def test_supplier_login_role_and_shop(self, supplier_auth):
        u = supplier_auth["user"]
        assert "supplier" in u["roles"]
        assert u.get("shopName") == "Maison Adjoua"


# ---------------- 2. /api/supplier/stats ----------------
class TestSupplierStats:
    def test_stats_shape(self, api, base_url, supplier_headers):
        r = api.get(f"{base_url}/api/supplier/stats", headers=supplier_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("revenueToday", "ordersToday", "ordersInProgress", "productsCount",
                  "last7Days", "topProducts", "recentOrders"):
            assert k in d
        assert isinstance(d["last7Days"], list) and len(d["last7Days"]) == 7
        for entry in d["last7Days"]:
            assert "date" in entry and "revenue" in entry
        assert isinstance(d["topProducts"], list)
        assert isinstance(d["recentOrders"], list)
        assert d["productsCount"] >= 1

    def test_stats_buyer_forbidden(self, api, base_url, buyer_headers):
        r = api.get(f"{base_url}/api/supplier/stats", headers=buyer_headers)
        assert r.status_code == 403


# ---------------- 3. Supplier products CRUD ----------------
class TestSupplierProducts:
    _created_id = None

    def test_create_product(self, api, base_url, supplier_headers, supplier_auth):
        body = {
            "name": "TEST Wax Bleu",
            "description": "Tissu wax test — à supprimer",
            "category": "wax",
            "price": 12000,
            "stock": 5,
            "images": ["https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99"],
        }
        r = api.post(f"{base_url}/api/supplier/products", json=body, headers=supplier_headers)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["supplierId"] == supplier_auth["user"]["id"]
        assert p["supplierName"] == "Maison Adjoua"
        assert p["price"] == 12000
        assert p["stock"] == 5
        TestSupplierProducts._created_id = p["id"]

    def test_promo_price_validation(self, api, base_url, supplier_headers):
        body = {
            "name": "TEST invalid promo",
            "description": "invalid promo test",
            "category": "wax",
            "price": 10000,
            "promoPrice": 10000,
            "stock": 3,
            "images": ["https://example.com/x.jpg"],
        }
        r = api.post(f"{base_url}/api/supplier/products", json=body, headers=supplier_headers)
        assert r.status_code == 400

    def test_images_empty_validation(self, api, base_url, supplier_headers):
        body = {
            "name": "TEST no image",
            "description": "no image test",
            "category": "wax",
            "price": 5000,
            "stock": 1,
            "images": [],
        }
        r = api.post(f"{base_url}/api/supplier/products", json=body, headers=supplier_headers)
        assert r.status_code == 422

    def test_update_product(self, api, base_url, supplier_headers):
        pid = TestSupplierProducts._created_id
        assert pid, "creation must run first"
        body = {
            "name": "TEST Wax Bleu v2",
            "description": "Tissu wax test v2",
            "category": "wax",
            "price": 15000,
            "stock": 8,
            "images": ["https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99"],
        }
        r = api.put(f"{base_url}/api/supplier/products/{pid}", json=body, headers=supplier_headers)
        assert r.status_code == 200, r.text
        assert r.json()["price"] == 15000
        assert r.json()["name"] == "TEST Wax Bleu v2"

    def test_delete_product(self, api, base_url, supplier_headers):
        pid = TestSupplierProducts._created_id
        r = api.delete(f"{base_url}/api/supplier/products/{pid}", headers=supplier_headers)
        assert r.status_code == 200
        # verify gone
        r2 = api.get(f"{base_url}/api/products/{pid}")
        assert r2.status_code == 404


# ---------------- 4. Supplier orders + status ----------------
class TestSupplierOrders:
    def test_list_orders(self, api, base_url, supplier_headers):
        r = api.get(f"{base_url}/api/supplier/orders", headers=supplier_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_invalid_status(self, api, base_url, supplier_headers):
        r = api.patch(f"{base_url}/api/supplier/orders/does-not-matter/status",
                      json={"status": "bogus"}, headers=supplier_headers)
        assert r.status_code == 422


# ---------------- 5. /api/uploads/image ----------------
class TestUploads:
    def test_upload_png(self, api, base_url, buyer_auth):
        img = Image.new("RGB", (64, 64), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        r = requests.post(f"{base_url}/api/uploads/image", headers=headers,
                          files={"file": ("test.png", buf, "image/png")})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and "url" in data
        # public GET
        r2 = requests.get(data["url"])
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")

    def test_upload_reject_non_image(self, api, base_url, buyer_auth):
        headers = {"Authorization": f"Bearer {buyer_auth['token']}"}
        r = requests.post(f"{base_url}/api/uploads/image", headers=headers,
                          files={"file": ("t.txt", b"hello", "text/plain")})
        assert r.status_code == 400


# ---------------- 6. Mobile money flow ----------------
class TestMobileMoney:
    def test_payments_config(self, api, base_url):
        r = api.get(f"{base_url}/api/payments/config")
        assert r.status_code == 200
        d = r.json()
        assert d["mobileMoneyMode"] == "simulation"
        assert set(d["operators"].keys()) == {"orange", "mtn", "moov"}

    def test_init_empty_cart(self, api, base_url, buyer_headers):
        # ensure cart cleared
        api.post(f"{base_url}/api/cart/clear", headers=buyer_headers)
        body = {"address": "Rue 1", "city": "Libreville", "country": "Gabon",
                "phone": "+241000", "operator": "orange", "momoPhone": "077000000"}
        r = api.post(f"{base_url}/api/payments/mobile-money/init", json=body, headers=buyer_headers)
        assert r.status_code == 400

    def test_init_invalid_operator(self, api, base_url, buyer_headers):
        body = {"address": "Rue 1", "city": "Libreville", "country": "Gabon",
                "phone": "+241000", "operator": "wave", "momoPhone": "077000000"}
        r = api.post(f"{base_url}/api/payments/mobile-money/init", json=body, headers=buyer_headers)
        assert r.status_code == 422

    def test_full_flow_simulation_paid(self, api, base_url, buyer_headers):
        # add item
        api.post(f"{base_url}/api/cart/clear", headers=buyer_headers)
        pid = api.get(f"{base_url}/api/products").json()[0]["id"]
        r = api.post(f"{base_url}/api/cart/add",
                     json={"productId": pid, "quantity": 1}, headers=buyer_headers)
        assert r.status_code == 200

        # init
        body = {"address": "Rue 1", "city": "Libreville", "country": "Gabon",
                "phone": "+241000", "operator": "orange", "momoPhone": "077000000"}
        r = api.post(f"{base_url}/api/payments/mobile-money/init", json=body, headers=buyer_headers)
        assert r.status_code == 200, r.text
        init = r.json()
        assert init["mode"] == "simulation"
        assert init["status"] == "PENDING"
        assert init["operator"] == "orange"
        tx = init["transactionId"]
        order_id = init["orderId"]

        # immediate status is PENDING
        r = api.get(f"{base_url}/api/payments/{tx}/status", headers=buyer_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "PENDING"

        # after 7s, becomes PAID
        time.sleep(7.5)
        r = api.get(f"{base_url}/api/payments/{tx}/status", headers=buyer_headers)
        assert r.status_code == 200, r.text
        status_after = r.json()["status"]
        assert status_after == "PAID", f"expected PAID got {status_after}"

        # cart is now empty
        cart = api.get(f"{base_url}/api/cart", headers=buyer_headers).json()
        assert cart["items"] == []

        # order visible with paymentStatus paid
        orders = api.get(f"{base_url}/api/orders", headers=buyer_headers).json()
        match = next((o for o in orders if o["id"] == order_id), None)
        assert match is not None, "order not in /api/orders"
        assert match["paymentStatus"] == "paid"
        assert match["status"] == "confirmed"


# ---------------- 7. Reco / events ----------------
class TestReco:
    def test_reco_empty_new_user(self, api, base_url, fresh_buyer):
        h = {"Authorization": f"Bearer {fresh_buyer['token']}", "Content-Type": "application/json"}
        r = api.get(f"{base_url}/api/recommendations", headers=h)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["items"] == []

    def test_track_view_then_reco(self, api, base_url, buyer_headers):
        products = api.get(f"{base_url}/api/products", params={"category": "wax"}).json()
        assert products, "need at least one wax product"
        pid = products[0]["id"]
        # view a few times
        for _ in range(3):
            r = api.post(f"{base_url}/api/events/view", json={"productId": pid}, headers=buyer_headers)
            assert r.status_code == 200
        r = api.get(f"{base_url}/api/recommendations", headers=buyer_headers)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["items"], list)
        assert len(d["items"]) <= 10
        assert d.get("basis") is not None
        assert "topCategory" in d["basis"]


# ---------------- 8. Products have supplierId/Name ----------------
class TestProductsSupplierFields:
    def test_products_have_supplier_fields(self, api, base_url):
        products = api.get(f"{base_url}/api/products").json()
        assert products
        for p in products[:5]:
            assert "supplierId" in p and "supplierName" in p
            # vendor* is gone
            assert "vendorId" not in p
            assert "vendorName" not in p
