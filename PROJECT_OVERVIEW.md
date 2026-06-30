# Inbound Agent — Project Overview

This repository implements an inbound/outbound agent backend and frontend for handling calls, knowledge base lookups, scheduling, and related services.

## Quick summary
- Language: Python backend, TypeScript React frontend
- Key features: call handling, KB worker, scheduling, web UI, DB backends

## Quick start (Windows)
1. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Start the backend (example):

```powershell
# run the Python server (adjust env/config as needed)
python start_stack.py
```

3. Start the frontend (from `frontend` folder):

```powershell
cd frontend
npm install
npm run dev
```

## Project layout (high level)
- `agent_backend.py`, `agent.py`, `backend_api.py` — core backend services and API
- `db*.py` — database access and scheduling helpers
- `kb.py`, `kb_worker.py` — knowledge-base management and worker
- `frontend/` — React + Vite UI (see `frontend/README.md`)
- `configs/`, `data/` — configuration and runtime data

## Configuration
- Copy `config.example.json` or `configs/default.example.json` to `data/config.json` and edit.

## Notes
- See `QUICKSTART.md` and `README.md` for detailed deployment and architecture notes.
- Use `start_stack.ps1` on Windows for a scripted startup.

If you'd like a different markdown file (detailed README, developer guide, or changelog), tell me which and I'll create it.
