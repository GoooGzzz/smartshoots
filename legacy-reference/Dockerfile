# Production image for the cloud-hosted backend (see DEPLOY.md).
# This is NOT used by the Windows or Android builds - those bundle/run
# the backend their own way (PyInstaller freeze, or talk to this over
# the network). This image gives the Android app (and optionally the
# desktop app, or a plain browser) one shared, always-on backend instead
# of each device running its own local copy.

# ---- Stage 1: build the frontend (same source as the desktop/Android builds) ----
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
# -> /frontend/dist

# ---- Stage 2: the actual Django backend image ----
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Bring in the frontend built in stage 1 - so a browser hitting this
# server directly gets the real app, same as the desktop build, not just
# a bare API with no UI.
COPY --from=frontend-build /frontend/dist ./frontend/dist

# Data (SQLite db, media uploads) lives on a mounted volume so it
# survives container rebuilds/updates - see docker-compose.yml.
ENV SMARTSHOOTS_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8000

# Same run_server.py the desktop app uses (auto-migrate, auto-seed
# reference data, auto-create the first admin account) - one code path
# for startup behavior instead of maintaining two.
CMD ["python", "run_server.py"]
