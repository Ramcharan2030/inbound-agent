# SOP

## Keep It Small

This branch is only for:
- Gemini 3.1 Live calls
- The dashboard
- Calendar and logs
- Inbound call handling

Do not add the old WhatsApp or knowledge-base pieces back unless you really mean to rebuild them.

## Local run

1. Put secrets in `.env`.
2. Run `python start_stack.py`.
3. Open `http://127.0.0.1:8000`.

## Coolify run

1. Use the repo `Dockerfile`.
2. Set the public web port to `8000`.
3. Add all env vars in Coolify.
4. Deploy and watch the logs.

## Gemini 3.1 Live defaults

- Model: `gemini-3.1-flash-live-preview`
- Voice: `Puck`
- Voice mode: `gemini_live`
