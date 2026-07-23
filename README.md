# OfficeBites

OfficeBites is a workplace breakfast ordering system. Employees browse the daily menu and place orders before a cutoff time, cooks manage and fulfill orders from the kitchen, and admins manage the menu, users, polls, and announcements. The frontend is a React PWA (installable, works offline-ish via a service worker) backed by a FastAPI + MongoDB API.

## Project structure

```
backend/          FastAPI backend (Python)
  server.py       API routes, models, auth, business logic
  requirements.txt
  run.sh          Dev server launcher (frees port 8000, runs uvicorn)
  tests/

frontend-web/      React + TypeScript PWA (Vite)
  src/
    api/           API client
    context/        Auth context
    components/     Shared layout/components
    pages/
      admin/        Dashboard, Menu, Users, Polls, Updates, Profile
      cook/         Dashboard, Profile
      employee/     Menu, Cart, Orders, Polls, Updates, Profile
    utils/          Date/time helpers, push notification helpers

tests/              Project-level test suites
test_reports/       Generated test output
design_guidelines.json
```

## Roles

- **Employee** — browse the menu, add items to cart, place/track orders, vote in polls, view updates.
- **Cook** — view and manage incoming orders through their lifecycle (accepted → preparing → ready → completed).
- **Admin** — manage the menu, users, polls, and announcements, and view dashboards.

## Tech stack

- **Backend**: FastAPI, MongoDB (via Motor), JWT auth (PyJWT + bcrypt), Web Push (VAPID)
- **Frontend**: React 18, TypeScript, Vite, React Router, `vite-plugin-pwa` (installable PWA with a service worker)

## Prerequisites

- Python 3.10+
- Node.js 18+
- A running MongoDB instance

## Backend setup

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=officebites
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=change-me
```

Run the API (defaults to port 8000):

```bash
./run.sh
# or: uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

```bash
cd frontend-web
npm install
```

Create `frontend-web/.env`:

```
VITE_API_URL=http://localhost:8000
```

Run the dev server (defaults to port 3000):

```bash
npm run dev
```

Other scripts:

```bash
npm run build     # type-check + production build
npm run preview   # preview the production build
npm run lint      # eslint
```

## Tests

Backend tests live in `backend/tests/`; project-level tests live in `tests/`. See `test_result.md` for the latest recorded test run.
