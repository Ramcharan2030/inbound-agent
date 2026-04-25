# Vobiz Docs

This repo uses Vobiz only to send inbound calls into LiveKit.

Important:
- this app is inbound-only
- this repo does not place outbound calls
- this repo does not need `SIP_TRUNK_ID` in `.env`

## The 5 Vobiz Values To Save

1. `account_id`
2. `auth_id`
3. `auth_token`
4. `trunk_id`
5. `trunk_domain`

The app itself mainly needs you to finish the Vobiz-to-LiveKit connection correctly. Keep those five values for support and future edits.

## Get The API Keys

1. Sign in to Vobiz.
2. Open the API or developer section.
3. Copy the `auth_id`.
4. Generate an `auth_token`.
5. Save the token somewhere safe.

## Create A SIP Trunk

Use the Vobiz trunk API or the Vobiz dashboard. The important part is the destination.

Set:
- `trunk_direction` to inbound or both, depending on your Vobiz flow
- `inbound_destination` to your LiveKit SIP domain

Example:

```text
your-project.sip.livekit.cloud
```

Example API call:

```bash
curl -X POST "https://api.vobiz.ai/api/v1/account/{account_id}/trunks" \
  -H "X-Auth-ID: {auth_id}" \
  -H "X-Auth-Token: {auth_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SPX Voice Agent",
    "trunk_direction": "both",
    "transport": "udp",
    "secure": false,
    "inbound_destination": "your-project.sip.livekit.cloud"
  }'
```

After it succeeds, save:
- `trunk_id`
- `trunk_domain`

## What The App Needs

Once Vobiz is pointing to LiveKit, this repo only needs:

```env
GOOGLE_API_KEY=your_gemini_key
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

That is it.

## If Inbound Calls Do Not Reach The Agent

Check these in order:
- the Vobiz trunk destination is your LiveKit SIP domain
- your LiveKit SIP setup is active
- the worker is running as `inbound-voice-agent`
- the dashboard `/health` route returns `ok`
