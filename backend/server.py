from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import json
import importlib
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Set
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta, time as dt_time
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'officebites-dev-secret-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_HOURS = 24 * 7
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT', 'mailto:admin@officebites.com')

# Order cutoff time (breakfast orders close at 9:00 AM local)
ORDER_CUTOFF_HOUR = 9

app = FastAPI(title="OfficeBites API")
api_router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ============= MODELS =============
class Role(str, Enum):
    employee = "employee"
    cook = "cook"
    admin = "admin"


class OrderStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    preparing = "preparing"
    ready = "ready"
    completed = "completed"
    cancelled = "cancelled"


class LoginRequest(BaseModel):
    employee_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: str
    name: str
    role: Role


class UserPublic(BaseModel):
    id: str
    employee_id: str
    name: str
    email: Optional[str] = None
    role: Role
    active: bool = True
    created_at: str


class UserCreate(BaseModel):
    employee_id: str
    name: str
    email: Optional[str] = None
    password: str
    role: Role


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None
    role: Optional[Role] = None


class MenuItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    price: float = 0.0
    image_url: Optional[str] = ""
    category: str = "Breakfast"
    available: bool = True
    stock: int = 100
    created_at: str


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float = 0.0
    image_url: Optional[str] = ""
    category: str = "Breakfast"
    available: bool = True
    stock: int = 100


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    available: Optional[bool] = None
    stock: Optional[int] = None


class OrderItem(BaseModel):
    item_id: str
    name: str
    price: float
    quantity: int


class OrderItemRequest(BaseModel):
    item_id: str
    quantity: int


class OrderCreate(BaseModel):
    items: List[OrderItemRequest]
    notes: Optional[str] = ""


