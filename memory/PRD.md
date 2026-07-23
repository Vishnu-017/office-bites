# OfficeBites — Product Requirements Document (MVP)

## Overview
A web-based PWA for office breakfast ordering with **three role-based interfaces** in a single app: Employee, Cook (kitchen staff) and Admin. Installable, with offline-capable service worker and Web Push notifications.

## Tech Stack
- Frontend: React 18 + TypeScript, Vite, React Router, `vite-plugin-pwa` (PWA/service worker)
- Backend: FastAPI, Motor (MongoDB async), PyJWT (HS256), bcrypt password hashing, `pywebpush` (VAPID) for push notifications
- Database: MongoDB (single instance)
- Storage: MongoDB collections `employees`, `menu_items`, `orders`, `notifications`, `updates`, `polls`

## Roles & Screens
### Employee (`/employee`)
- **Menu** — category browsing, search, add-to-cart with quantity
- **Cart** — quantity adjust, notes, checkout → creates order, clears cart
- **Orders** — status timeline (pending → accepted → preparing → ready → completed)
- **Polls** — vote in active polls
- **Updates** — announcement feed
- **Profile** — logout

### Cook (`/cook`)
- **Dashboard** — kitchen ticket view, status advancement per order
- **Profile** — logout

### Admin (`/admin`)
- **Dashboard** — KPIs, analytics, CSV export
- **Menu** — full CRUD
- **Users** — CRUD employees/cooks/admins with role assignment
- **Polls** — create/manage polls, view responses
- **Updates** — create/manage announcements
- **Profile** — logout

## Backend API (all `/api` prefix)
- `POST /auth/login` — JWT (accepts employee_id)
- `GET /auth/me`
- `GET/POST/PUT/DELETE /menu[/{id}]` — role-gated
- `POST /orders`, `GET /orders?scope=...`, `GET /orders/{id}`, `PUT /orders/{id}/status`, `DELETE /orders/history`
- `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
- `GET /push/vapid-public-key`, `POST /push/subscribe`, `POST /push/unsubscribe`, `POST /push/test`
- `GET/POST/PUT/DELETE /users[/{employee_id}]` — admin only
- `GET /analytics/summary`, `GET /analytics/export` (CSV), `GET /analytics/polls` — admin only
- `GET/POST/PUT/DELETE /updates[/{id}]` — announcements
- `GET /polls/today`, `GET/POST/PUT/DELETE /polls[/{id}]`, `POST /polls/{id}/vote`, `GET /polls/{id}/responses`

## Auth
Custom JWT (HS256, 7-day expiry). Passwords bcrypt-hashed. Token stored in `localStorage`. Role-based route guards on both frontend layouts and backend dependency checks.

## Notifications
Real-time-ish updates are delivered via Web Push (VAPID keys, `pywebpush`) plus an in-app notifications feed, rather than a persistent WebSocket connection.

## Seed Data
5 users (admin, cook, 3 employees) + 8 menu items on startup (idempotent). See `/app/memory/test_credentials.md`.

## Business Enhancement
CSV export empowers Admin to reconcile daily kitchen spend with finance — turning a simple in-house tool into an auditable expense system.
