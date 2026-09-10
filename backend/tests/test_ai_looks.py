"""AI look generation + tailor panel for a chosen fabric."""
import requests


class TestAiLooks:
    def test_generate_look_requires_auth(self, api, base_url):
        r = api.post(f"{base_url}/api/ai/looks", json={"productId": "missing", "garment": "Robe"})
        assert r.status_code == 401

    def test_generate_look_unknown_product(self, api, base_url, auth_headers):
        r = requests.post(
            f"{base_url}/api/ai/looks",
            json={"productId": "does-not-exist", "garment": "Robe"},
            headers=auth_headers,
        )
        assert r.status_code == 404

    def test_generate_look_from_catalog(self, api, base_url, auth_headers):
        catalog = api.get(f"{base_url}/api/products")
        assert catalog.status_code == 200
        products = catalog.json()
        assert products, "catalogue vide"
        pid = products[0]["id"]
        r = requests.post(
            f"{base_url}/api/ai/looks",
            json={"productId": pid, "garment": "Robe"},
            headers=auth_headers,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["productId"] == pid
        assert data["garment"] == "Robe"
        assert data.get("image")
        assert data.get("story")
        assert isinstance(data.get("tailors"), list) and len(data["tailors"]) > 0

    def test_list_looks(self, api, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/ai/looks", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json().get("items"), list)
