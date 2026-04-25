# SPX Voice Agent

Inbound-only voice agent built for Gemini 3.1 Live, LiveKit SIP, and Vobiz.

This branch is the stripped-down version:
- inbound calls only
- no outbound dialer
- no WhatsApp in the default runtime
- FastAPI dashboard on port `8000`
- LiveKit agent name: `inbound-voice-agent`

Video walkthrough: coming soon. Add your YouTube link here when it is ready.

## What This App Does

Very simple flow:
1. Someone calls your Vobiz number.
2. Vobiz sends that SIP call to LiveKit.
3. LiveKit matches the inbound trunk and dispatch rule.
4. LiveKit dispatches `inbound-voice-agent` into the room.
5. This repo joins the room and talks to the caller using Gemini 3.1 Live.

## What You Need

You need 4 accounts or services:
- Google AI Studio or Gemini API access
- LiveKit Cloud
- Vobiz
- Supabase

Only 4 env vars are required to boot the app:

```env
GOOGLE_API_KEY=your_gemini_api_key
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

Recommended extras:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
WHATSAPP_ENABLED=false
```

Important:
- keep `WHATSAPP_ENABLED=false` in this branch
- this repo does not need `SIP_TRUNK_ID`
- this repo does not place outbound calls

## A To Z Setup

### 1. Clone The Repo

```bash
git clone <your-repo-url>
cd SPXAgent
```

### 2. Create `.env`

Copy [.env.example](/c:/Users/alpha/OneDrive/Documents/SPXAgent/.env.example) to `.env`.

Minimum working `.env`:

```env
UI_HOST=0.0.0.0
UI_PORT=8000
AGENT_HOST=0.0.0.0
AGENT_PORT=8081

GOOGLE_API_KEY=your_gemini_api_key
VOICE_MODE=gemini_live
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_LIVE_VOICE=Puck

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key

WHATSAPP_ENABLED=false
```

### 3. Install Python Dependencies

Windows:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Set Up Supabase

Supabase is where the app stores call logs, appointments, active calls, and metrics.

Do this:
1. Create a new Supabase project.
2. Open SQL Editor.
3. Run the full contents of [sql/supabase/setup.sql](/c:/Users/alpha/OneDrive/Documents/SPXAgent/sql/supabase/setup.sql).
4. Open Project Settings -> API.
5. Copy:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

Notes:
- the repo expects the schema from `setup.sql`
- if the schema is missing, parts of the dashboard will load but data will be empty or fail

### 5. Set Up LiveKit Cloud

Do this:
1. Create a LiveKit Cloud project.
2. Open Settings.
3. Copy:
   - project WebSocket URL -> `LIVEKIT_URL`
   - API key -> `LIVEKIT_API_KEY`
   - API secret -> `LIVEKIT_API_SECRET`

You also need your LiveKit SIP domain.

It looks like:

```text
your-project.sip.livekit.cloud
```

You will paste that into Vobiz as the `inbound_destination`.

### 6. Create The LiveKit Inbound SIP Trunk

LiveKit docs say you need:
- an inbound trunk
- a dispatch rule

Source:
- https://docs.livekit.io/sip/trunk-inbound
- https://docs.livekit.io/sip/dispatch-rule
- https://docs.livekit.io/agents/build/dispatch

Dashboard path:
1. Open LiveKit Cloud.
2. Go to Telephony -> Configuration.
3. Select Create new -> Trunk.
4. Choose Inbound.
5. Create an inbound trunk for your phone number.

Simple example JSON:

```json
{
  "name": "SPX inbound trunk",
  "numbers": ["+919999999999"]
}
```

Replace `+919999999999` with the actual Vobiz number people will call.

After saving, LiveKit will give you a trunk ID. Save it for your notes. The app itself does not need it in `.env`.

### 7. Create The LiveKit Dispatch Rule

This is the most important LiveKit step.

If this is wrong, the call reaches LiveKit but your worker never joins.

Create a SIP dispatch rule that sends each caller to a new room and dispatches this agent:

```json
{
  "name": "SPX inbound dispatch",
  "dispatchRule": {
    "rule": {
      "dispatchRuleIndividual": {
        "roomPrefix": "call-"
      }
    }
  },
  "roomConfig": {
    "agents": [
      {
        "agentName": "inbound-voice-agent"
      }
    ]
  }
}
```

If you want this rule to apply only to one trunk, add `trunkIds` with your LiveKit inbound trunk ID.

The one field that must match this repo exactly is:

```json
"agentName": "inbound-voice-agent"
```

If you use anything else like `outbound-caller`, LiveKit will dispatch the wrong worker.

### 8. Set Up Vobiz

Vobiz is your telephony provider here. Vobiz receives the phone call first. Then it forwards the SIP call to LiveKit.

Source:
- https://www.docs.vobiz.ai/whatsapp/api/authentication
- https://www.docs.vobiz.ai/trunks/retrieve-trunk

Get your Vobiz API credentials:
1. Log in to Vobiz Console.
2. Go to Settings -> API Keys.
3. Copy your `Auth ID`.
4. Generate and save your `Auth Token`.

