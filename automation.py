import asyncio
import json
import logging
import os
import re
from collections import UserDict
from datetime import datetime, timedelta, timezone

import pytz
import requests

import db
from notify import notify_booking_cancelled, notify_booking_confirmed, notify_call_no_booking
logger = logging.getLogger('automation')
_IST = pytz.timezone('Asia/Kolkata')
DEFAULT_WA_TEMPLATES = [{'name': 'booking_confirmed', 'category': 'booking', 'message_type': 'text', 'body_text': 'Hi {caller_name}, your appointment is confirmed for {booking_date} at {booking_time}. Booking ID: {booking_id}.', 'caption': '', 'variables': ['caller_name', 'booking_date', 'booking_time', 'booking_id'], 'is_active': True}, {'name': 'booking_reminder_24h', 'category': 'booking', 'message_type': 'text', 'body_text': 'Reminder: your appointment is tomorrow at {booking_time} on {booking_date}. Reply here if you need help.', 'caption': '', 'variables': ['booking_date', 'booking_time'], 'is_active': True}, {'name': 'booking_reminder_2h', 'category': 'booking', 'message_type': 'text', 'body_text': 'Reminder: your appointment is in around 2 hours at {booking_time} today.', 'caption': '', 'variables': ['booking_time'], 'is_active': True}, {'name': 'booking_cancelled', 'category': 'booking', 'message_type': 'text', 'body_text': 'Hi {caller_name}, your appointment for {booking_date} at {booking_time} has been cancelled. If you want to reschedule, just reply here.', 'caption': '', 'variables': ['caller_name', 'booking_date', 'booking_time'], 'is_active': True}, {'name': 'no_booking_followup_2h', 'category': 'followup', 'message_type': 'text', 'body_text': 'Hi {caller_name}, thanks for taking the call earlier. If you want to continue, reply here and we can help with the next step.', 'caption': '', 'variables': ['caller_name'], 'is_active': True}, {'name': 'no_booking_followup_next_day', 'category': 'followup', 'message_type': 'text', 'body_text': "Hi {caller_name}, following up from yesterday's call. If you want to book or ask anything, just message here.", 'caption': '', 'variables': ['caller_name'], 'is_active': True}, {'name': 'manual_brochure', 'category': 'manual', 'message_type': 'text', 'body_text': 'Hi {caller_name}, sharing the details we discussed. Let us know if you want the team to call back.', 'caption': '', 'variables': ['caller_name'], 'is_active': True}, {'name': 'manual_document_share', 'category': 'manual', 'message_type': 'document', 'body_text': 'Hi {caller_name}, sharing the requested document here.', 'caption': 'Requested document for {caller_name}', 'variables': ['caller_name'], 'is_active': True}]


class _SafeFormatMap(UserDict):

    def __missing__(self, key):
        return '{' + str(key) + '}'

def parse_bool(value, default: bool) -> bool:
    if value in (None, ''):
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'off'}:
        return False
    return default

def parse_int(value, default: int) -> int:
    if value in (None, ''):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def parse_hours_list(value, default: list[int]) -> list[int]:
    if value in (None, ''):
        return list(default)
    if isinstance(value, list):
        numbers = []
        for item in value:
            try:
                numbers.append(int(item))
            except (TypeError, ValueError):
                continue
        return numbers or list(default)
    parts = [segment.strip() for segment in str(value).split(',') if segment.strip()]
    numbers = []
    for item in parts:
        try:
            numbers.append(int(float(item)))
        except (TypeError, ValueError):
            continue
    return numbers or list(default)

def get_runtime_config(config: dict | None=None) -> dict:
    config = config or {}
    return {'whatsapp_enabled': parse_bool(config.get('whatsapp_enabled', False), False), 'booking_reminder_offsets_hours': parse_hours_list(config.get('booking_reminder_offsets_hours'), [24, 2]), 'no_booking_followup_offsets_hours': parse_hours_list(config.get('no_booking_followup_offsets_hours'), [2, 24]), 'automation_business_hours_only': parse_bool(config.get('automation_business_hours_only', True), True)}


def _env_or_config(config: dict | None, key: str, env_key: str, default=''):
    config = config or {}
    value = config.get(key)
    if value not in (None, ''):
        return value
    return os.environ.get(env_key, default)


