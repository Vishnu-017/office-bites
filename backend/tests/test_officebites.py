"""Backend tests for OfficeBites API (auth, menu, orders, updates, polls, analytics)."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://kitchen-prep-sync.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"employee_id": "admin", "password": "admin123"}
COOK = {"employee_id": "cook", "password": "cook123"}
EMP = {"employee_id": "EMP001", "password": "emp123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data


@pytest.fixture(scope="session")
def admin_token():
    tok, data = _login(ADMIN)
    assert data["role"] == "admin"
    return tok


@pytest.fixture(scope="session")
def cook_token():
    tok, data = _login(COOK)
    assert data["role"] == "cook"
    return tok


@pytest.fixture(scope="session")
def emp_token():
    tok, data = _login(EMP)
    assert data["role"] == "employee"
    return tok


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ============ AUTH ============
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["employee_id"] == "admin"
        assert "access_token" in d

    def test_cook_login(self):
        r = requests.post(f"{API}/auth/login", json=COOK, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "cook"

    def test_emp_login(self):
        r = requests.post(f"{API}/auth/login", json=EMP, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "employee"

    def test_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"employee_id": "admin", "password": "wrong"}, timeout=15)
        assert r.status_code == 401


# ============ MENU ============
class TestMenu:
    def test_menu_list(self, emp_token):
        r = requests.get(f"{API}/menu", headers=_h(emp_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0
        assert "name" in items[0]
        assert "price" in items[0]  # field exists, frontend just hides


# ============ ORDERS ============
class TestOrders:
    order_id = None
    item_id = None

    def test_create_order(self, emp_token):
        menu = requests.get(f"{API}/menu", headers=_h(emp_token), timeout=15).json()
        avail = next((m for m in menu if m.get("available") and m.get("stock", 0) > 0), None)
        assert avail, "No available menu items to order"
        TestOrders.item_id = avail["id"]
        payload = {"items": [{"item_id": avail["id"], "name": avail["name"], "price": avail["price"], "quantity": 1}], "notes": "TEST_order"}
        r = requests.post(f"{API}/orders", json=payload, headers=_h(emp_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        assert d["employee_id"] == "EMP001"
        TestOrders.order_id = d["id"]

    def test_list_mine(self, emp_token):
        r = requests.get(f"{API}/orders?scope=mine", headers=_h(emp_token), timeout=15)
        assert r.status_code == 200
        orders = r.json()
        assert all(o["employee_id"] == "EMP001" for o in orders)
        assert any(o["id"] == TestOrders.order_id for o in orders)

    def test_cook_advance_status(self, cook_token, emp_token):
        assert TestOrders.order_id
        r = requests.put(f"{API}/orders/{TestOrders.order_id}/status", json={"status": "accepted"}, headers=_h(cook_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"
        # verify persistence
        g = requests.get(f"{API}/orders/{TestOrders.order_id}", headers=_h(emp_token), timeout=15)
        assert g.status_code == 200
        assert g.json()["status"] == "accepted"

    def test_notifications_received(self, emp_token):
        r = requests.get(f"{API}/notifications", headers=_h(emp_token), timeout=15)
        assert r.status_code == 200
        notifs = r.json()
        # At least placement + status-update notif for EMP001
        assert any(n.get("order_id") == TestOrders.order_id for n in notifs)


# ============ ROLE AUTHZ ============
class TestAuthz:
    def test_emp_cannot_create_update(self, emp_token):
        r = requests.post(f"{API}/updates", json={"title": "x", "body": "y"}, headers=_h(emp_token), timeout=15)
        assert r.status_code == 403

    def test_emp_cannot_create_poll(self, emp_token):
        r = requests.post(f"{API}/polls", json={"kind": "lunch", "title": "x", "date": "2026-01-01", "closes_at": "2026-01-01T23:59:00+00:00"}, headers=_h(emp_token), timeout=15)
        assert r.status_code == 403

    def test_emp_cannot_create_menu(self, emp_token):
        r = requests.post(f"{API}/menu", json={"name": "x", "price": 10}, headers=_h(emp_token), timeout=15)
        assert r.status_code == 403

    def test_emp_cannot_create_user(self, emp_token):
        r = requests.post(f"{API}/users", json={"employee_id": "TEST_X", "name": "x", "password": "p", "role": "employee"}, headers=_h(emp_token), timeout=15)
        assert r.status_code == 403


# ============ UPDATES ============
class TestUpdates:
    update_id = None

    def test_admin_create(self, admin_token):
        r = requests.post(f"{API}/updates", json={"title": "TEST_ann", "body": "hello", "pinned": False}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        TestUpdates.update_id = d["id"]

    def test_list_pinned_first(self, admin_token, emp_token):
        # create a pinned one
        r = requests.post(f"{API}/updates", json={"title": "TEST_pinned", "body": "top", "pinned": True}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        pinned_id = r.json()["id"]
        lst = requests.get(f"{API}/updates", headers=_h(emp_token), timeout=15).json()
        assert lst[0]["id"] == pinned_id
        # cleanup
        requests.delete(f"{API}/updates/{pinned_id}", headers=_h(admin_token), timeout=15)

    def test_toggle_pinned(self, admin_token):
        assert TestUpdates.update_id
        r = requests.put(f"{API}/updates/{TestUpdates.update_id}", json={"pinned": True}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["pinned"] is True

    def test_delete_update(self, admin_token):
        r = requests.delete(f"{API}/updates/{TestUpdates.update_id}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200


# ============ POLLS ============
class TestPolls:
    poll_id = None
    today = datetime.now().strftime("%Y-%m-%d")
    closes = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()

    def test_admin_create_lunch(self, admin_token):
        payload = {"kind": "lunch", "title": "TEST Lunch?", "description": "veg biryani", "date": TestPolls.today, "closes_at": TestPolls.closes}
        r = requests.post(f"{API}/polls", json=payload, headers=_h(admin_token), timeout=15)
        # If duplicate exists from prior seed, delete + retry
        if r.status_code == 400:
            polls = requests.get(f"{API}/polls", headers=_h(admin_token), timeout=15).json()
            for p in polls:
                if p["kind"] == "lunch" and p["date"] == TestPolls.today:
                    requests.delete(f"{API}/polls/{p['id']}", headers=_h(admin_token), timeout=15)
            r = requests.post(f"{API}/polls", json=payload, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        TestPolls.poll_id = r.json()["id"]

    def test_duplicate_same_kind_date_rejected(self, admin_token):
        payload = {"kind": "lunch", "title": "dup", "date": TestPolls.today, "closes_at": TestPolls.closes}
        r = requests.post(f"{API}/polls", json=payload, headers=_h(admin_token), timeout=15)
        assert r.status_code == 400

    def test_polls_today_initial_null(self, emp_token):
        r = requests.get(f"{API}/polls/today", headers=_h(emp_token), timeout=15)
        assert r.status_code == 200
        polls = r.json()
        # Find our TEST poll
        target = next((p for p in polls if p["poll"]["id"] == TestPolls.poll_id), None)
        assert target is not None
        # my_vote may be null (first-time) — but if EMP001 already voted in a prior test run, that's OK
        assert "my_vote" in target

    def test_vote_yes_then_change_to_no(self, emp_token):
        r = requests.post(f"{API}/polls/{TestPolls.poll_id}/vote", json={"response": "yes"}, headers=_h(emp_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["response"] == "yes"
        # verify persistence
        polls = requests.get(f"{API}/polls/today", headers=_h(emp_token), timeout=15).json()
        target = next(p for p in polls if p["poll"]["id"] == TestPolls.poll_id)
        assert target["my_vote"] == "yes"
        # change vote
        r2 = requests.post(f"{API}/polls/{TestPolls.poll_id}/vote", json={"response": "no"}, headers=_h(emp_token), timeout=15)
        assert r2.status_code == 200
        polls = requests.get(f"{API}/polls/today", headers=_h(emp_token), timeout=15).json()
        target = next(p for p in polls if p["poll"]["id"] == TestPolls.poll_id)
        assert target["my_vote"] == "no"

    def test_responses_include_names(self, admin_token):
        r = requests.get(f"{API}/polls/{TestPolls.poll_id}/responses", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "yes" in d and "no" in d
        all_votes = d["yes"] + d["no"]
        if all_votes:
            assert all("employee_name" in v for v in all_votes)

    def test_cleanup(self, admin_token):
        if TestPolls.poll_id:
            requests.delete(f"{API}/polls/{TestPolls.poll_id}", headers=_h(admin_token), timeout=15)


# ============ ANALYTICS ============
class TestAnalytics:
    def test_summary(self, admin_token):
        r = requests.get(f"{API}/analytics/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("orders_today", "orders_week", "weekly_trend", "top_items"):
            assert k in d

    def test_polls_analytics(self, admin_token):
        r = requests.get(f"{API}/analytics/polls", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert "trend" in r.json()

    def test_export_csv(self, admin_token):
        r = requests.get(f"{API}/analytics/export", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "order_id" in r.text.splitlines()[0]