class Order(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    items: List[OrderItem]
    total: float
    status: OrderStatus
    notes: Optional[str] = ""
    created_at: str
    updated_at: str


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class Notification(BaseModel):
    id: str
    employee_id: str
    title: str
    body: str
    order_id: Optional[str] = None
    read: bool = False
    created_at: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushSubscribeRequest(BaseModel):
    subscription: PushSubscription


class PushTestRequest(BaseModel):
    title: str = "Test notification"
    body: str = "Push notifications are working"


# ============= AUTH HELPERS =============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(employee_id: str, role: str) -> str:
    payload = {
        "sub": employee_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        employee_id = payload.get("sub")
        if not employee_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# ============= WEBSOCKET MANAGER =============
class ConnectionManager:
    def __init__(self):
        # employee_id -> set of websockets (a user may have multiple tabs)
        self.connections: Dict[str, Set[WebSocket]] = {}
        # role broadcast (cook + admin need all order updates)
        self.role_connections: Dict[str, Set[WebSocket]] = {"cook": set(), "admin": set()}

    async def connect(self, ws: WebSocket, employee_id: str, role: str):
        await ws.accept()
        self.connections.setdefault(employee_id, set()).add(ws)
        if role in self.role_connections:
            self.role_connections[role].add(ws)

    def disconnect(self, ws: WebSocket, employee_id: str, role: str):
        if employee_id in self.connections:
            self.connections[employee_id].discard(ws)
        if role in self.role_connections:
            self.role_connections[role].discard(ws)

    async def send_to_user(self, employee_id: str, message: dict):
        conns = list(self.connections.get(employee_id, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_to_role(self, role: str, message: dict):
        conns = list(self.role_connections.get(role, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                pass


ws_manager = ConnectionManager()


# ============= HELPERS =============
IST = timezone(timedelta(hours=5, minutes=30))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_ist() -> datetime:
    return datetime.now(timezone.utc).astimezone(IST)


def today_ist_str() -> str:
    return now_ist().strftime("%Y-%m-%d")


def ist_midnight_utc_iso(days_ago: int = 0) -> str:
    ist_today = now_ist().date() - timedelta(days=days_ago)
    ist_midnight = datetime.combine(ist_today, dt_time.min, tzinfo=IST)
    return ist_midnight.astimezone(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def push_enabled() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


async def send_web_push(employee_id: str, title: str, body: str, order_id: Optional[str] = None):
    if not push_enabled():
        return

    try:
        pywebpush_mod = importlib.import_module("pywebpush")
        webpush = pywebpush_mod.webpush
        webpush_exception_cls = pywebpush_mod.WebPushException
    except Exception:
        logger.warning("pywebpush is not installed; skipping web push delivery")
        return

    payload = {
        "title": title,
        "body": body,
        "order_id": order_id,
        "url": "/employee/orders" if order_id else "/employee/updates",
        "timestamp": now_iso(),
    }

    subs = await db.push_subscriptions.find({"employee_id": employee_id}, {"_id": 0}).to_list(200)
    stale_endpoints: List[str] = []
    for sub in subs:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
        except Exception as exc:
            if not isinstance(exc, webpush_exception_cls):
                logger.warning("Unexpected web push error for %s: %s", employee_id, str(exc))
                continue
            status_code = getattr(exc.response, "status_code", None) if getattr(exc, "response", None) else None
            if status_code in (404, 410):
                stale_endpoints.append(sub["endpoint"])
            else:
                logger.warning("Web push failed for %s: %s", employee_id, str(exc))

    if stale_endpoints:
        await db.push_subscriptions.delete_many({
            "employee_id": employee_id,
            "endpoint": {"$in": stale_endpoints},
        })


async def push_notification(employee_id: str, title: str, body: str, order_id: Optional[str] = None):
    notif = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "title": title,
        "body": body,
        "order_id": order_id,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(notif.copy())
    await ws_manager.send_to_user(employee_id, {"type": "notification", "data": clean(notif)})
    await send_web_push(employee_id, title, body, order_id)


# ============= AUTH ROUTES =============
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    # Allow login by employee_id OR email
    user = await db.employees.find_one(
        {"$or": [{"employee_id": req.employee_id}, {"email": req.employee_id.lower()}]},
        {"_id": 0}
    )
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid employee ID or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_token(user["employee_id"], user["role"])
    return TokenResponse(
        access_token=token,
        employee_id=user["employee_id"],
        name=user["name"],
        role=user["role"],
    )


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "employee_id": user["employee_id"],
        "name": user["name"],
        "email": user.get("email"),
        "role": user["role"],
        "active": user.get("active", True),
    }


# ============= MENU ROUTES =============
@api_router.get("/menu", response_model=List[MenuItem])
async def get_menu(user: dict = Depends(get_current_user)):
    items = await db.menu_items.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/menu", response_model=MenuItem)
async def create_menu_item(payload: MenuItemCreate, user: dict = Depends(require_roles("cook", "admin"))):
    item = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        **payload.model_dump(),
    }
    await db.menu_items.insert_one(item.copy())
    return clean(item)


@api_router.put("/menu/{item_id}", response_model=MenuItem)
async def update_menu_item(item_id: str, payload: MenuItemUpdate, user: dict = Depends(require_roles("cook", "admin"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.menu_items.update_one({"id": item_id}, {"$set": update})
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.menu_items.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"success": True}


# ============= ORDER ROUTES =============
def is_within_cutoff() -> bool:
    return now_ist().hour < ORDER_CUTOFF_HOUR


@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    # Cutoff enforcement is soft-warn only; keep placing allowed at all times for demo
    total = 0.0
    validated_items: List[dict] = []
    for it in payload.items:
        menu_item = await db.menu_items.find_one({"id": it.item_id}, {"_id": 0})
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Menu item {it.item_id} not found")
        if not menu_item.get("available", True):
            raise HTTPException(status_code=400, detail=f"{menu_item['name']} is unavailable")
        if it.quantity <= 0:
            raise HTTPException(status_code=400, detail="Invalid quantity")
        # NEW: Maximum quantity limit of 3 per item
        if it.quantity > 3:
            raise HTTPException(status_code=400, detail=f"Maximum order limit for {menu_item['name']} is 3")
        line = {
            "item_id": menu_item["id"],
            "name": menu_item["name"],
            "price": float(menu_item["price"]),
            "quantity": it.quantity,
        }
        total += line["price"] * line["quantity"]
        validated_items.append(line)

    # Unlimited stock — no decrement

    order = {
        "id": str(uuid.uuid4()),
        "employee_id": user["employee_id"],
        "employee_name": user["name"],
        "items": validated_items,
        "total": round(total, 2),
        "status": OrderStatus.pending.value,
        "notes": payload.notes or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    clean_order = clean(order)

    # Notify kitchen (cook + admin) that a new order arrived
    await ws_manager.broadcast_to_role("cook", {"type": "order_new", "data": clean_order})
    await ws_manager.broadcast_to_role("admin", {"type": "order_new", "data": clean_order})
    await push_notification(user["employee_id"], "Order placed", f"Order #{order['id'][:8]} received.", order["id"])
    return clean_order


@api_router.get("/orders", response_model=List[Order])
async def list_orders(
    scope: str = Query("mine", description="mine | all | active"),
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if user["role"] == "employee" or scope == "mine":
        query["employee_id"] = user["employee_id"]
    if scope == "active":
        query["status"] = {"$in": [OrderStatus.pending.value, OrderStatus.accepted.value, OrderStatus.preparing.value, OrderStatus.ready.value]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user["role"] == "employee" and order["employee_id"] != user["employee_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return order


@api_router.put("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, payload: OrderStatusUpdate, user: dict = Depends(require_roles("cook", "admin"))):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    new_status = payload.status.value
    await db.orders.update_one({"id": order_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})
    order["status"] = new_status
    order["updated_at"] = now_iso()

    # Notify employee
    friendly = {
        "accepted": "Your order has been accepted!",
        "preparing": "Your order is being prepared 🔥",
        "ready": "Your order is ready for pickup! 🎉",
        "completed": "Your order is complete. Enjoy!",
        "cancelled": "Your order was cancelled.",
    }.get(new_status, f"Status updated: {new_status}")
    await push_notification(order["employee_id"], "Order update", friendly, order_id)

    # Broadcast to kitchen/admin
    await ws_manager.broadcast_to_role("cook", {"type": "order_update", "data": order})
    await ws_manager.broadcast_to_role("admin", {"type": "order_update", "data": order})
    await ws_manager.send_to_user(order["employee_id"], {"type": "order_update", "data": order})
    return order


@api_router.delete("/orders/history")
async def clear_order_history(user: dict = Depends(require_roles("admin"))):
    orders_result = await db.orders.delete_many({})
    notifications_result = await db.notifications.delete_many({"order_id": {"$exists": True}})

    # Push a realtime clear signal so all open employee/cook/admin pages refresh immediately.
    await ws_manager.broadcast_to_role("cook", {"type": "order_history_cleared"})
    await ws_manager.broadcast_to_role("admin", {"type": "order_history_cleared"})

    employee_ids = await db.employees.distinct("employee_id", {"role": "employee", "active": True})
    for employee_id in employee_ids:
        await ws_manager.send_to_user(employee_id, {"type": "order_history_cleared"})

    return {
        "success": True,
        "orders_deleted": orders_result.deleted_count,
        "notifications_deleted": notifications_result.deleted_count,
    }


# ============= NOTIFICATIONS =============
@api_router.get("/notifications", response_model=List[Notification])
async def list_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find({"employee_id": user["employee_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return notifs


@api_router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "employee_id": user["employee_id"]}, {"$set": {"read": True}})
    return {"success": True}


@api_router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"employee_id": user["employee_id"], "read": False}, {"$set": {"read": True}})
    return {"success": True}


# ============= WEB PUSH =============
@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key(user: dict = Depends(get_current_user)):
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return {"public_key": VAPID_PUBLIC_KEY}


@api_router.post("/push/subscribe")
async def subscribe_push(payload: PushSubscribeRequest, user: dict = Depends(get_current_user)):
    endpoint = payload.subscription.endpoint
    await db.push_subscriptions.update_one(
        {"employee_id": user["employee_id"], "endpoint": endpoint},
        {"$set": {
            "employee_id": user["employee_id"],
            "endpoint": endpoint,
            "subscription": payload.subscription.model_dump(),
            "updated_at": now_iso(),
        }, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return {"success": True}


@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload: PushSubscribeRequest, user: dict = Depends(get_current_user)):
    endpoint = payload.subscription.endpoint
    await db.push_subscriptions.delete_one({"employee_id": user["employee_id"], "endpoint": endpoint})
    return {"success": True}


@api_router.post("/push/test")
async def test_push(payload: PushTestRequest, user: dict = Depends(get_current_user)):
    await push_notification(user["employee_id"], payload.title, payload.body)
    return {"success": True}


# ============= ADMIN USER MGMT =============
@api_router.get("/users", response_model=List[UserPublic])
async def list_users(user: dict = Depends(require_roles("admin"))):
    users = await db.employees.find({}, {"_id": 0, "hashed_password": 0}).sort("created_at", -1).to_list(500)
    return users


@api_router.post("/users", response_model=UserPublic)
async def create_user(payload: UserCreate, user: dict = Depends(require_roles("admin"))):
    existing = await db.employees.find_one({"employee_id": payload.employee_id})
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    new_user = {
        "id": str(uuid.uuid4()),
        "employee_id": payload.employee_id,
        "name": payload.name,
        "email": (payload.email or "").lower() or None,
        "role": payload.role.value,
        "hashed_password": hash_password(payload.password),
        "active": True,
        "created_at": now_iso(),
    }
    await db.employees.insert_one(new_user.copy())
    new_user.pop("hashed_password", None)
    return clean(new_user)


@api_router.put("/users/{employee_id}", response_model=UserPublic)
async def update_user(employee_id: str, payload: UserUpdate, user: dict = Depends(require_roles("admin"))):
    update = {}
    data = payload.model_dump()
    if data.get("name") is not None: update["name"] = data["name"]
    if data.get("email") is not None: update["email"] = data["email"].lower() if data["email"] else None
    if data.get("password") is not None: update["hashed_password"] = hash_password(data["password"])
    if data.get("active") is not None: update["active"] = data["active"]
    if data.get("role") is not None: update["role"] = data["role"]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.employees.update_one({"employee_id": employee_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    u = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0, "hashed_password": 0})
    return u


@api_router.delete("/users/{employee_id}")
async def delete_user(employee_id: str, user: dict = Depends(require_roles("admin"))):
    if employee_id == user["employee_id"]:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    res = await db.employees.delete_one({"employee_id": employee_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}


# ============= ADMIN ANALYTICS =============
@api_router.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(require_roles("admin"))):
    today_start = ist_midnight_utc_iso()
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    total_orders_today = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    total_orders_week = await db.orders.count_documents({"created_at": {"$gte": week_start}})
    total_users = await db.employees.count_documents({})

    # Revenue today
    pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}}
    ]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    revenue_today = rev[0]["revenue"] if rev else 0.0

    # Weekly revenue trend by day
    week_pipeline = [
        {"$match": {"created_at": {"$gte": week_start}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"}
        }},
        {"$sort": {"_id": 1}}
    ]
    trend_docs = await db.orders.aggregate(week_pipeline).to_list(30)
    trend = [{"date": d["_id"], "orders": d["orders"], "revenue": round(d["revenue"], 2)} for d in trend_docs]

    # Top items
    top_pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.name",
            "quantity": {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}}
        }},
        {"$sort": {"quantity": -1}},
        {"$limit": 5}
    ]
    top_docs = await db.orders.aggregate(top_pipeline).to_list(5)
    top_items = [{"name": d["_id"], "quantity": d["quantity"], "revenue": round(d["revenue"], 2)} for d in top_docs]

    return {
        "orders_today": total_orders_today,
        "orders_week": total_orders_week,
        "revenue_today": round(revenue_today, 2),
        "total_users": total_users,
        "weekly_trend": trend,
        "top_items": top_items,
    }


@api_router.get("/analytics/export")
async def export_csv(user: dict = Depends(require_roles("admin"))):
    today_start = ist_midnight_utc_iso()
    orders = await db.orders.find({"created_at": {"$gte": today_start}}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order_id", "employee_id", "employee_name", "items", "total", "status", "created_at"])
    for o in orders:
        items_str = "; ".join([f"{i['name']} x{i['quantity']}" for i in o.get("items", [])])
        writer.writerow([o["id"], o["employee_id"], o["employee_name"], items_str, o["total"], o["status"], o["created_at"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="orders_{today_ist_str().replace("-", "")}.csv"'},
    )


# ============= WEBSOCKET =============
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: Optional[str] = Query(None)):
    if not token:
        await ws.close(code=1008)
        return
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        employee_id = payload.get("sub")
        role = payload.get("role")
        if not employee_id or not role:
            await ws.close(code=1008)
            return
    except jwt.PyJWTError:
        await ws.close(code=1008)
        return

    await ws_manager.connect(ws, employee_id, role)
    try:
        while True:
            # keep-alive: read pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, employee_id, role)
    except Exception:
        ws_manager.disconnect(ws, employee_id, role)


# ============= SEED =============
async def seed_data():
    # Seed users
    seed_users = [
        {"employee_id": "admin", "name": "Admin User", "email": "admin@officebites.com", "role": "admin", "password": "admin123"},
        {"employee_id": "cook", "name": "Madhusudhan", "email": "cook@officebites.com", "role": "cook", "password": "cook123"},
        {"employee_id": "EMP001", "name": "Alice Johnson", "email": "alice@officebites.com", "role": "employee", "password": "emp123"},
        {"employee_id": "EMP002", "name": "David Kim", "email": "david@officebites.com", "role": "employee", "password": "emp123"},
        {"employee_id": "EMP003", "name": "Priya Sharma", "email": "priya@officebites.com", "role": "employee", "password": "emp123"},
    ]
    for u in seed_users:
        existing = await db.employees.find_one({"employee_id": u["employee_id"]})
        if not existing:
            doc = {
                "id": str(uuid.uuid4()),
                "employee_id": u["employee_id"],
                "name": u["name"],
                "email": u["email"],
                "role": u["role"],
                "hashed_password": hash_password(u["password"]),
                "active": True,
                "created_at": now_iso(),
            }
            await db.employees.insert_one(doc)

    # Seed menu
    count = await db.menu_items.count_documents({})
    if count == 0:
        items = [
            {"name": "Egg Sandwich", "description": "Grilled sandwich with spiced boiled egg filling", "category": "Breakfast",
             "image_url": "https://plus.unsplash.com/premium_photo-1723629749871-881a10d9daaa?w=600&auto=format&fit=crop"},
            {"name": "Paneer Sandwich", "description": "Grilled sandwich with spiced paneer filling", "category": "Breakfast",
             "image_url": "https://images.unsplash.com/photo-1673534751361-a610db445eef?w=600&auto=format&fit=crop"},
            {"name": "Bread Omlette", "description": "Fluffy omelette served with buttered bread slices", "category": "Breakfast",
             "image_url": "https://images.unsplash.com/photo-1571091716874-3041d15b119d?w=600&auto=format&fit=crop"},
            {"name": "Veg Maggie", "description": "Instant noodles tossed with mixed vegetables", "category": "Snacks",
             "image_url": "https://images.unsplash.com/photo-1714611446667-5321c3b4a3c6?w=600&auto=format&fit=crop"},
            {"name": "Egg Maggie", "description": "Instant noodles tossed with scrambled egg", "category": "Snacks",
             "image_url": "https://images.unsplash.com/photo-1637024698421-533d83c7b883?w=600&auto=format&fit=crop"},
            {"name": "Omlette", "description": "Classic fluffy omelette", "category": "Breakfast",
             "image_url": "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600&auto=format&fit=crop"},
            {"name": "Boiled Eggs", "description": "Two fresh farm eggs, boiled", "category": "Breakfast",
             "image_url": "https://images.unsplash.com/photo-1680987398307-e1ae27a6ed67?w=600&auto=format&fit=crop"},
        ]
        for it in items:
            doc = {
                "id": str(uuid.uuid4()),
                "created_at": now_iso(),
                "available": True,
                **it,
            }
            await db.menu_items.insert_one(doc)


# ============= UPDATES (Announcements) =============
class UpdateItem(BaseModel):
    id: str
    title: str
    body: str
    priority: str = "normal"  # normal | high
    pinned: bool = False
    created_at: str


class UpdateCreate(BaseModel):
    title: str
    body: str
    priority: str = "normal"
    pinned: bool = False


class UpdatePatch(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    priority: Optional[str] = None
    pinned: Optional[bool] = None


@api_router.get("/updates", response_model=List[UpdateItem])
async def list_updates(user: dict = Depends(get_current_user)):
    docs = await db.updates.find({}, {"_id": 0}).sort([("pinned", -1), ("created_at", -1)]).to_list(500)
    return docs


@api_router.post("/updates", response_model=UpdateItem)
async def create_update(payload: UpdateCreate, user: dict = Depends(require_roles("admin"))):
    item = {"id": str(uuid.uuid4()), "created_at": now_iso(), **payload.model_dump()}
    await db.updates.insert_one(item.copy())
    # Notify all employees
    employees = await db.employees.find({"role": "employee", "active": True}, {"_id": 0, "employee_id": 1}).to_list(1000)
    for e in employees:
        await push_notification(e["employee_id"], "New update", item["title"])
    return clean(item)


@api_router.put("/updates/{update_id}", response_model=UpdateItem)
async def update_update(update_id: str, payload: UpdatePatch, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.updates.update_one({"id": update_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Update not found")
    doc = await db.updates.find_one({"id": update_id}, {"_id": 0})
    return doc


@api_router.delete("/updates/{update_id}")
async def delete_update(update_id: str, user: dict = Depends(require_roles("admin"))):
    res = await db.updates.delete_one({"id": update_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Update not found")
    return {"success": True}


# ============= FOOD POLLS =============
DEFAULT_POLL_OPTIONS = ["yes", "no"]
MONDAY, WEDNESDAY = 0, 2  # Python weekday(): Monday=0 ... Sunday=6

LUNCH_OPTIONS_VEG_DAY = ["Non-Veg", "Veg", "No lunch (WFO)"]
LUNCH_OPTIONS_DEFAULT = ["Yes, I need lunch", "No lunch (WFO)"]


class Poll(BaseModel):
    id: str
    kind: str  # "lunch" | "snacks"
    title: str
    description: str
    date: str  # YYYY-MM-DD
    closes_at: str  # ISO
    active: bool = True
    options: List[str] = Field(default_factory=lambda: list(DEFAULT_POLL_OPTIONS))
    created_at: str


class PollCreate(BaseModel):
    kind: str
    title: str
    description: str = ""
    date: str
    closes_at: str
    active: bool = True
    options: List[str] = Field(default_factory=lambda: list(DEFAULT_POLL_OPTIONS))


class PollPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    closes_at: Optional[str] = None
    active: Optional[bool] = None
    options: Optional[List[str]] = None


class PollVote(BaseModel):
    response: str


def poll_options(poll: dict) -> List[str]:
    return poll.get("options") or list(DEFAULT_POLL_OPTIONS)


async def count_poll_options(poll_id: str, options: List[str]) -> Dict[str, int]:
    return {opt: await db.poll_votes.count_documents({"poll_id": poll_id, "response": opt}) for opt in options}


LUNCH_POLL_OPEN_HOUR = 6
LUNCH_POLL_CLOSE_HOUR = 11


async def ensure_daily_lunch_poll():
    """Auto-generates today's Lunch poll (Mon-Fri, IST) if one doesn't already exist.
    Mon/Wed get a Veg/Non-Veg/No-lunch choice; Tue/Thu/Fri get a simple Yes/No-lunch choice.
    Weekends get no lunch poll. Poll opens at 6 AM IST and closes at 11 AM IST."""
    ist_now = now_ist()
    weekday = ist_now.weekday()
    if weekday > 4:  # Saturday, Sunday
        return
    if ist_now.hour < LUNCH_POLL_OPEN_HOUR:  # not open yet today
        return
    today = today_ist_str()
    existing = await db.polls.find_one({"kind": "lunch", "date": today}, {"_id": 0})
    if existing:
        return

    if weekday in (MONDAY, WEDNESDAY):
        options = list(LUNCH_OPTIONS_VEG_DAY)
        description = "Choose your lunch option for today."
    else:
        options = list(LUNCH_OPTIONS_DEFAULT)
        description = "Will you have lunch today?"

    closes_at = datetime.combine(ist_now.date(), dt_time(LUNCH_POLL_CLOSE_HOUR, 0), tzinfo=IST).astimezone(timezone.utc).isoformat()
    poll = {
        "id": str(uuid.uuid4()),
        "kind": "lunch",
        "title": "Today's Lunch",
        "description": description,
        "date": today,
        "closes_at": closes_at,
        "active": True,
        "options": options,
        "created_at": now_iso(),
    }
    await db.polls.insert_one(poll.copy())
    employees = await db.employees.find({"role": "employee", "active": True}, {"_id": 0, "employee_id": 1}).to_list(1000)
    for e in employees:
        await push_notification(e["employee_id"], "New food poll", poll["title"])
    await ws_manager.broadcast_to_role("admin", {"type": "poll_vote", "poll_id": poll["id"]})


@api_router.get("/polls/today")
async def polls_today(user: dict = Depends(get_current_user)):
    await ensure_daily_lunch_poll()
    today = today_ist_str()
    polls = await db.polls.find({"date": today, "active": True}, {"_id": 0}).to_list(10)
    result = []
    for p in polls:
        options = poll_options(p)
        p["options"] = options
        counts = await count_poll_options(p["id"], options)
        my = await db.poll_votes.find_one({"poll_id": p["id"], "employee_id": user["employee_id"]}, {"_id": 0})
        result.append({"poll": p, "my_vote": my["response"] if my else None, "option_counts": counts})
    return result


@api_router.get("/polls")
async def list_polls(user: dict = Depends(require_roles("admin"))):
    await ensure_daily_lunch_poll()
    polls = await db.polls.find({}, {"_id": 0}).sort("date", -1).to_list(200)
    for p in polls:
        options = poll_options(p)
        p["options"] = options
        p["option_counts"] = await count_poll_options(p["id"], options)
    return polls


@api_router.post("/polls", response_model=Poll)
async def create_poll(payload: PollCreate, user: dict = Depends(require_roles("admin"))):
    if payload.kind not in ("lunch", "snacks"):
        raise HTTPException(status_code=400, detail="kind must be lunch or snacks")
    if len(payload.options) < 2:
        raise HTTPException(status_code=400, detail="A poll needs at least 2 options")
    # Upsert per (kind, date)
    existing = await db.polls.find_one({"kind": payload.kind, "date": payload.date}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail=f"A {payload.kind} poll already exists for {payload.date}. Edit it instead.")
    poll = {"id": str(uuid.uuid4()), "created_at": now_iso(), **payload.model_dump()}
    await db.polls.insert_one(poll.copy())
    # Notify employees
    employees = await db.employees.find({"role": "employee", "active": True}, {"_id": 0, "employee_id": 1}).to_list(1000)
    for e in employees:
        await push_notification(e["employee_id"], "New food poll", poll["title"])
    return clean(poll)


@api_router.put("/polls/{poll_id}", response_model=Poll)
async def update_poll(poll_id: str, payload: PollPatch, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "options" in upd and len(upd["options"]) < 2:
        raise HTTPException(status_code=400, detail="A poll needs at least 2 options")
    res = await db.polls.update_one({"id": poll_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Poll not found")
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    # Notify employees of update
    employees = await db.employees.find({"role": "employee", "active": True}, {"_id": 0, "employee_id": 1}).to_list(1000)
    for e in employees:
        await push_notification(e["employee_id"], "Poll updated", poll["title"])
    return poll


@api_router.delete("/polls/{poll_id}")
async def delete_poll(poll_id: str, user: dict = Depends(require_roles("admin"))):
    await db.polls.delete_one({"id": poll_id})
    await db.poll_votes.delete_many({"poll_id": poll_id})
    return {"success": True}


@api_router.post("/polls/{poll_id}/vote")
async def vote_poll(poll_id: str, payload: PollVote, user: dict = Depends(get_current_user)):
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    options = poll_options(poll)
    if payload.response not in options:
        raise HTTPException(status_code=400, detail=f"response must be one of: {', '.join(options)}")
    if not poll.get("active", True):
        raise HTTPException(status_code=400, detail="Poll is closed")
    try:
        closes = datetime.fromisoformat(poll["closes_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > closes:
            raise HTTPException(status_code=400, detail="Poll has closed")
    except HTTPException:
        raise
    except Exception:
        pass
    await db.poll_votes.update_one(
        {"poll_id": poll_id, "employee_id": user["employee_id"]},
        {"$set": {"response": payload.response, "voted_at": now_iso(), "employee_name": user["name"]}},
        upsert=True,
    )
    # Broadcast to admins so dashboards refresh live
    await ws_manager.broadcast_to_role("admin", {"type": "poll_vote", "poll_id": poll_id})
    return {"success": True, "response": payload.response}


@api_router.get("/polls/{poll_id}/responses")
async def poll_responses(poll_id: str, user: dict = Depends(get_current_user)):
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    options = poll_options(poll)
    votes = await db.poll_votes.find({"poll_id": poll_id}, {"_id": 0}).sort("voted_at", -1).to_list(500)
    grouped: Dict[str, List[dict]] = {opt: [] for opt in options}
    for v in votes:
        grouped.setdefault(v["response"], []).append(v)
    return {
        "options": options,
        "counts": {opt: len(grouped.get(opt, [])) for opt in options},
        "responses": grouped,
    }


@api_router.get("/analytics/polls")
async def poll_analytics(user: dict = Depends(require_roles("admin"))):
    pipeline = [
        {"$lookup": {"from": "polls", "localField": "poll_id", "foreignField": "id", "as": "poll"}},
        {"$unwind": "$poll"},
        {"$group": {"_id": {"date": "$poll.date", "kind": "$poll.kind", "response": "$response"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.date": -1}},
    ]
    rows = await db.poll_votes.aggregate(pipeline).to_list(1000)
    trend: Dict[str, Dict] = {}
    for r in rows:
        d = r["_id"]["date"]; k = r["_id"]["kind"]; resp = r["_id"]["response"]
        day = trend.setdefault(d, {"date": d, "lunch": {}, "snacks": {}})
        day.setdefault(k, {})[resp] = r["count"]
    return {"trend": sorted(trend.values(), key=lambda x: x["date"], reverse=True)[:14]}


@app.on_event("startup")
async def startup():
    await seed_data()
    await ensure_daily_lunch_poll()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