def _safe_format_text(template: str, variables: dict[str, object]) -> str:
    raw = str(template or '')
    if not raw:
        return ''
    try:
        return raw.format_map(_SafeFormatMap({str(key): '' if value is None else value for key, value in variables.items()}))
    except Exception:
        return raw


def _message_variables(job: dict, payload: dict) -> dict[str, str]:
    variables: dict[str, str] = {}
    raw_payload = job.get('payload')
    if isinstance(raw_payload, dict):
        for key, value in raw_payload.items():
            if key:
                variables[str(key)] = '' if value is None else str(value)
    for key in ['caller_name', 'phone_number', 'booking_date', 'booking_time', 'booking_id', 'call_summary', 'reason']:
        value = job.get(key)
        if value not in (None, ''):
            variables[key] = str(value)
    variables['caller_name'] = variables.get('caller_name') or str(job.get('caller_name') or 'there')
    variables['phone_number'] = variables.get('phone_number') or str(job.get('phone_number') or '')
    for key in ['body_text', 'caption']:
        value = payload.get(key)
        if value not in (None, ''):
            payload[key] = _safe_format_text(str(value), variables)
    return variables


def _resolve_message_asset(asset_id) -> dict | None:
    if asset_id in (None, ''):
        return None
    for asset in db.list_message_assets(limit=500):
        if str(asset.get('id')) == str(asset_id):
            return asset
    return None


def _resolve_job_message(job: dict) -> tuple[dict, dict[str, str]]:
    template_name = str(job.get('template_name') or '').strip()
    template = get_template(template_name) if template_name else None
    payload = {
        'template_name': template_name or (template or {}).get('name') or None,
        'message_type': str(job.get('message_type') or (template or {}).get('message_type') or 'text').strip().lower() or 'text',
        'body_text': str(job.get('body_text') or (template or {}).get('body_text') or ''),
        'caption': str(job.get('caption') or (template or {}).get('caption') or ''),
        'media_url': str(job.get('media_url') or (template or {}).get('media_url') or '').strip(),
        'mime_type': str(job.get('mime_type') or (template or {}).get('mime_type') or '').strip(),
        'file_name': str(job.get('file_name') or (template or {}).get('file_name') or '').strip(),
        'asset_id': job.get('asset_id') if job.get('asset_id') not in ('', None) else (template or {}).get('asset_id'),
    }
    if payload['asset_id'] and not payload['media_url']:
        asset = _resolve_message_asset(payload['asset_id'])
        if asset:
            payload['media_url'] = str(asset.get('public_url') or '').strip()
            payload['mime_type'] = payload['mime_type'] or str(asset.get('mime_type') or '').strip()
            payload['file_name'] = payload['file_name'] or str(asset.get('name') or asset.get('path') or '').strip()
    if payload['message_type'] not in db.WA_MESSAGE_TYPES:
        payload['message_type'] = 'text'
    variables = _message_variables(job, payload)
    return payload, variables


def _send_twilio_whatsapp(*, phone_number: str, payload: dict, config: dict | None=None) -> dict:
    account_sid = str(_env_or_config(config, 'twilio_account_sid', 'TWILIO_ACCOUNT_SID', '')).strip()
    auth_token = str(_env_or_config(config, 'twilio_auth_token', 'TWILIO_AUTH_TOKEN', '')).strip()
    from_number = str(_env_or_config(config, 'twilio_whatsapp_number', 'TWILIO_WHATSAPP_NUMBER', '')).strip()
    if not account_sid or not auth_token or not from_number:
        raise ValueError('Twilio WhatsApp is selected but Twilio credentials are missing.')
    data = {'To': f"whatsapp:{phone_number}" if not str(phone_number).startswith('whatsapp:') else str(phone_number), 'From': from_number}
    body_text = str(payload.get('body_text') or '').strip()
    if body_text:
        data['Body'] = body_text
    media_url = str(payload.get('media_url') or '').strip()
    if media_url:
        data['MediaUrl'] = media_url
    response = requests.post(
        f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json',
        auth=(account_sid, auth_token),
        data=data,
        timeout=20,
    )
    if response.status_code >= 300:
        raise ValueError(f'Twilio send failed ({response.status_code}): {response.text[:300]}')
    body = response.json()
    return {'provider': 'twilio', 'provider_message_id': str(body.get('sid') or ''), 'provider_status': str(body.get('status') or 'sent')}


