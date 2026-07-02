# OfficeBites — Product Requirements Document (MVP)

## Overview
A React Native (Expo) mobile app for office breakfast ordering with **three role-based interfaces** in a single app: Employee, Cook (kitchen staff) and Admin.

## Tech Stack
- Frontend: Expo (SDK 54) + expo-router, TypeScript, React Native, expo-secure-store, expo-image, expo-linear-gradient
- Backend: FastAPI, Motor (MongoDB async), python-jose JWT, bcrypt password hashing, WebSocket for real-time
- Database: MongoDB (single instance)
- Storage: MongoDB collections `employees`, `menu_items`, `orders`, `notifications`

## Roles & Screens
### Employee (`/(employee)`) — 4 tabs
- **Menu** — hero card, category chips, search, add-to-cart with quantity, sticky View Cart CTA
- **Cart** — quantity adjust, notes, checkout → creates order, clears cart, navigates to Orders
- **Orders** — timeline (pending → accepted → preparing → ready → completed), live via WebSocket
- **Notifications** — in-app feed, unread badge, mark-all-read
- **Profile** — logout

### Cook (`/(cook)`) — dark-first KDS
- **Kitchen** — sticky filter chips (Active/New/Preparing/Ready/Done), live ticket cards with mono-space timer, single-tap status advancement
- **Menu Manage** — CRUD daily items, toggle availability, edit stock/price
- **Profile** — logout

### Admin (`/(admin)`) — 4 tabs
- **Dashboard** — 4 KPI cards, weekly bar chart, most-ordered items, **Export CSV** button
- **Menu** — full CRUD + delete
- **Users** — CRUD employees/cooks/admins with role assignment
- **Profile** — logout

## Backend API (all `/api` prefix)
- `POST /auth/login` — JWT (accepts employee_id OR email)
- `GET /auth/me`
- `GET/POST/PUT/DELETE /menu[/{id}]` — role-gated
- `POST /orders`, `GET /orders?scope=mine|active|all`, `GET /orders/{id}`, `PUT /orders/{id}/status`
- `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
- `GET/POST/PUT/DELETE /users[/{employee_id}]` — admin only
- `GET /analytics/summary`, `GET /analytics/export` (CSV) — admin only
- `WS /api/ws?token=...` — real-time order + notification pushes to cooks, admins, and the ordering employee

## Auth
Custom JWT (HS256, 7-day expiry). Passwords bcrypt-hashed. Token stored in `expo-secure-store` (native) or `localStorage` (web). Role-based route guards on both frontend layouts and backend `RoleChecker` dependency.

## Seed Data
5 users (admin, cook, 3 employees) + 8 menu items on startup (idempotent). See `/app/memory/test_credentials.md`.

## Business Enhancement
CSV export empowers Admin to reconcile daily kitchen spend with finance — turning a simple in-house tool into an auditable expense system.