Useful Vobiz values to save:
- `auth_id`
- `auth_token`
- `account_id`
- `trunk_id`
- `trunk_domain`

### 9. Create The Vobiz SIP Trunk

The key Vobiz setting is:

```text
inbound_destination = your-project.sip.livekit.cloud
```

That tells Vobiz to send the inbound phone call to LiveKit.

Example request from the Vobiz docs style:

```bash
curl -X POST "https://api.vobiz.ai/api/v1/account/{account_id}/trunks" \
  -H "X-Auth-ID: {auth_id}" \
  -H "X-Auth-Token: {auth_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SPX Inbound Trunk",
    "trunk_direction": "both",
    "transport": "udp",
    "secure": false,
    "inbound_destination": "your-project.sip.livekit.cloud"
  }'
```

What to replace:
- `{account_id}` with your Vobiz account ID
- `{auth_id}` with your Vobiz Auth ID
- `{auth_token}` with your Vobiz Auth Token
- `your-project.sip.livekit.cloud` with your real LiveKit SIP domain

After creation, save:
- `trunk_id`
- `trunk_domain`

### 10. Make Sure Your Vobiz Number Routes Into That Trunk

This part depends on how your Vobiz account is set up, but the goal is simple:

When someone dials your purchased Vobiz number, Vobiz must route that incoming call into the SIP trunk you created above.

If your number is attached to the wrong application or wrong trunk, the call will never reach LiveKit.

### 11. Run The App Locally

```bash
python start_stack.py
```

You should see:
- UI on `http://127.0.0.1:8000`
- worker registered as `inbound-voice-agent`

Open:

```text
http://127.0.0.1:8000
```

### 12. Test A Real Inbound Call

Call your Vobiz number.

The happy-path sequence is:
1. Vobiz receives the call.
2. Vobiz sends SIP to LiveKit.
3. LiveKit matches the inbound trunk.
4. LiveKit matches the dispatch rule.
5. LiveKit dispatches `inbound-voice-agent`.
6. This repo joins the room.
7. The agent says the opening line.

## Coolify Setup

### 1. Create A New Coolify App

1. Push this repo to GitHub.
2. In Coolify, create a new app from that repo.
3. Use the included `Dockerfile`.
4. Set public port to `8000`.

### 2. Add Environment Variables

Add at least:

```env
GOOGLE_API_KEY=your_gemini_api_key
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
WHATSAPP_ENABLED=false
```

Notes:
- Coolify may inject `PORT`; this repo already supports that
- no extra volume is required for basic use

### 3. Deploy

After deployment:
- open `/health`
- open `/`
- confirm worker logs show `registered worker` and `inbound-voice-agent`

## Local Checklist

If local setup is correct:
- `python start_stack.py` starts without crashing
- the dashboard opens
- `/health` works
- logs show `registered worker`
- logs show `agent_name: "inbound-voice-agent"`

## Troubleshooting

### The Call Never Reaches The Agent

Check these in order:
1. Vobiz number is routed into the right Vobiz SIP trunk.
2. Vobiz trunk `inbound_destination` is your LiveKit SIP domain.
3. LiveKit inbound trunk exists.
4. LiveKit dispatch rule exists.
5. Dispatch rule uses:
   - `agentName: "inbound-voice-agent"`
6. Your worker logs show:
   - `registered worker`

### LiveKit Receives The Call But The Wrong Worker Gets The Job

Your dispatch rule is wrong.

It must dispatch:

```json
"agentName": "inbound-voice-agent"
```

### The Agent Does Not Speak First

Check:
- `first_line` in `config.json`
- worker logs after join
- that you restarted the worker after code changes

### Dashboard Opens But No Data Appears

Check:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `sql/supabase/setup.sql` was actually run

### WhatsApp Errors Appear

This branch should not run WhatsApp by default.

Make sure:

```env
WHATSAPP_ENABLED=false
```

And restart the stack.

## Quick Smoke Test

Run:

```bash
python -m py_compile agent.py ui_server.py automation.py automation_worker.py db.py start_stack.py
python -c "import agent, ui_server, automation, db, start_stack; print('imports-ok')"
```

If both pass, the local codebase is sane.

## Short Version

If you want the shortest possible setup list:
1. Create Supabase project and run [sql/supabase/setup.sql](/c:/Users/alpha/OneDrive/Documents/SPXAgent/sql/supabase/setup.sql).
2. Create LiveKit project and copy URL, API key, API secret.
3. Create LiveKit inbound trunk.
4. Create LiveKit dispatch rule pointing to `inbound-voice-agent`.
5. Create Vobiz SIP trunk with `inbound_destination = your-project.sip.livekit.cloud`.
6. Put env vars in `.env`.
7. Run `python start_stack.py`.
8. Call your Vobiz number.

## Extra Files

- [QUICKSTART.md](/c:/Users/alpha/OneDrive/Documents/SPXAgent/QUICKSTART.md): very short version
- [Vobizdocs.md](/c:/Users/alpha/OneDrive/Documents/SPXAgent/Vobizdocs.md): Vobiz-only notes
- [sql/supabase/setup.sql](/c:/Users/alpha/OneDrive/Documents/SPXAgent/sql/supabase/setup.sql): database schema