def _send_vobiz_whatsapp(*, phone_number: str, payload: dict, config: dict | None=None) -> dict:
    auth_id = str(_env_or_config(config, 'vobiz_auth_id', 'VOBIZ_AUTH_ID', '')).strip()
    auth_token = str(_env_or_config(config, 'vobiz_auth_token', 'VOBIZ_AUTH_TOKEN', '')).strip()
    channel_id = str(_env_or_config(config, 'vobiz_whatsapp_channel_id', 'VOBIZ_WHATSAPP_CHANNEL_ID', '') or _env_or_config(config, 'vobiz_channel_id', 'VOBIZ_CHANNEL_ID', '')).strip()
    if not auth_id or not auth_token or not channel_id:
        raise ValueError('Vobiz WhatsApp is selected but Vobiz auth or channel settings are missing.')
    request_body = {'channel_id': channel_id, 'to': phone_number, 'type': str(payload.get('message_type') or 'text')}
    message_type = request_body['type']
    if message_type == 'text':
        request_body['text'] = {'body': str(payload.get('body_text') or '').strip()}
    elif message_type == 'image':
        request_body['image'] = {'link': str(payload.get('media_url') or '').strip(), 'caption': str(payload.get('caption') or '').strip()}
    elif message_type == 'document':
        request_body['document'] = {'link': str(payload.get('media_url') or '').strip(), 'caption': str(payload.get('caption') or '').strip(), 'filename': str(payload.get('file_name') or '').strip()}
    elif message_type == 'audio':
        request_body['audio'] = {'link': str(payload.get('media_url') or '').strip()}
    else:
        raise ValueError(f'Unsupported Vobiz WhatsApp message type: {message_type}')
    response = requests.post(
        'https://api.vobiz.ai/v1/messaging/messages',
        headers={'X-Auth-ID': auth_id, 'X-Auth-Token': auth_token, 'Content-Type': 'application/json'},
        json=request_body,
        timeout=20,
    )
    if response.status_code >= 300:
        raise ValueError(f'Vobiz send failed ({response.status_code}): {response.text[:300]}')
    body = response.json()
    return {
        'provider': 'vobiz',
        'provider_message_id': str(body.get('id') or body.get('message_id') or ''),
        'provider_status': str(body.get('status') or 'sent'),
    }


def _send_local_whatsapp(*, phone_number: str, payload: dict, config: dict | None=None) -> dict:
    service_url = str(_env_or_config(config, 'whatsapp_service_url', 'WHATSAPP_SERVICE_URL', '')).strip().rstrip('/')
    session_name = str(_env_or_config(config, 'whatsapp_session_name', 'WHATSAPP_SESSION_NAME', 'primary')).strip() or 'primary'
    if not service_url:
        raise ValueError('A local WhatsApp service URL is required for the baileys provider.')
    base_payload = {
        'session': session_name,
        'phone_number': phone_number,
        'to': phone_number,
        'type': str(payload.get('message_type') or 'text'),
        'body_text': str(payload.get('body_text') or ''),
        'text': str(payload.get('body_text') or ''),
        'caption': str(payload.get('caption') or ''),
        'media_url': str(payload.get('media_url') or ''),
        'mime_type': str(payload.get('mime_type') or ''),
        'file_name': str(payload.get('file_name') or ''),
    }
    candidate_paths = ['/api/messages/send', '/api/send-message', '/send-message', '/messages/send', '/send']
    last_error = None
    for path in candidate_paths:
        try:
            response = requests.post(f'{service_url}{path}', json=base_payload, timeout=15)
            if response.status_code == 404:
                last_error = f'{path} returned 404'
                continue
            if response.status_code >= 300:
                raise ValueError(f'Local WhatsApp send failed ({response.status_code}): {response.text[:300]}')
            body = response.json() if response.content else {}
            return {
                'provider': 'baileys',
                'provider_message_id': str(body.get('id') or body.get('messageId') or body.get('message_id') or ''),
                'provider_status': str(body.get('status') or 'sent'),
            }
        except ValueError:
            raise
        except Exception as exc:
            last_error = str(exc)
    raise ValueError(f'Could not deliver through the local WhatsApp service. Last error: {last_error or "unknown error"}')


