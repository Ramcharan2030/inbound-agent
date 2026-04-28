# Coolify Deployment

This branch deploys a single backend-only container with three processes under Supervisor:

- `backend_api`
- `agent`
- `kb_worker`

This deployment is only the backend. It does not deploy a frontend dashboard.

## Environment

Coolify should provide `HOST` and `PORT`. You still need to set:

- LiveKit credentials
- Google API key
- Supabase URL and key
- optional Telegram and S3 recording settings

## Persistent storage

Mount `/app/data` if you want these to survive redeploys:

- `data/config.json`
- local KB files and indexes

## Health

Use `GET /health` for the container healthcheck target.

## Frontend Deployment

Build the frontend separately with `docs/ui-agent-prompt.md`.

The prompt is meant to create the actual frontend application. Paste the full prompt into a coding agent and add:

```text
Use this prompt to build the actual frontend application now. Do not just explain the instructions. Create the files, install the packages, and make it runnable.
```

Deploy the generated frontend as a separate Coolify app.

Set the frontend API base URL to the public backend URL, for example:

```env
VITE_API_BASE_URL=https://your-backend.example.com
```

or:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```
