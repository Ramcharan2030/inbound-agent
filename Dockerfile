FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


FROM node:22-slim AS frontend_builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_ALLOWED_EMAILS
ARG VITE_ALLOWED_EMAIL_DOMAINS
ARG VITE_API_BASE_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_ALLOWED_EMAILS=$VITE_ALLOWED_EMAILS \
    VITE_ALLOWED_EMAIL_DOMAINS=$VITE_ALLOWED_EMAIL_DOMAINS \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM python:3.11-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y \
    supervisor \
    ca-certificates \
    libgomp1 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
COPY . .
COPY --from=frontend_builder /app/frontend/dist ./frontend/dist
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /app/data /app/data/kb

ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    AGENT_HOST=0.0.0.0 \
    AGENT_PORT=8081 \
    APP_DATA_DIR=/app/data \
    APP_CONFIG_FILE=/app/data/config.json \
    KB_DATA_DIR=/app/data/kb

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health', timeout=3)"

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