def _dispatch_whatsapp_message(*, phone_number: str, payload: dict, config: dict | None=None) -> dict:
    provider = str(_env_or_config(config, 'whatsapp_provider', 'WHATSAPP_PROVIDER', 'baileys')).strip().lower() or 'baileys'
    if provider == 'twilio':
        return _send_twilio_whatsapp(phone_number=phone_number, payload=payload, config=config)
    if provider == 'vobiz':
        return _send_vobiz_whatsapp(phone_number=phone_number, payload=payload, config=config)
    if provider in {'baileys', 'local'}:
        return _send_local_whatsapp(phone_number=phone_number, payload=payload, config=config)
    raise ValueError(f'Unsupported WhatsApp provider: {provider}')


def process_whatsapp_job(job: dict, *, config: dict | None=None) -> dict:
    settings = get_runtime_config(config)
    if not settings['whatsapp_enabled']:
        raise ValueError('WhatsApp automations are disabled.')
    phone_number = db.normalize_phone_number(job.get('phone_number') or '')
    if not phone_number:
        raise ValueError('Automation job is missing a valid phone number.')
    payload, variables = _resolve_job_message(job)
    if payload['message_type'] != 'text' and not payload['media_url']:
        raise ValueError(f"WhatsApp job {job.get('id')} is missing media_url for {payload['message_type']} content.")
    provider_result = _dispatch_whatsapp_message(phone_number=phone_number, payload=payload, config=config)
    sent_at = datetime.now(timezone.utc).isoformat()
    message_record = {
        'phone_number': phone_number,
        'display_name': str(job.get('caller_name') or variables.get('caller_name') or '').strip(),
        'direction': 'outbound',
        'status': 'sent',
        'message_type': payload['message_type'],
        'template_name': payload.get('template_name'),
        'body_text': payload.get('body_text'),
        'caption': payload.get('caption'),
        'media_url': payload.get('media_url'),
        'mime_type': payload.get('mime_type'),
        'file_name': payload.get('file_name'),
        'asset_id': payload.get('asset_id'),
        'provider': provider_result.get('provider') or str(_env_or_config(config, 'whatsapp_provider', 'WHATSAPP_PROVIDER', 'baileys')).strip().lower(),
        'provider_message_id': provider_result.get('provider_message_id') or None,
        'related_appointment_id': job.get('related_appointment_id'),
        'related_job_id': job.get('id'),
        'metadata': {'automation_job_id': job.get('id'), 'variables': variables},
        'created_at': sent_at,
        'sent_at': sent_at,
    }
    db.save_wa_message(message_record)
    db.update_automation_job(job['id'], {'status': 'sent', 'provider_message_id': provider_result.get('provider_message_id') or None, 'last_error': None})
    return {
        'job_id': job.get('id'),
        'phone_number': phone_number,
        'provider': provider_result.get('provider'),
        'provider_message_id': provider_result.get('provider_message_id') or None,
        'message_type': payload['message_type'],
        'template_name': payload.get('template_name'),
        'status': provider_result.get('provider_status') or 'sent',
    }

def ensure_default_templates() -> list[dict]:
    existing = {row.get('name'): row for row in db.list_wa_templates()}
    rows = []
    for template in DEFAULT_WA_TEMPLATES:
        if template['name'] not in existing:
            saved = db.upsert_wa_template(template)
            rows.append(saved or template)
        else:
            rows.append(existing[template['name']])
    return rows

def get_template(name: str) -> dict | None:
    ensure_default_templates()
    template = db.get_wa_template(name)
    if template:
        return template
    for fallback in DEFAULT_WA_TEMPLATES:
        if fallback['name'] == name:
            return fallback
    return None

def get_active_template(name: str) -> dict | None:
    cleaned = str(name or '').strip()
    if not cleaned:
        return None
    ensure_default_templates()
    template = db.get_wa_template(cleaned)
    if template is not None:
        return template if bool(template.get('is_active', True)) else None
    for fallback in DEFAULT_WA_TEMPLATES:
        if fallback['name'] == cleaned and bool(fallback.get('is_active', True)):
            return fallback
    return None

