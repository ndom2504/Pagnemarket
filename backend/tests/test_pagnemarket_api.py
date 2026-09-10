"""PagneMarket backend end-to-end API tests."""
import uuid
import requests


# ---------------- HEALTH ----------------
def test_root_health(api, base_url):
    r = api.get(f"{base_url}/api/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("app") == "PagneMarket"


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_demo(self, demo_auth):
        assert demo_auth["user"]["email"] == "demo@pagnemarket.com"
        assert "buyer" in demo_auth["user"]["roles"]

    def test_login_invalid(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={"email": "demo@pagnemarket.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, api, base_url, auth_headers):
        r = api.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "demo@pagnemarket.com"

    def test_me_unauthorized(self, api, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_register_new_user(self, api, base_url):
        email = f"TEST_{uuid.uuid4().hex[:8]}@pagnemarket.com"
        r = api.post(f"{base_url}/api/auth/register", json={
            "firstName": "TEST", "lastName": "User",
            "email": email, "password": "Passw0rd!",
            "city": "Libreville", "role": "buyer"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email.lower()
        assert data["token"]

    def test_register_duplicate(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/register", json={
            "firstName": "Demo", "lastName": "User",
            "email": "demo@pagnemarket.com", "password": "Demo1234!",
            "role": "buyer"
        })
        assert r.status_code == 400


# ---------------- CATALOG ----------------
class TestCatalog:
    def test_categories(self, api, base_url):
        r = api.get(f"{base_url}/api/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        slugs = {c["slug"] for c in data}
        assert {"wax", "bazin", "kente", "bogolan", "vlisco", "accessoires"}.issubset(slugs)

    def test_products_list(self, api, base_url):
        r = api.get(f"{base_url}/api/products")
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        assert len(products) > 0
        p = products[0]
        for k in ("id", "name", "price", "currency", "images", "vendorName"):
            assert k in p

    def test_products_filter_category(self, api, base_url):
        r = api.get(f"{base_url}/api/products", params={"category": "wax"})
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "wax"

    def test_products_search(self, api, base_url):
        r = api.get(f"{base_url}/api/products", params={"q": "Wax"})
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_products_sort(self, api, base_url):
        r = api.get(f"{base_url}/api/products", params={"sort": "price_asc"})
        assert r.status_code == 200
        prices = [p["price"] for p in r.json()]
        assert prices == sorted(prices)

    def test_products_trending(self, api, base_url):
        r = api.get(f"{base_url}/api/products/trending")
        assert r.status_code == 200
        data = r.json()
        assert 0 < len(data) <= 8

    def test_product_detail(self, api, base_url):
        pid = api.get(f"{base_url}/api/products").json()[0]["id"]
        r = api.get(f"{base_url}/api/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_product_detail_not_found(self, api, base_url):
        r = api.get(f"{base_url}/api/products/nonexistent-id")
        assert r.status_code == 404

    def test_creators_list(self, api, base_url):
        r = api.get(f"{base_url}/api/creators")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4

    def test_creator_detail(self, api, base_url):
        r = api.get(f"{base_url}/api/creators/c1")
        assert r.status_code == 200
        data = r.json()
        assert data["creator"]["id"] == "c1"
        assert isinstance(data["models"], list)

    def test_models_list(self, api, base_url):
        r = api.get(f"{base_url}/api/models")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_models_filter_category(self, api, base_url):
        r = api.get(f"{base_url}/api/models", params={"category": "Robes"})
        assert r.status_code == 200
        for m in r.json():
            assert m["category"] == "Robes"


# ---------------- CART ----------------
class TestCart:
    def test_cart_full_flow(self, api, base_url, auth_headers):
        # clear first
        api.post(f"{base_url}/api/cart/clear", headers=auth_headers)

        products = api.get(f"{base_url}/api/products").json()
        pid = products[0]["id"]

        # add
        r = api.post(f"{base_url}/api/cart/add", json={"productId": pid, "quantity": 2}, headers=auth_headers)
        assert r.status_code == 200

        # get
        r = api.get(f"{base_url}/api/cart", headers=auth_headers)
        assert r.status_code == 200
        cart = r.json()
        assert cart["currency"] == "XAF"
        assert len(cart["items"]) == 1
        assert cart["items"][0]["quantity"] == 2
        assert cart["total"] > 0

        # update qty
        r = api.post(f"{base_url}/api/cart/update", json={"productId": pid, "quantity": 5}, headers=auth_headers)
        assert r.status_code == 200
        cart = api.get(f"{base_url}/api/cart", headers=auth_headers).json()
        assert cart["items"][0]["quantity"] == 5

        # remove via quantity=0
        r = api.post(f"{base_url}/api/cart/update", json={"productId": pid, "quantity": 0}, headers=auth_headers)
        assert r.status_code == 200
        cart = api.get(f"{base_url}/api/cart", headers=auth_headers).json()
        assert len(cart["items"]) == 0

        # add again then clear
        api.post(f"{base_url}/api/cart/add", json={"productId": pid, "quantity": 1}, headers=auth_headers)
        r = api.post(f"{base_url}/api/cart/clear", headers=auth_headers)
        assert r.status_code == 200
        cart = api.get(f"{base_url}/api/cart", headers=auth_headers).json()
        assert cart["items"] == []


# ---------------- FAVORITES ----------------
class TestFavorites:
    def test_favorites_toggle(self, api, base_url, auth_headers):
        pid = api.get(f"{base_url}/api/products").json()[0]["id"]

        # toggle on
        r = api.post(f"{base_url}/api/favorites/toggle", json={"productId": pid}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["favorited"] is True

        favs = api.get(f"{base_url}/api/favorites", headers=auth_headers).json()
        assert any(p["id"] == pid for p in favs)

        # toggle off
        r = api.post(f"{base_url}/api/favorites/toggle", json={"productId": pid}, headers=auth_headers)
        assert r.json()["favorited"] is False

        favs = api.get(f"{base_url}/api/favorites", headers=auth_headers).json()
        assert not any(p["id"] == pid for p in favs)


# ---------------- ORDERS ----------------
class TestOrders:
    def test_create_order_clears_cart(self, api, base_url, auth_headers):
        # setup: clear + add item
        api.post(f"{base_url}/api/cart/clear", headers=auth_headers)
        pid = api.get(f"{base_url}/api/products").json()[0]["id"]
        api.post(f"{base_url}/api/cart/add", json={"productId": pid, "quantity": 1}, headers=auth_headers)

        # create order
        payload = {"address": "TEST Rue 1", "city": "Libreville", "country": "Gabon",
                   "phone": "+241000000", "paymentMethod": "card"}
        r = api.post(f"{base_url}/api/orders", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "confirmed"
        assert order["paymentStatus"] == "paid"
        assert order["total"] > 0
        assert order["currency"] == "XAF"
        assert len(order["items"]) == 1

        # cart cleared
        cart = api.get(f"{base_url}/api/cart", headers=auth_headers).json()
        assert cart["items"] == []

        # listed in orders
        orders = api.get(f"{base_url}/api/orders", headers=auth_headers).json()
        assert any(o["id"] == order["id"] for o in orders)

    def test_create_order_empty_cart(self, api, base_url, auth_headers):
        api.post(f"{base_url}/api/cart/clear", headers=auth_headers)
        r = api.post(f"{base_url}/api/orders", json={
            "address": "x", "city": "y", "country": "z", "phone": "0", "paymentMethod": "card"
        }, headers=auth_headers)
        assert r.status_code == 400


# ---------------- MESSAGES ----------------
class TestMessages:
    def test_messaging_flow(self, api, base_url, auth_headers):
        # Send to a creator (target user id doesn't need to exist; only stored in participants)
        r = api.post(f"{base_url}/api/messages/send",
                     json={"toUserId": "c1", "toName": "Aïcha Diallo", "text": "TEST Bonjour!"},
                     headers=auth_headers)
        assert r.status_code == 200, r.text
        msg = r.json()
        conv_id = msg["conversationId"]
        assert msg["text"] == "TEST Bonjour!"

        # conversations list
        convs = api.get(f"{base_url}/api/conversations", headers=auth_headers).json()
        assert any(c["id"] == conv_id for c in convs)

        # send second message reuses conversation
        r2 = api.post(f"{base_url}/api/messages/send",
                      json={"toUserId": "c1", "toName": "Aïcha Diallo", "text": "TEST Message 2"},
                      headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["conversationId"] == conv_id

        # get messages
        msgs = api.get(f"{base_url}/api/messages/{conv_id}", headers=auth_headers).json()
        assert len(msgs) >= 2
