# Quick Start

If you want the full A-to-Z guide, read [README.md](/c:/Users/alpha/OneDrive/Documents/SPXAgent/README.md).

## Minimum Setup

1. Copy `.env.example` to `.env`.
2. Put in:

```env
GOOGLE_API_KEY=your_gemini_api_key
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key
WHATSAPP_ENABLED=false
```

3. Run the Supabase schema from [sql/supabase/setup.sql](/c:/Users/alpha/OneDrive/Documents/SPXAgent/sql/supabase/setup.sql).
4. In LiveKit, create:
   - one inbound SIP trunk
   - one SIP dispatch rule that dispatches `inbound-voice-agent`
5. In Vobiz, create a SIP trunk with:

```text
inbound_destination = your-project.sip.livekit.cloud
```

6. Install:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

7. Start:

```bash
python start_stack.py
```

8. Open:

```text
http://127.0.0.1:8000
```

Video walkthrough: coming soon. Add your GitHub/YouTube link in [README.md](/c:/Users/alpha/OneDrive/Documents/SPXAgent/README.md) when it is ready.
