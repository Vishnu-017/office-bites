#!/bin/bash
# Frees port 8000 if a previous server instance is still holding it, then starts the API.
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
uvicorn server:app --reload --host 0.0.0.0 --port 8000
