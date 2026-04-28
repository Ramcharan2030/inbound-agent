# SOP

## Keep It Small

This branch is only for:
- Gemini 3.1 Live calls
- The backend API for a separately built dashboard
- Calendar and logs
- Inbound call handling

Do not add the old WhatsApp or knowledge-base pieces back unless you really mean to rebuild them.

The dashboard is not bundled in this repo. To build it, use `docs/ui-agent-prompt.md` with a coding agent and tell the agent to create the actual frontend files.

## Local run

1. Put secrets in `.env`.
2. Run `python start_stack.py`.
3. Open `http://127.0.0.1:8000/health`.
4. Confirm it returns `ok`.

## Frontend run

1. Open `docs/ui-agent-prompt.md`.
2. Copy the full prompt.
3. Paste it into a coding agent.
4. Add: `Use this prompt to build the actual frontend application now. Do not just explain the instructions. Create the files, install the packages, and make it runnable.`
5. Set the generated frontend API URL to `http://127.0.0.1:8000`.
6. Run `npm install`.
7. Run `npm run dev`.

## Coolify run

1. Use the repo `Dockerfile`.
2. Set the public web port to `8000`.
3. Add all env vars in Coolify.
4. Deploy and watch the logs.
5. Deploy the generated frontend as a separate app and point it to the backend URL.

## Gemini 3.1 Live defaults

- Model: `gemini-3.1-flash-live-preview`
- Voice: `Puck`
- Voice mode: `gemini_live`