def format_booking_context(*, caller_name: str, phone_number: str, booking_time_iso: str='', booking_id: str='', call_summary: str='') -> dict[str, str]:
    context = {'caller_name': caller_name or 'there', 'phone_number': db.normalize_phone_number(phone_number), 'booking_id': booking_id or '', 'call_summary': call_summary or '', 'booking_date': '', 'booking_time': ''}
    if booking_time_iso:
        try:
            dt = datetime.fromisoformat(booking_time_iso)
            if dt.tzinfo is None:
                dt = _IST.localize(dt)
            dt = dt.astimezone(_IST)
            context['booking_date'] = dt.strftime('%A, %d %B %Y')
            context['booking_time'] = dt.strftime('%I:%M %p IST')
        except Exception:
            context['booking_date'] = booking_time_iso
            context['booking_time'] = booking_time_iso
    return context

def _make_idempotency_key(*parts: object) -> str:
    cleaned = [str(part).strip().lower().replace(' ', '_') for part in parts if str(part).strip()]
    return ':'.join(cleaned)

def _appointment_id(appointment: dict) -> str:
    return str(appointment.get('id') or '')

def _appointment_start_dt(appointment: dict) -> datetime:
    value = appointment.get('scheduled_start') or appointment.get('start_time')
    if not value:
        raise ValueError('Appointment scheduled_start is required.')
    dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = _IST.localize(dt)
    return dt.astimezone(_IST)

def shift_into_business_hours(candidate: datetime) -> datetime:
    local = candidate.astimezone(_IST)
    while local.weekday() == 6:
        local = (local + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    open_hour = 10
    close_hour = 17 if local.weekday() == 5 else 19
    start = local.replace(hour=open_hour, minute=0, second=0, microsecond=0)
    end = local.replace(hour=close_hour, minute=0, second=0, microsecond=0)
    if local < start:
        return start
    if local >= end:
        next_day = (local + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        return shift_into_business_hours(next_day)
    return local

def schedule_booking_jobs(*, appointment: dict, caller_name: str='', phone_number: str='', call_summary: str='', config: dict | None=None) -> list[dict]:
    settings = get_runtime_config(config)
    phone = db.normalize_phone_number(phone_number or appointment.get('contact_phone') or '')
    if not phone or not settings['whatsapp_enabled']:
        return []
    appointment_id = _appointment_id(appointment)
    booking_time = _appointment_start_dt(appointment)
    context = format_booking_context(caller_name=caller_name or appointment.get('contact_name') or '', phone_number=phone, booking_time_iso=booking_time.isoformat(), booking_id=appointment_id, call_summary=call_summary)
    jobs = []
    immediate = db.create_automation_job({'channel': 'whatsapp', 'trigger_event': 'booking_confirmed', 'phone_number': phone, 'caller_name': context['caller_name'], 'template_name': 'booking_confirmed', 'scheduled_for': datetime.now(timezone.utc).isoformat(), 'related_appointment_id': appointment_id, 'status': 'pending', 'idempotency_key': _make_idempotency_key('booking_confirmed', appointment_id, 'immediate'), 'payload': context})
    if immediate:
        jobs.append(immediate)
    now = datetime.now(_IST)
    for offset in settings['booking_reminder_offsets_hours']:
        scheduled = booking_time - timedelta(hours=offset)
        if scheduled <= now:
            continue
        template_name = f'booking_reminder_{offset}h'
        if not get_template(template_name):
            continue
        job = db.create_automation_job({'channel': 'whatsapp', 'trigger_event': 'appointment_reminder', 'phone_number': phone, 'caller_name': context['caller_name'], 'template_name': template_name, 'scheduled_for': scheduled.astimezone(timezone.utc).isoformat(), 'related_appointment_id': appointment_id, 'status': 'pending', 'idempotency_key': _make_idempotency_key('appointment_reminder', appointment_id, offset, 'whatsapp'), 'payload': context})
        if job:
            jobs.append(job)
    return jobs

def handle_booking_confirmed(*, appointment: dict, caller_name: str='', phone_number: str='', notes: str='', tts_voice: str='', ai_summary: str='', config: dict | None=None) -> list[dict]:
    appointment_id = _appointment_id(appointment)
    booking_dt = _appointment_start_dt(appointment).isoformat()
    notify_booking_confirmed(caller_name=caller_name or appointment.get('contact_name') or '', caller_phone=phone_number or appointment.get('contact_phone') or '', booking_time_iso=booking_dt, booking_id=appointment_id, notes=notes, tts_voice=tts_voice, ai_summary=ai_summary, config=config)
    jobs = schedule_booking_jobs(appointment=appointment, caller_name=caller_name, phone_number=phone_number, call_summary=ai_summary, config=config)
    return jobs

def handle_appointment_updated(appointment: dict, *, config: dict | None=None) -> list[dict]:
    appointment_id = _appointment_id(appointment)
    db.cancel_automation_jobs(related_appointment_id=appointment_id, channel='whatsapp')
    return schedule_booking_jobs(appointment=appointment, caller_name=appointment.get('contact_name') or '', phone_number=appointment.get('contact_phone') or '', config=config)

def handle_appointment_cancelled(appointment: dict, *, reason: str='', config: dict | None=None) -> list[dict]:
    appointment_id = _appointment_id(appointment)
    db.cancel_automation_jobs(related_appointment_id=appointment_id, channel='whatsapp')
    notify_booking_cancelled(caller_name=appointment.get('contact_name') or '', caller_phone=appointment.get('contact_phone') or '', booking_id=appointment_id, reason=reason, config=config)
    settings = get_runtime_config(config)
    phone = db.normalize_phone_number(appointment.get('contact_phone') or '')
    if not phone or not settings['whatsapp_enabled']:
        return []
    context = format_booking_context(caller_name=appointment.get('contact_name') or '', phone_number=phone, booking_time_iso=_appointment_start_dt(appointment).isoformat(), booking_id=appointment_id)
    job = db.create_automation_job({'channel': 'whatsapp', 'trigger_event': 'appointment_cancelled', 'phone_number': phone, 'caller_name': context['caller_name'], 'template_name': 'booking_cancelled', 'scheduled_for': datetime.now(timezone.utc).isoformat(), 'related_appointment_id': appointment_id, 'status': 'pending', 'idempotency_key': _make_idempotency_key('appointment_cancelled', appointment_id), 'payload': context | {'reason': reason}})
    return [job] if job else []

def handle_call_no_booking(*, caller_name: str, phone_number: str, call_summary: str, related_call_room_id: str, config: dict | None=None) -> list[dict]:
    settings = get_runtime_config(config)
    phone = db.normalize_phone_number(phone_number)
    notify_call_no_booking(caller_name=caller_name, caller_phone=phone, call_summary=call_summary, ai_summary=call_summary, config=config)
    if not phone or not settings['whatsapp_enabled']:
        return []
    now_ist = datetime.now(_IST)
    jobs = []
    context = format_booking_context(caller_name=caller_name, phone_number=phone, call_summary=call_summary)
    for offset in settings['no_booking_followup_offsets_hours']:
        scheduled = now_ist + timedelta(hours=offset)
        if settings['automation_business_hours_only']:
            scheduled = shift_into_business_hours(scheduled)
        template_name = 'no_booking_followup_2h' if offset <= 2 else 'no_booking_followup_next_day'
        job = db.create_automation_job({'channel': 'whatsapp', 'trigger_event': 'call_no_booking', 'phone_number': phone, 'caller_name': caller_name, 'template_name': template_name, 'scheduled_for': scheduled.astimezone(timezone.utc).isoformat(), 'related_call_room_id': related_call_room_id, 'status': 'pending', 'idempotency_key': _make_idempotency_key('call_no_booking', related_call_room_id, offset, 'whatsapp'), 'payload': context})
        if job:
            jobs.append(job)
    return jobs

def process_due_jobs(*, limit: int=20, config: dict | None=None) -> list[dict]:
    settings = get_runtime_config(config)
    if not settings['whatsapp_enabled']:
        return []
    jobs = db.fetch_due_automation_jobs(limit=limit, channel='whatsapp')
    processed = []
    for job in jobs:
        db.update_automation_job(job['id'], {'status': 'processing'})
        try:
            processed.append(process_whatsapp_job(job, config=config))
        except Exception as exc:
            retry_count = int(job.get('retry_count') or 0) + 1
            max_retries = int(job.get('max_retries') or 3)
            update = {'retry_count': retry_count, 'last_error': str(exc), 'status': 'retry' if retry_count < max_retries else 'failed'}
            if retry_count < max_retries:
                retry_at = datetime.now(timezone.utc) + timedelta(minutes=min(30, retry_count * 5))
                update['scheduled_for'] = retry_at.isoformat()
            db.update_automation_job(job['id'], update)
            logger.warning(f"[AUTOMATION] Job {job['id']} failed: {exc}")
    return processed

