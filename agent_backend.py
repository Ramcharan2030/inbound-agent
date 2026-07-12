from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, AsyncIterator

import certifi
from dotenv import load_dotenv

os.environ["SSL_CERT_FILE"] = certifi.where()

logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


class _SuppressKnownWarnings(logging.Filter):
    _SUPPRESSED = (
        "RoomInputOptions and RoomOutputOptions are deprecated",
        "received server content but no active generation",
        "server cancelled tool calls",
        "failed to send binary stream message",
        "engine is closed",
        "Input is shorter by",
    )

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return not any(fragment in message for fragment in self._SUPPRESSED)


logging.getLogger("livekit.agents").addFilter(_SuppressKnownWarnings())
logging.getLogger("livekit.plugins.google").addFilter(_SuppressKnownWarnings())

load_dotenv()
logger = logging.getLogger("backend-agent")

# Initialize Sentry if configured
_sentry_dsn = os.environ.get("SENTRY_DSN", "").strip()
if _sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=_sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
        )
        logger.info("[SENTRY] SDK initialized successfully.")
    except Exception as e:
        logger.warning("[SENTRY] Failed to initialize: %s", e)

# ── Observability: log to console AND persistent file ──────────────────────
_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_file_handler = logging.FileHandler(_LOG_DIR / "agent.log", encoding="utf-8")
_file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), _file_handler],
)
logging.root.addHandler(_file_handler)
# ───────────────────────────────────────────────────────────────────────────

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _maybe_relaunch_in_venv() -> None:
    project_dir = Path(__file__).resolve().parent
    venv_python = project_dir / ".venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        return
    try:
        current_python = Path(sys.executable).resolve()
        target_python = venv_python.resolve()
    except Exception:
        return
    if current_python == target_python:
        return
    logger.info("[BOOT] Relaunching agent with project virtualenv")
    os.execv(str(target_python), [str(target_python), str(Path(__file__).resolve()), *sys.argv[1:]])


from livekit import api, rtc
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, WorkerOptions, cli, llm
from livekit.agents.types import APIConnectOptions

try:
    from livekit.plugins import google as google_plugin
except ImportError:
    google_plugin = None

try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types
except ImportError:
    google_genai = None
    google_genai_types = None

import db
import kb
from backend_config import (
    DEFAULT_FIRST_LINE,
    DEFAULT_GEMINI_LIVE_CONNECT_RETRIES,
    DEFAULT_GEMINI_LIVE_CONNECT_TIMEOUT,
    DEFAULT_GEMINI_LIVE_MODEL,
    DEFAULT_GEMINI_LIVE_PREFLIGHT_TIMEOUT,
    DEFAULT_GEMINI_LIVE_TEMPERATURE,
    DEFAULT_GEMINI_LIVE_VOICE,
    DEFAULT_GEMINI_TTS_MODEL,
    apply_config_env,
    get_outbound_sip_trunk_id,
    parse_bool,
    parse_float,
    parse_int,
    read_config,
)
from backend_events import handle_call_no_booking
from calendar_tools import async_create_booking, get_available_slots

DEFAULT_GEMINI_TTS_SAMPLE_RATE = 24000
DEFAULT_AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "vobiz-demo-agent").strip() or "vobiz-demo-agent"

_IST = timezone(timedelta(hours=5, minutes=30))
_call_timestamps: dict[str, list[float]] = defaultdict(list)
_caller_history_cache: dict[str, tuple[float, dict[str, str]]] = {}
CALLER_HISTORY_CACHE_TTL = 300.0
RATE_LIMIT_CALLS = 5
RATE_LIMIT_WINDOW = 3600

LANGUAGE_PRESETS = {
    "hinglish": {
        "instruction": (
            "Speak in natural Hinglish. Default to Hindi but use English where it sounds natural."
        )
    },
    "hindi": {
        "instruction": "Speak only in clear, professional Hindi."
    },
    "english": {
        "instruction": "Speak only in Indian English with a warm, professional tone."
    },
    "tamil": {
        "instruction": "Speak only in Tamil with a polite professional tone."
    },
    "telugu": {
        "instruction": "Speak only in Telugu with a polite professional tone."
    },
    "gujarati": {
        "instruction": "Speak only in Gujarati with a polite professional tone."
    },
    "bengali": {
        "instruction": "Speak only in Bengali with a polite professional tone."
    },
    "marathi": {
        "instruction": "Speak only in Marathi with a polite professional tone."
    },
    "kannada": {
        "instruction": "Speak only in Kannada with a polite professional tone."
    },
    "malayalam": {
        "instruction": "Speak only in Malayalam with a polite professional tone."
    },
    "multilingual": {
        "instruction": (
            "Detect the caller's language from their first message and continue in that same language."
        )
    },
}

FILLER_WORDS = {
    "okay.",
    "okay",
    "ok",
    "uh",
    "hmm",
    "hm",
    "yeah",
    "yes",
    "no",
    "um",
    "ah",
    "oh",
    "right",
    "sure",
    "fine",
    "good",
    "haan",
    "han",
    "theek",
    "theek hai",
    "accha",
    "ji",
    "ha",
}

_gemini_tts_cache: dict[tuple[str, str, str], bytes] = {}
_GEMINI_TTS_CACHE_MAX = 8


def is_rate_limited(phone: str) -> bool:
    if phone in ("unknown", "demo"):
        return False
    now = time.time()
    _call_timestamps[phone] = [stamp for stamp in _call_timestamps[phone] if now - stamp < RATE_LIMIT_WINDOW]
    if len(_call_timestamps[phone]) >= RATE_LIMIT_CALLS:
        return True
    _call_timestamps[phone].append(now)
    return False


def count_tokens(text: str) -> int:
    try:
        import tiktoken

        encoder = tiktoken.encoding_for_model("gpt-4o")
        return len(encoder.encode(text))
    except Exception:
        return len(str(text or "").split())


def get_live_config(phone_number: str | None = None) -> dict:
    config = read_config(phone_number)
    apply_config_env(config)
    return config


def get_gemini_live_model_name(config: dict | None) -> str:
    return str((config or {}).get("gemini_live_model") or DEFAULT_GEMINI_LIVE_MODEL).strip() or DEFAULT_GEMINI_LIVE_MODEL


def gemini_live_supports_scripted_generation(config: dict | None) -> bool:
    return "3.1" not in get_gemini_live_model_name(config)


def get_gemini_tts_model_name(config: dict | None) -> str:
    return str((config or {}).get("gemini_tts_model") or DEFAULT_GEMINI_TTS_MODEL).strip() or DEFAULT_GEMINI_TTS_MODEL


def get_gemini_tts_voice_name(config: dict | None) -> str:
    return str((config or {}).get("gemini_live_voice") or DEFAULT_GEMINI_LIVE_VOICE).strip() or DEFAULT_GEMINI_LIVE_VOICE


def get_opening_greeting(config: dict | None, first_line: str | None = None) -> str:
    return str((config or {}).get("first_line") or first_line or DEFAULT_FIRST_LINE).strip() or DEFAULT_FIRST_LINE


def get_sip_participant_identity(phone_number: str | None) -> str:
    if not phone_number:
        return "inbound_caller"
    clean = re.sub(r"[^0-9A-Za-z_-]", "", str(phone_number))
    return f"sip_{clean or 'caller'}"


def get_language_instruction(lang_preset: str) -> str:
    preset = LANGUAGE_PRESETS.get(lang_preset, LANGUAGE_PRESETS["multilingual"])
    return f"\n\n[LANGUAGE DIRECTIVE]\n{preset['instruction']}"


def get_ist_time_context() -> str:
    now = datetime.now(_IST)
    days_lines = []
    for offset in range(7):
        day = now + timedelta(days=offset)
        label = "Today" if offset == 0 else "Tomorrow" if offset == 1 else day.strftime("%A")
        days_lines.append(f"  {label}: {day.strftime('%A %d %B %Y')} -> ISO {day.strftime('%Y-%m-%d')}")
    return (
        "\n\n[SYSTEM CONTEXT]\n"
        f"Current date and time: {now.strftime('%A, %B %d, %Y at %I:%M %p')} IST\n"
        "Resolve relative day references using this table:\n"
        + "\n".join(days_lines)
        + "\nAlways use ISO dates when calling save_booking_intent. Appointments are in IST (+05:30)."
    )


def _extract_gemini_tts_pcm(response: object) -> bytes:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise RuntimeError("Gemini TTS returned no candidates")
    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", None) or []
    for part in parts:
        inline_data = getattr(part, "inline_data", None) or getattr(part, "inlineData", None)
        data = getattr(inline_data, "data", None) if inline_data is not None else None
        if not data:
            continue
        if isinstance(data, str):
            return base64.b64decode(data)
        return bytes(data)
    raise RuntimeError("Gemini TTS returned no inline audio data")


def synthesize_gemini_tts_pcm(text: str, live_config: dict | None, *, purpose: str) -> bytes:
    if google_genai is None or google_genai_types is None:
        raise RuntimeError("google-genai is required for Gemini TTS fallback")

    config = live_config or {}
    api_key = str(config.get("google_api_key") or os.environ.get("GOOGLE_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY for Gemini TTS fallback")

    model_name = get_gemini_tts_model_name(config)
    voice_name = get_gemini_tts_voice_name(config)
    cache_key = (text, model_name, voice_name)
    cached = _gemini_tts_cache.get(cache_key)
    if cached:
        logger.info("[VOICE] Gemini TTS cache hit for %s", purpose)
        return cached

    prompt = (
        "Say in a warm, natural Indian phone-call tone. Speak exactly the quoted text and do not "
        f"add, remove, or replace words: {json.dumps(str(text), ensure_ascii=False)}"
    )
    logger.info("[VOICE] Generating Gemini TTS for %s", purpose)
    client = google_genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=google_genai_types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=google_genai_types.SpeechConfig(
                voice_config=google_genai_types.VoiceConfig(
                    prebuilt_voice_config=google_genai_types.PrebuiltVoiceConfig(
                        voice_name=voice_name,
                    )
                )
            ),
        ),
    )
    pcm = _extract_gemini_tts_pcm(response)
    if len(_gemini_tts_cache) >= _GEMINI_TTS_CACHE_MAX:
        _gemini_tts_cache.pop(next(iter(_gemini_tts_cache)), None)
    _gemini_tts_cache[cache_key] = pcm
    return pcm


async def pcm_to_audio_frames(
    pcm: bytes,
    *,
    sample_rate: int = DEFAULT_GEMINI_TTS_SAMPLE_RATE,
    num_channels: int = 1,
    frame_duration_ms: int = 20,
) -> AsyncIterator[rtc.AudioFrame]:
    bytes_per_sample = 2
    bytes_per_channel_frame = num_channels * bytes_per_sample
    frame_bytes = max(1, sample_rate * frame_duration_ms // 1000) * bytes_per_channel_frame
    usable_len = len(pcm) - (len(pcm) % bytes_per_channel_frame)
    for offset in range(0, usable_len, frame_bytes):
        chunk = pcm[offset : min(offset + frame_bytes, usable_len)]
        samples_per_channel = len(chunk) // bytes_per_channel_frame
        if samples_per_channel <= 0:
            continue
        yield rtc.AudioFrame(
            data=chunk,
            sample_rate=sample_rate,
            num_channels=num_channels,
            samples_per_channel=samples_per_channel,
        )
        await asyncio.sleep(0)


async def say_with_gemini_tts(
    session: AgentSession,
    text: str,
    live_config: dict | None,
    *,
    purpose: str,
) -> bool:
    try:
        prefetch_tasks = (live_config or {}).get("_gemini_tts_prefetch_tasks")
        prefetch_task = prefetch_tasks.pop(purpose, None) if isinstance(prefetch_tasks, dict) else None
        if isinstance(prefetch_task, asyncio.Task):
            try:
                pcm = await prefetch_task
            except Exception as exc:
                logger.warning("[VOICE] Prefetched Gemini TTS failed for %s: %s", purpose, exc)
                pcm = await asyncio.to_thread(synthesize_gemini_tts_pcm, text, live_config, purpose=purpose)
        else:
            pcm = await asyncio.to_thread(synthesize_gemini_tts_pcm, text, live_config, purpose=purpose)
        session.say(text, audio=pcm_to_audio_frames(pcm), add_to_chat_ctx=True)
        return True
    except Exception as exc:
        logger.warning("[VOICE] Gemini TTS failed for %s: %s", purpose, exc)
        return False


def prefetch_gemini_tts(live_config: dict, text: str, *, purpose: str) -> None:
    if not text or google_genai is None or google_genai_types is None:
        return
    api_key = str(live_config.get("google_api_key") or os.environ.get("GOOGLE_API_KEY", "")).strip()
    if not api_key:
        return
    tasks = live_config.setdefault("_gemini_tts_prefetch_tasks", {})
    if not isinstance(tasks, dict) or purpose in tasks:
        return
    task = asyncio.create_task(asyncio.to_thread(synthesize_gemini_tts_pcm, text, live_config, purpose=purpose))
    tasks[purpose] = task


def _map_sensitivity(value: str, kind: str):
    if kind == "start":
        if value == "low":
            return google_genai_types.StartSensitivity.START_SENSITIVITY_LOW
        if value == "high":
            return google_genai_types.StartSensitivity.START_SENSITIVITY_HIGH
        return google_genai_types.StartSensitivity.START_SENSITIVITY_UNSPECIFIED
    else:
        if value == "low":
            return google_genai_types.EndSensitivity.END_SENSITIVITY_LOW
        if value == "high":
            return google_genai_types.EndSensitivity.END_SENSITIVITY_HIGH
        return google_genai_types.EndSensitivity.END_SENSITIVITY_UNSPECIFIED


def build_gemini_realtime_model(live_config: dict):
    if google_plugin is None or google_genai_types is None:
        raise RuntimeError(
            "Gemini Live requires livekit-plugins-google and google-genai. Install the updated requirements."
        )

    api_key = str(live_config.get("google_api_key") or os.environ.get("GOOGLE_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY for Gemini Live.")

    model_name = get_gemini_live_model_name(live_config)
    voice_name = str(live_config.get("gemini_live_voice") or DEFAULT_GEMINI_LIVE_VOICE).strip() or DEFAULT_GEMINI_LIVE_VOICE
    temperature = max(0.0, min(2.0, parse_float(live_config.get("gemini_live_temperature"), DEFAULT_GEMINI_LIVE_TEMPERATURE)))
    language = str(live_config.get("gemini_live_language") or "").strip()

    realtime_input_config = google_genai_types.RealtimeInputConfig(
        automatic_activity_detection=google_genai_types.AutomaticActivityDetection(
            disabled=False,
            start_of_speech_sensitivity=_map_sensitivity(live_config.get("gemini_live_vad_start_sensitivity"), "start"),
            end_of_speech_sensitivity=_map_sensitivity(live_config.get("gemini_live_vad_end_sensitivity"), "end"),
            prefix_padding_ms=max(0, parse_int(live_config.get("gemini_live_vad_prefix_padding_ms"), 300)),
            silence_duration_ms=max(100, parse_int(live_config.get("gemini_live_vad_silence_ms"), 600)),
        )
    )

    logger.info(
        "[VOICE] Gemini Live model=%s voice=%s temperature=%s language=%s",
        model_name,
        voice_name,
        temperature,
        language,
    )
    if not gemini_live_supports_scripted_generation(live_config):
        logger.info("[VOICE] Fixed greetings and wrap-ups will use Gemini TTS fallback for this model.")

    kwargs = {
        "model": model_name,
        "api_key": api_key,
        "voice": voice_name,
        "temperature": temperature,
        "input_audio_transcription": google_genai_types.AudioTranscriptionConfig(),
        "output_audio_transcription": google_genai_types.AudioTranscriptionConfig(),
        "realtime_input_config": realtime_input_config,
        "conn_options": APIConnectOptions(
            max_retry=max(0, parse_int(live_config.get("gemini_live_connect_retries"), DEFAULT_GEMINI_LIVE_CONNECT_RETRIES)),
            retry_interval=2.0,
            timeout=max(5.0, parse_float(live_config.get("gemini_live_connect_timeout"), DEFAULT_GEMINI_LIVE_CONNECT_TIMEOUT)),
        ),
    }
    if language:
        kwargs["language"] = language
    return google_plugin.realtime.RealtimeModel(**kwargs)


async def preflight_gemini_live_connection(live_config: dict) -> bool:
    if not parse_bool(live_config.get("gemini_live_preflight_enabled"), False):
        return True
    if google_genai is None:
        logger.warning("[VOICE] Gemini Live preflight skipped because google-genai is not installed")
        return False

    api_key = str(live_config.get("google_api_key") or os.environ.get("GOOGLE_API_KEY", "")).strip()
    if not api_key:
        logger.warning("[VOICE] Gemini Live preflight failed because GOOGLE_API_KEY is missing")
        return False

    model_name = get_gemini_live_model_name(live_config)
    voice_name = str(live_config.get("gemini_live_voice") or DEFAULT_GEMINI_LIVE_VOICE).strip() or DEFAULT_GEMINI_LIVE_VOICE
    language = str(live_config.get("gemini_live_language") or "").strip()
    timeout_seconds = max(
        1.0,
        min(20.0, parse_float(live_config.get("gemini_live_preflight_timeout"), DEFAULT_GEMINI_LIVE_PREFLIGHT_TIMEOUT)),
    )

    async def _connect_once() -> bool:
        client = google_genai.Client(api_key=api_key)
        session_kwargs = {
            "model": model_name,
            "config": {"response_modalities": ["AUDIO"], "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": voice_name}}}},
        }
        if language:
            session_kwargs["config"]["language_code"] = language
        async with client.aio.live.connect(**session_kwargs):
            return True

    try:
        await asyncio.wait_for(_connect_once(), timeout=timeout_seconds)
        logger.info("[VOICE] Gemini Live preflight succeeded")
        return True
    except Exception as exc:
        logger.warning("[VOICE] Gemini Live preflight failed: %s", exc)
        return False


class AgentTools(llm.ToolContext):
    def __init__(
        self,
        caller_phone: str,
        caller_name: str = "",
        live_config: dict | None = None,
        caller_profile: dict | None = None,
        runtime_state: dict | None = None,
        shutdown_fn=None,
    ) -> None:
        super().__init__(tools=[])
        normalized_phone = db.normalize_phone_number(caller_phone or "")
        self.caller_phone = normalized_phone or caller_phone
        self.caller_name = caller_name
        self.booking_intent: dict | None = None
        self.sip_domain = os.getenv("VOBIZ_SIP_DOMAIN")
        self.ctx_api = None
        self.room_name = None
        self._sip_identity = None
        self._session_ref: AgentSession | None = None  # set after session.start()
        self.live_config = live_config or {}
        self._shutdown_fn = shutdown_fn
        self.caller_profile = caller_profile or {
            "phone_number": normalized_phone or caller_phone or "",
            "display_name": caller_name or "",
            "trusted_phone": bool(normalized_phone),
            "confirmed_phone": bool(normalized_phone),
        }
        self.runtime_state = runtime_state or {}

    def _effective_phone(self, candidate: str = "") -> str:
        session_phone = db.normalize_phone_number(self.caller_phone or "")
        profile_phone = db.normalize_phone_number((self.caller_profile or {}).get("phone_number") or "")
        trusted = session_phone or profile_phone
        normalized = db.normalize_phone_number(candidate or "")
        if not normalized:
            return trusted or ""
        if trusted and normalized == trusted:
            return trusted
        raw_candidate = str(candidate or "").strip()
        if raw_candidate.startswith("+") and normalized != trusted:
            return normalized
        return trusted or normalized

    def _effective_name(self, candidate: str = "") -> str:
        return (
            str(candidate or "").strip()
            or str((self.caller_profile or {}).get("display_name") or "").strip()
            or str(self.caller_name or "").strip()
        )

    def _note_phone_confirmation(self, phone: str) -> None:
        normalized = db.normalize_phone_number(phone or "")
        if not normalized:
            return
        self.caller_phone = normalized
        profile = self.caller_profile or {}
        profile["phone_number"] = normalized
        profile["trusted_phone"] = True
        profile["confirmed_phone"] = True
        self.caller_profile = profile

    def _record_tool_time(self, started_at: float) -> None:
        active_turn = self.runtime_state.get("active_turn")
        if not active_turn:
            return
        elapsed_ms = round((time.monotonic() - started_at) * 1000, 2)
        active_turn["tool_ms"] = round(float(active_turn.get("tool_ms") or 0.0) + elapsed_ms, 2)

    @llm.function_tool(description=(
        "Transfer this call to a sales manager or human agent immediately. "
        "Use this when: (1) the caller asks for a human, manager, negotiation, pricing approval, or legal/loan help, "
        "(2) the caller is upset or the situation is sensitive, "
        "(3) they explicitly ask to speak with a human, "
        "(4) the situation is clearly beyond the scope of inquiry handling and site visit scheduling. "
        "Do NOT ask repeated confirmation before transferring when the caller clearly needs a human. "
        "IMPORTANT: After calling this tool, do NOT call end_call. The system will handle the disconnect automatically."
    ))
    async def transfer_call(self) -> str:
        started_at = time.monotonic()
        destination = os.getenv("DEFAULT_TRANSFER_NUMBER", "").strip()
        
        logger.info("[TOOL] transfer_call: Attempting transfer. Destination: %s, Identity: %s, Room: %s", 
                    destination, self._sip_identity, self.room_name)

        is_phone = False
        clean = destination.replace("tel:", "").replace("sip:", "").strip()
        if re.match(r"^\+?[0-9\-\s]+$", clean):
            is_phone = True

        if is_phone:
            destination = f"sip:{clean}"
        else:
            if destination and self.sip_domain and "@" not in destination:
                destination = f"sip:{clean}@{self.sip_domain}"
            if destination and not destination.startswith("sip:") and not destination.startswith("tel:"):
                destination = f"sip:{destination}"
        
        try:
            if not destination:
                logger.error("[TOOL] transfer_call: No destination number configured (DEFAULT_TRANSFER_NUMBER)")
                return "Unable to transfer: No destination configured."
            
            if not self._sip_identity:
                logger.error("[TOOL] transfer_call: No SIP participant identity found to transfer.")
                return "Unable to transfer: Identity not found."

            if self.ctx_api and self.room_name and destination and self._sip_identity:
                logger.info("[TOOL] transfer_call: Dispatching SIP transfer request to %s", destination)
                await self.ctx_api.sip.transfer_sip_participant(
                    api.TransferSIPParticipantRequest(
                        room_name=self.room_name,
                        participant_identity=self._sip_identity,
                        transfer_to=destination,
                        play_dialtone=False,
                    )
                )
                logger.info("[TOOL] transfer_call: Transfer request sent successfully.")
                return "Transfer initiated successfully. Please say a brief goodbye to the caller now."
            
            logger.warning("[TOOL] transfer_call: Missing context (API: %s, Room: %s)", 
                           bool(self.ctx_api), self.room_name)
            return "Unable to transfer right now due to technical limitations."
        except Exception as exc:
            logger.error("[TOOL] transfer_call failed with error: %s", exc, exc_info=True)
            return "Unable to transfer right now."
        finally:
            self._record_tool_time(started_at)

    @llm.function_tool(description="End the call after a clear goodbye, confirmed booking, answered question, or explicit request to hang up. Do NOT call this if you have already initiated a transfer.")
    async def end_call(self) -> str:
        started_at = time.monotonic()
        try:
            # We no longer do an immediate SIP transfer here as it was causing unintended transfers.
            # Instead, we will proactively remove the participant during the delayed shutdown sequence.
            if self.ctx_api and self.room_name and self._sip_identity:
                logger.info("[TOOL] end_call: Preparing for SIP hangup")
        except Exception as exc:
            logger.warning("[TOOL] end_call cleanup failed: %s", exc)
        finally:
            self._record_tool_time(started_at)
        
        # Schedule room shutdown after a brief pause to allow goodbye audio to finish
        if callable(self._shutdown_fn):
            async def _delayed_shutdown():
                await asyncio.sleep(1.5)
                try:
                    # Proactively remove the SIP participant before shutting down the job
                    if self.ctx_api and self.room_name and self._sip_identity:
                        try:
                            from livekit import api as lk_api
                            await self.ctx_api.room.remove_participant(
                                lk_api.RemoveParticipantRequest(
                                    room=self.room_name,
                                    identity=self._sip_identity,
                                )
                            )
                            logger.info("[TOOL] end_call: SIP participant removed (hangup)")
                        except Exception as e:
                            logger.warning("[TOOL] end_call: failed to remove participant: %s", e)
                    
                    self._shutdown_fn()
                except Exception:
                    pass
            asyncio.create_task(_delayed_shutdown())
        return ""

    @llm.function_tool(description=(
        "Confirm and save the site visit booking in the database immediately. "
        "Use this as soon as the caller agrees to a specific time. "
        "Returns the booking confirmation details including a booking ID. "
        "Important: Always include the property/project name, preferred unit type, budget, purpose, inquiry topic, and any special requests in the notes."
    ))
    async def save_booking_intent(
        self,
        start_time: Annotated[str, "ISO 8601 datetime such as 2026-03-01T10:00:00+05:30"],
        caller_name: Annotated[str, "Full name of the caller"],
        caller_phone: Annotated[str, "Phone number of the caller, or empty if the trusted session number should be reused."] = "",
        notes: Annotated[str, "Site visit notes: property/project name, unit type, budget, purpose, inquiry topic, and special requests"] = "",
    ) -> str:
        started_at = time.monotonic()
        try:
            effective_phone = self._effective_phone(caller_phone)
            effective_name = self._effective_name(caller_name)
            if not effective_phone:
                return "I still need the best callback number before I can save the booking."
            
            # Perform the actual booking immediately for real-time updates
            result = await async_create_booking(
                start_time=start_time,
                caller_name=effective_name or "Unknown Caller",
                caller_phone=effective_phone,
                notes=notes,
            )

            if result.get("success"):
                self.booking_intent = {
                    "start_time": start_time,
                    "caller_name": effective_name,
                    "caller_phone": effective_phone,
                    "notes": notes,
                    "booking_id": result.get("booking_id"),
                    "confirmed": True
                }
                self.caller_name = effective_name
                self._note_phone_confirmation(effective_phone)
                return f"SUCCESS: Booking confirmed for {effective_name} at {start_time}. Booking ID: {result.get('booking_id')}. Please inform the caller."
            else:
                return f"FAILED: Could not create booking: {result.get('message')}. Please try a different slot or check details."

        except Exception as exc:
            logger.error("[TOOL] save_booking_intent failed: %s", exc)
            return "I had trouble saving the booking. Please try again."
        finally:
            self._record_tool_time(started_at)

    @llm.function_tool(description="Check available site visit slots for a date in YYYY-MM-DD format.")
    async def check_availability(self, date: Annotated[str, "Date in YYYY-MM-DD format"]) -> str:
        started_at = time.monotonic()
        try:
            slots = await get_available_slots(date)
            if not slots:
                return f"No available slots on {date}. Would you like to check another date?"
            labels = [slot.get("label") or slot.get("start_time", "")[-8:][:5] for slot in slots[:6]]
            return f"Available slots on {date}: {', '.join(labels)} IST."
        except Exception as exc:
            logger.error("[TOOL] check_availability failed: %s", exc)
            return "I am having trouble checking the calendar right now."
        finally:
            self._record_tool_time(started_at)

    @llm.function_tool(description="Check whether the business is currently open and share the operating hours.")
    async def get_business_hours(self) -> str:
        started_at = time.monotonic()
        try:
            now = datetime.now(_IST)
            hours = {
                0: ("Monday", "10:00", "19:00"),
                1: ("Tuesday", "10:00", "19:00"),
                2: ("Wednesday", "10:00", "19:00"),
                3: ("Thursday", "10:00", "19:00"),
                4: ("Friday", "10:00", "19:00"),
                5: ("Saturday", "10:00", "17:00"),
                6: ("Sunday", None, None),
            }
            day_name, open_time, close_time = hours[now.weekday()]
            current_time = now.strftime("%H:%M")
            if open_time is None:
                return "We are closed on Sundays. Next opening is Monday at 10:00 AM IST."
            if open_time <= current_time <= close_time:
                return f"We are open. Today ({day_name}) our hours are {open_time} to {close_time} IST."
            return f"We are currently closed. Today ({day_name}) our hours are {open_time} to {close_time} IST."
        finally:
            self._record_tool_time(started_at)

    # ── Filler phrases to play while slow tools run ──────────────────────────
    _FILLER_PHRASES = [
        "Let me check that for you one moment.",
        "Just a second, let me look that up.",
        "Give me a moment while I find that information.",
        "Sure, let me pull that up right now.",
    ]
    _filler_index: int = 0

    def _next_filler(self) -> str:
        phrase = self._FILLER_PHRASES[self._filler_index % len(self._FILLER_PHRASES)]
        self._filler_index += 1
        return phrase

    @llm.function_tool(description=(
        "Search the knowledge base for PDF excerpts and website content. "
        "Always call this before answering factual questions about properties, pricing, or availability."
    ))
    async def search_knowledge_base(self, query: Annotated[str, "Knowledge base question in natural language"]) -> str:
        started_at = time.monotonic()
        try:
            # ── Fire filler phrase concurrently with KB query to kill silence ─
            filler_text = self._next_filler()
            kb_task = asyncio.create_task(
                asyncio.to_thread(kb.search_for_agent, query, config=self.live_config)
            )
            if self._session_ref is not None:
                try:
                    self._session_ref.say(filler_text, add_to_chat_ctx=False)
                except Exception:
                    pass
            result = await kb_task
            if not result or not result.get("grounding_text"):
                return "I do not have confirmed knowledge base information for that yet."
            grounding_text = str(result.get("grounding_text") or "").strip()
            budget = max(280, parse_int(self.live_config.get("kb_live_context_char_budget"), 900))
            if len(grounding_text) > budget:
                grounding_text = grounding_text[:budget].rstrip() + "..."
            return grounding_text
        except Exception as exc:
            logger.error("[TOOL] search_knowledge_base failed: %s", exc)
            return "I am having trouble checking the knowledge base right now."
        finally:
            self._record_tool_time(started_at)

    @llm.function_tool(description=(
        "Capture this caller as a lead when they are interested but NOT ready to book yet. "
        "Use interest_level: 'hot' (ready soon, clear intent), 'warm' (interested, needs follow-up), "
        "'cold' (just browsing, vague). Always capture at least the property interest and budget."
    ))
    async def capture_lead_interest(
        self,
        interest_level: Annotated[str, "hot | warm | cold"],
        caller_name: Annotated[str, "Full name of the caller"] = "",
        caller_phone: Annotated[str, "Phone number, or empty to reuse session number"] = "",
        property_interest: Annotated[str, "Property or project the caller is interested in"] = "",
        budget: Annotated[str, "Caller's stated budget range e.g. 50-80 lakhs"] = "",
        location_pref: Annotated[str, "Preferred location or area"] = "",
        unit_type: Annotated[str, "Preferred unit type e.g. 2BHK, villa, plot"] = "",
        purpose: Annotated[str, "buying | renting | investment"] = "",
        notes: Annotated[str, "Any other important details from the conversation"] = "",
    ) -> str:
        started_at = time.monotonic()
        try:
            effective_phone = self._effective_phone(caller_phone)
            effective_name = self._effective_name(caller_name)
            if not effective_phone:
                return "I still need a callback number to save this lead."
            result = await asyncio.to_thread(
                db.capture_lead,
                effective_phone,
                caller_name=effective_name,
                interest_level=interest_level,
                property_interest=property_interest,
                budget=budget,
                location_pref=location_pref,
                unit_type=unit_type,
                purpose=purpose,
                notes=notes,
                call_room_id=self.room_name or "",
            )
            if result:
                level_label = {"hot": "🔥 Hot", "warm": "Warm", "cold": "Cold"}.get(interest_level.lower(), interest_level)
                logger.info("[TOOL] capture_lead_interest: %s lead saved for %s", level_label, effective_phone)
                return f"Lead captured successfully as {level_label}. Our team will follow up soon."
            return "I had trouble saving the lead. Please try again."
        except Exception as exc:
            logger.error("[TOOL] capture_lead_interest failed: %s", exc)
            return "I am having trouble saving the lead right now."
        finally:
            self._record_tool_time(started_at)

    @llm.function_tool(description=(
        "Retrieve this caller's full call history — previous summaries, durations, and sentiments. "
        "Call this when the caller references a previous call, says they called before, or asks about a past inquiry."
    ))
    async def get_caller_history(self) -> str:
        started_at = time.monotonic()
        try:
            phone = self._effective_phone()
            if not phone:
                return "I do not have a phone number on file to look up call history."
            # Fire filler concurrently
            if self._session_ref is not None:
                try:
                    self._session_ref.say("Let me pull up your previous call history.", add_to_chat_ctx=False)
                except Exception:
                    pass
            rows = await asyncio.to_thread(db.fetch_full_caller_history, phone, 5)
            if not rows:
                return "I could not find any previous calls for this number."
            lines = []
            for i, r in enumerate(rows):
                date = str(r.get("created_at") or "")[:10]
                duration = int(r.get("duration_seconds") or r.get("duration") or 0)
                summary = str(r.get("summary") or "").strip()
                sentiment = str(r.get("sentiment") or "").strip()
                entry = f"Call {i + 1} on {date} ({duration}s"
                if sentiment:
                    entry += f", {sentiment}"
                entry += ")"
                if summary:
                    entry += f": {summary[:150]}"
                lines.append(entry)
            return "Call history:\n" + "\n".join(lines)
        except Exception as exc:
            logger.error("[TOOL] get_caller_history failed: %s", exc)
            return "I am having trouble fetching the call history right now."
        finally:
            self._record_tool_time(started_at)


class OutboundAssistant(Agent):
    def __init__(
        self,
        agent_tools: AgentTools,
        first_line: str = "",
        live_config: dict | None = None,
        caller_profile: dict | None = None,
        runtime_state: dict | None = None,
    ) -> None:
        tools = llm.find_function_tools(agent_tools)
        self._first_line = first_line
        self._live_config = live_config or {}
        self._caller_profile = caller_profile or {}
        self._runtime_state = runtime_state or {}

        base_instructions = str(self._live_config.get("agent_instructions") or "").strip()
        if not base_instructions:
            base_instructions = (
                "You are Aryan, a real-estate voice receptionist for a property sales team. "
                "Qualify the caller, answer property questions using confirmed information, and help "
                "them book a site visit or transfer to a human when needed. "
                "Speak with a natural, conversational, and professional cadence. Allow for brief pauses and do not rush the caller."
            )

        phone_raw = self._caller_profile.get("phone_number") or ""
        if phone_raw == "Web-Sandbox-Test":
            phone_digits = "9999991234"
            phone_hint = "1234"
            trusted_phone = True
        else:
            phone_digits = re.sub(r"\D", "", db.normalize_phone_number(phone_raw))
            phone_hint = phone_digits[-4:] if len(phone_digits) >= 4 else ""
            trusted_phone = bool(self._caller_profile.get("trusted_phone")) and bool(phone_digits)
        caller_name = str(self._caller_profile.get("display_name") or "").strip()
        caller_context = [
            "[CALLER CONTEXT]",
            f"Known caller name: {caller_name or 'unknown'}",
        ]
        if trusted_phone and phone_hint:
            caller_context.extend(
                [
                    f"Trusted phone on file ends with {phone_hint}.",
                    "Do not ask for the phone number from scratch.",
                    "If you need to confirm the number for booking, confirm it briefly using the last four digits and then reuse it.",
                ]
            )
        elif trusted_phone:
            caller_context.append("A trusted phone number is already on file for this call. Do not ask for it again unless corrected.")
        prompt = (
            base_instructions
            + "\n\n"
            + "\n".join(caller_context)
            + "\n\n[CALL POLICY]\n"
            + "This backend-only branch supports inbound and outbound phone calls only.\n"
            + "Do not promise WhatsApp messages, reminders, demo links, or follow-up automation.\n"
            + "Use the knowledge-base tool before guessing.\n"
            + "When facts are not confirmed, say so plainly.\n"
            + "Default next steps are a site visit, a callback, or a human transfer.\n"
            + "For real-estate inquiries, gather the property/project of interest, preferred location, unit type, budget range, buying or rental purpose, visit date preference, caller name, and callback number.\n"
            + "Ask only one or two concise questions at a time, and do not pressure the caller.\n"
            + "IMPORTANT: You MUST call save_booking_intent as soon as the caller agrees to a slot. "
            + "A site visit is NOT booked until you call that tool. "
            + "Include property/project name, unit type, budget, purpose, inquiry topic, and special requests in the notes field of save_booking_intent.\n\n"
            + "[HUMAN TRANSFER PROTOCOL]\n"
            + "If the caller asks for final pricing, discounts, negotiation, legal documents, loan approval, payment terms, a manager, or anything beyond confirmed KB information, say 'I am connecting you to our sales team right now' and call transfer_call.\n"
            + "Do not invent property availability, prices, possession dates, RERA/legal details, or financing terms. Use the knowledge-base tool before answering factual property questions.\n\n"
            + "[CALL ENDING DIRECTIVE]\n"
            + "After you have completed your task (booking confirmed, question answered, or transfer initiated), "
            + "give a brief warm goodbye and IMMEDIATELY call the end_call tool to disconnect the call. "
            + "Do NOT keep the call open after the work is done. "
            + "If the caller explicitly says goodbye or indicates they are done, say a one-sentence farewell and call end_call right away. "
            + "Do not wait for the caller to hang up — always end the call proactively.\n\n"
            + "[LEAD CAPTURE PROTOCOL]\n"
            + "If the caller is interested in a property but NOT ready to book a site visit right now, call capture_lead_interest before ending the call.\n"
            + "Use interest_level='hot' if they want to visit or buy very soon, 'warm' if they need time, 'cold' if just browsing.\n"
            + "Always capture: property_interest, budget, location_pref, unit_type, purpose, and any key notes.\n\n"
            + "[CALLER HISTORY PROTOCOL]\n"
            + "If the caller says they called before, mentions a previous inquiry, or asks about a past conversation, call get_caller_history immediately."
            + get_ist_time_context()
            + get_language_instruction(str(self._live_config.get('lang_preset') or 'multilingual'))
        )
        token_count = count_tokens(prompt)
        logger.info("[PROMPT] System prompt tokens: %s", token_count)
        super().__init__(instructions=prompt, tools=tools)

    async def on_enter(self) -> None:
        greeting = get_opening_greeting(self._live_config, self._first_line)
        if not gemini_live_supports_scripted_generation(self._live_config):
            await say_with_gemini_tts(self.session, greeting, self._live_config, purpose="opening line")
            return
        await self.session.generate_reply(
            instructions=f"Say exactly this opening line in a warm Indian phone-call style: {json.dumps(greeting)}"
        )

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        del turn_ctx
        query = str(new_message.text_content or "").strip()
        active_turn = self._runtime_state.get("active_turn")
        if active_turn:
            active_turn["query"] = query
            active_turn.setdefault("kb_used", False)
            active_turn["kb_skipped_reason"] = "tool_driven"


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    logger.info("[ROOM] Connected: %s", ctx.room.name)

    phone_number = None
    caller_name = ""
    caller_phone = "unknown"
    job_meta: dict = {}

    metadata = ctx.job.metadata or ""
    if metadata:
        try:
            parsed = json.loads(metadata)
            if isinstance(parsed, dict):
                job_meta = parsed
                phone_number = parsed.get("phone_number")
                caller_name = str(parsed.get("caller_name") or "").strip()
            elif isinstance(parsed, str):
                phone_number = parsed
        except Exception:
            pass

    for _ in range(10):
        if ctx.room.remote_participants:
            break
        await asyncio.sleep(0.3)

    detected_sip_identity = None
    for identity, participant in ctx.room.remote_participants.items():
        if not detected_sip_identity:
            detected_sip_identity = identity
            logger.info("[ROOM] Initial SIP participant detected: %s", identity)
        
        if participant.name and participant.name not in ("", "Caller", "Unknown"):
            caller_name = participant.name
        if not phone_number:
            attrs = participant.attributes or {}
            phone_number = attrs.get("sip.phoneNumber") or attrs.get("phoneNumber")
        if not phone_number:
            match = re.search(r"\+?\d{10,15}", identity)
            if match:
                phone_number = match.group()

    if not phone_number or phone_number == "unknown":
        phone_number = "Web-Sandbox-Test"
        caller_name = caller_name or "Test Caller"

    is_outbound_call = bool(phone_number and job_meta)
    caller_phone = db.normalize_phone_number(phone_number) or phone_number

    # 1. DNC (Do Not Call) Registry Check
    if caller_phone != "unknown":
        try:
            if await asyncio.to_thread(db.is_number_in_dnc, caller_phone):
                logger.warning("[DNC] Call blocked. Number is in Do-Not-Call registry: %s", caller_phone)
                ctx.shutdown()
                return
        except Exception as e:
            logger.error("[DNC] Error checking registry: %s", e)

    # 2. Persistent Database-Backed Rate Limiting (max 5 calls per hour per number, cluster-safe)
    if caller_phone != "unknown" and caller_phone != "Web-Sandbox-Test":
        try:
            recent_calls = await asyncio.to_thread(db.get_recent_call_count, caller_phone, hours=1)
            if recent_calls >= 5:
                logger.warning("[RATE-LIMIT] Call blocked. Number %s has exceeded 5 calls in the last hour.", caller_phone)
                ctx.shutdown()
                return
        except Exception as e:
            logger.error("[RATE-LIMIT] Error checking persistent rate limits: %s", e)

    if is_rate_limited(caller_phone):
        logger.warning("[RATE-LIMIT] Blocked %s", caller_phone)
        return

    live_config = get_live_config(caller_phone if caller_phone != "unknown" else None)
    
    # Publish webhook call.started
    try:
        import notify
        await asyncio.to_thread(
            notify.notify_call_started,
            caller_phone=caller_phone,
            caller_name=caller_name,
            call_room_id=ctx.room.name,
            config=live_config
        )
    except Exception as e:
        logger.error("[WEBHOOK] Failed to publish call.started: %s", e)
    if not await preflight_gemini_live_connection(live_config):
        logger.error("[VOICE] Gemini Live preflight failed and no fallback runtime is available")
        ctx.shutdown()
        return

    if not gemini_live_supports_scripted_generation(live_config):
        prefetch_gemini_tts(live_config, get_opening_greeting(live_config), purpose="opening line")

    async def get_caller_context(phone: str) -> dict[str, str]:
        normalized_phone = db.normalize_phone_number(phone or "")
        if not normalized_phone:
            return {"history_suffix": "", "display_name": "", "source": ""}
        cached = _caller_history_cache.get(normalized_phone)
        if cached and (time.monotonic() - cached[0]) < CALLER_HISTORY_CACHE_TTL:
            return cached[1]

        def _fetch_context() -> dict[str, str]:
            display_name = ""
            source = ""
            # ── Fetch last 5 calls for rich history ─────────────────────────
            rows = db.fetch_full_caller_history(normalized_phone, limit=5)
            history = ""
            if rows:
                display_name = str(rows[0].get("caller_name") or "").strip()
                source = "call_log" if display_name else ""
                lines = []
                for i, r in enumerate(rows):
                    date = str(r.get("created_at") or "")[:10]
                    duration = int(r.get("duration_seconds") or r.get("duration") or 0)
                    summary = str(r.get("summary") or "").strip()
                    sentiment = str(r.get("sentiment") or "").strip()
                    label = "Last call" if i == 0 else f"Call {i + 1}"
                    entry = f"{label} ({date}, {duration}s"
                    if sentiment:
                        entry += f", {sentiment}"
                    entry += ")"
                    if summary:
                        entry += f": {summary[:120]}"
                    lines.append(entry)
                history = "\n\n[CALLER HISTORY]\n" + "\n".join(lines)
            return {
                "history_suffix": history,
                "display_name": display_name,
                "source": source,
            }

        try:
            context = await asyncio.wait_for(asyncio.to_thread(_fetch_context), timeout=0.5)
            _caller_history_cache[normalized_phone] = (time.monotonic(), context)
            return context
        except Exception:
            return {"history_suffix": "", "display_name": "", "source": ""}

    caller_context = await get_caller_context(caller_phone)
    if not caller_name:
        caller_name = str(caller_context.get("display_name") or "").strip()
    history_suffix = caller_context.get("history_suffix") or ""
    if history_suffix:
        live_config["agent_instructions"] = str(live_config.get("agent_instructions") or "") + history_suffix

    room_input = RoomInputOptions(close_on_disconnect=False)

    session = AgentSession(
        llm=build_gemini_realtime_model(live_config),
        user_away_timeout=parse_float(live_config.get("user_away_timeout"), 15.0),
        session_close_transcript_timeout=parse_float(live_config.get("session_close_transcript_timeout"), 2.0),
    )

    sip_participant_identity = get_sip_participant_identity(phone_number)
    if not is_outbound_call and detected_sip_identity:
        logger.info("[ROOM] Using detected identity for inbound session: %s (Calculated was: %s)", 
                    detected_sip_identity, sip_participant_identity)
        sip_participant_identity = detected_sip_identity
    
    outbound_trunk_id = get_outbound_sip_trunk_id(live_config, job_meta)
    if is_outbound_call:
        if not outbound_trunk_id:
            logger.error("[OUTBOUND] Missing SIP trunk ID")
            ctx.shutdown()
            return
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=outbound_trunk_id,
                    sip_call_to=phone_number,
                    participant_identity=sip_participant_identity,
                    participant_name=caller_name or str(phone_number or ""),
                    wait_until_answered=True,
                )
            )
            logger.info("[OUTBOUND] Call answered for %s", phone_number)
            try:
                participant = await ctx.wait_for_participant(identity=sip_participant_identity)
                if participant.name and participant.name not in ("", "Caller", "Unknown"):
                    caller_name = participant.name
                attrs = participant.attributes or {}
                caller_phone = (
                    db.normalize_phone_number(attrs.get("sip.phoneNumber") or attrs.get("phoneNumber") or "")
                    or caller_phone
                )
            except Exception as exc:
                logger.debug("[OUTBOUND] wait_for_participant skipped: %s", exc)
        except api.TwirpError as exc:
            logger.error("[OUTBOUND] SIP call failed: %s", exc)
            
            # Extract and parse SIP error status
            error_message = str(exc)
            sip_status = ""
            try:
                if hasattr(exc, "metadata") and exc.metadata:
                    sip_status = exc.metadata.get("sip_status") or exc.metadata.get("sip_status_code") or ""
            except Exception:
                pass
            
            if not sip_status:
                match = re.search(r"sip status:\s*(.+)", error_message, re.IGNORECASE)
                if match:
                    sip_status = match.group(1).strip()
            
            sip_status_lower = sip_status.lower()
            if "busy" in sip_status_lower or "486" in sip_status_lower:
                status_db = "busy"
                summary_text = f"Outbound call failed: Busy ({sip_status})"
            elif "timeout" in sip_status_lower or "408" in sip_status_lower or "no answer" in sip_status_lower:
                status_db = "no-answer"
                summary_text = "Outbound call failed: No Answer"
            elif "decline" in sip_status_lower or "603" in sip_status_lower:
                status_db = "declined"
                summary_text = "Outbound call failed: Declined by user"
            else:
                status_db = "failed"
                summary_text = f"Outbound call failed: {sip_status or error_message}"
            
            try:
                # Log call failure status inSupabase active_calls and call_logs tables
                await asyncio.to_thread(db.upsert_active_call, ctx.room.name, caller_phone, caller_name, status_db)
                await asyncio.to_thread(
                    db.save_call_log,
                    phone=caller_phone,
                    duration=0,
                    transcript="",
                    summary=summary_text,
                    caller_name=caller_name,
                    call_room_id=ctx.room.name,
                )
            except Exception as db_exc:
                logger.error("[OUTBOUND] Failed to log call failure to database: %s", db_exc)
                
            ctx.shutdown()
            return
        except Exception as exc:
            logger.error("[OUTBOUND] Could not create SIP participant: %s", exc)
            try:
                await asyncio.to_thread(db.upsert_active_call, ctx.room.name, caller_phone, caller_name, "failed")
                await asyncio.to_thread(
                    db.save_call_log,
                    phone=caller_phone,
                    duration=0,
                    transcript="",
                    summary=f"Outbound call failed: {exc}",
                    caller_name=caller_name,
                    call_room_id=ctx.room.name,
                )
            except Exception as db_exc:
                logger.error("[OUTBOUND] Failed to log call failure to database: %s", db_exc)
            ctx.shutdown()
            return

    caller_phone = db.normalize_phone_number(caller_phone or "") or "unknown"
    caller_profile = {
        "phone_number": "" if caller_phone == "unknown" else caller_phone,
        "display_name": caller_name,
        "trusted_phone": caller_phone != "unknown",
        "confirmed_phone": caller_phone != "unknown",
        "source": str(caller_context.get("source") or "").strip() or ("sip" if caller_phone != "unknown" else "unknown"),
    }
    runtime_state: dict[str, object] = {
        "active_turn": None,
        "completed_turns": 0,
        "caller_profile": caller_profile,
    }

    agent_tools = AgentTools(
        caller_phone=caller_phone,
        caller_name=caller_name,
        live_config=live_config,
        caller_profile=caller_profile,
        runtime_state=runtime_state,
        shutdown_fn=ctx.shutdown,
    )
    agent_tools.ctx_api = ctx.api
    agent_tools.room_name = ctx.room.name
    agent_tools._sip_identity = sip_participant_identity

    agent = OutboundAssistant(
        agent_tools=agent_tools,
        first_line=str(live_config.get("first_line") or ""),
        live_config=live_config,
        caller_profile=caller_profile,
        runtime_state=runtime_state,
    )

    await session.start(room=ctx.room, agent=agent, room_input_options=room_input)
    agent_tools._session_ref = session  # enables filler phrase injection from tools
    logger.info("[AGENT] Session live")
    
    # Publish webhook call.answered
    try:
        import notify
        await asyncio.to_thread(
            notify.notify_call_answered,
            caller_phone=caller_phone,
            caller_name=caller_name,
            call_room_id=ctx.room.name,
            config=live_config
        )
    except Exception as e:
        logger.error("[WEBHOOK] Failed to publish call.answered: %s", e)
        
    call_start_time = datetime.now(timezone.utc)

    wrapup_instructions = (
        "Politely wrap up the conversation, thank the caller, confirm they can call back anytime, and say goodbye."
    )
    wrapup_tts_text = "Thank you for your time. You can call us back anytime. Have a lovely day. Goodbye."

    async def _queue_polite_wrapup() -> None:
        if not gemini_live_supports_scripted_generation(live_config):
            await say_with_gemini_tts(session, wrapup_tts_text, live_config, purpose="wrap-up")
            return
        await session.generate_reply(instructions=wrapup_instructions)

    def queue_polite_wrapup() -> None:
        asyncio.create_task(_queue_polite_wrapup())

    def _recording_configured() -> bool:
        required = (
            "LIVEKIT_URL",
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
            "SUPABASE_S3_ACCESS_KEY",
            "SUPABASE_S3_SECRET_KEY",
            "SUPABASE_S3_ENDPOINT",
        )
        return all(str(os.environ.get(key, "")).strip() for key in required)

    egress_id = None
    if _recording_configured():
        try:
            rec_api = api.LiveKitAPI(
                url=os.environ["LIVEKIT_URL"],
                api_key=os.environ["LIVEKIT_API_KEY"],
                api_secret=os.environ["LIVEKIT_API_SECRET"],
            )
            egress_resp = await rec_api.egress.start_room_composite_egress(
                api.RoomCompositeEgressRequest(
                    room_name=ctx.room.name,
                    audio_only=True,
                    file_outputs=[
                        api.EncodedFileOutput(
                            file_type=api.EncodedFileType.OGG,
                            filepath=f"recordings/{ctx.room.name}.ogg",
                            s3=api.S3Upload(
                                access_key=os.environ["SUPABASE_S3_ACCESS_KEY"],
                                secret=os.environ["SUPABASE_S3_SECRET_KEY"],
                                bucket="call-recordings",
                                region=os.environ.get("SUPABASE_S3_REGION", "ap-south-1"),
                                endpoint=os.environ["SUPABASE_S3_ENDPOINT"],
                                force_path_style=True,
                            ),
                        )
                    ],
                )
            )
            egress_id = egress_resp.egress_id
            await rec_api.aclose()
        except Exception as exc:
            logger.warning("[RECORDING] Failed to start recording: %s", exc)

    async def _log_transcript(role: str, content: str) -> None:
        await asyncio.to_thread(db.save_call_transcript, ctx.room.name, caller_phone, role, content)

    def _make_active_turn(started_monotonic: float | None = None) -> dict[str, object]:
        return {
            "turn_index": None,
            "query": "",
            "started_monotonic": started_monotonic or time.monotonic(),
            "tool_ms": 0.0,
            "kb_used": False,
            "kb_skipped_reason": "",
            "metadata": {},
            "user_transcript_logged": False,
        }

    def _drop_pending_turn() -> None:
        active_turn = runtime_state.get("active_turn")
        if active_turn and not active_turn.get("turn_index"):
            runtime_state["active_turn"] = None

    turn_count = 0
    interrupt_count = 0
    agent_is_speaking = False

    def _record_user_turn(transcript: str, *, started_monotonic: float | None = None) -> None:
        nonlocal turn_count, agent_is_speaking
        transcript = str(transcript or "").strip()
        transcript_lower = transcript.lower().rstrip(".")
        if agent_is_speaking:
            _drop_pending_turn()
            return
        if not transcript or len(transcript) < 3:
            _drop_pending_turn()
            return
        if transcript_lower in FILLER_WORDS:
            _drop_pending_turn()
            return

        active_turn = runtime_state.get("active_turn")
        if not active_turn:
            active_turn = _make_active_turn(started_monotonic)
            runtime_state["active_turn"] = active_turn
        if not active_turn.get("started_monotonic"):
            active_turn["started_monotonic"] = started_monotonic or time.monotonic()

        active_turn["query"] = transcript
        active_turn.setdefault("metadata", {})
        active_turn["metadata"]["user_transcript"] = transcript

        if not active_turn.get("user_transcript_logged"):
            asyncio.create_task(_log_transcript("user", transcript))
            active_turn["user_transcript_logged"] = True

        if not active_turn.get("turn_index"):
            turn_count += 1
            active_turn["turn_index"] = turn_count
            if turn_count >= max(1, parse_int(live_config.get("max_turns"), 25)):
                queue_polite_wrapup()

    async def _clear_agent_speaking_after_cooldown() -> None:
        nonlocal agent_is_speaking
        await asyncio.sleep(0.6)
        agent_is_speaking = False

    async def _flush_active_turn_metric(*, reason: str = "") -> None:
        active_turn = runtime_state.get("active_turn")
        if not active_turn:
            return
        turn_index = parse_int(active_turn.get("turn_index"), 0)
        if turn_index < 1:
            runtime_state["active_turn"] = None
            return
        payload = {
            "call_room_id": ctx.room.name,
            "phone_number": caller_phone if caller_phone != "unknown" else "",
            "turn_index": turn_index,
            "speaker": "assistant",
            "stt_endpoint_ms": active_turn.get("stt_endpoint_ms"),
            "kb_ms": active_turn.get("kb_ms"),
            "llm_first_token_ms": active_turn.get("llm_first_token_ms"),
            "tts_first_audio_ms": active_turn.get("tts_first_audio_ms"),
            "tool_ms": active_turn.get("tool_ms"),
            "total_turn_ms": active_turn.get("total_turn_ms"),
            "kb_used": bool(active_turn.get("kb_used")),
            "kb_skipped_reason": active_turn.get("kb_skipped_reason") or reason or None,
            "metadata": active_turn.get("metadata") or {},
        }
        await asyncio.to_thread(db.save_call_turn_metric, payload)
        runtime_state["active_turn"] = None

    @session.on("conversation_item_added")
    def _on_conversation_item_added(ev) -> None:
        item = getattr(ev, "item", None)
        if not isinstance(item, llm.ChatMessage):
            return
        metrics = item.metrics or {}
        if item.role == "user":
            if item.text_content:
                transcript = str(item.text_content or "").strip()
                logger.info("🎤 [STT ] User said: %s", transcript)
                _record_user_turn(transcript)
            active_turn = runtime_state.get("active_turn")
            if active_turn:
                stt_ms = (
                    float(metrics.get("end_of_turn_delay") or 0.0)
                    + float(metrics.get("transcription_delay") or 0.0)
                    + float(metrics.get("on_user_turn_completed_delay") or 0.0)
                ) * 1000.0
                active_turn["stt_endpoint_ms"] = round(stt_ms, 2)
        elif item.role == "assistant":
            text = str(item.text_content or "").strip()
            if text:
                logger.info("🤖 [LLM ] AI response: %s", text)
                logger.info("🔊 [TTS ] Speaking: %s", text[:120] + ("..." if len(text) > 120 else ""))
                asyncio.create_task(_log_transcript("assistant", text))
            active_turn = runtime_state.get("active_turn")
            if not active_turn or not active_turn.get("turn_index"):
                return
            active_turn["llm_first_token_ms"] = round(float(metrics.get("llm_node_ttft") or 0.0) * 1000.0, 2)
            active_turn["tts_first_audio_ms"] = round(float(metrics.get("tts_node_ttfb") or 0.0) * 1000.0, 2)
            active_turn["total_turn_ms"] = round(
                (time.monotonic() - float(active_turn.get("started_monotonic") or time.monotonic())) * 1000.0,
                2,
            )
            active_turn.setdefault("metadata", {})
            active_turn["metadata"]["assistant_chars"] = len(text)
            runtime_state["completed_turns"] = int(runtime_state.get("completed_turns") or 0) + 1
            # ── Per-turn latency summary ──
            logger.info(
                "⏱  [TURN] #%s latency → STT: %sms | LLM: %sms | TTS: %sms | Total: %sms",
                active_turn.get("turn_index"),
                active_turn.get("stt_endpoint_ms"),
                active_turn.get("llm_first_token_ms"),
                active_turn.get("tts_first_audio_ms"),
                active_turn.get("total_turn_ms"),
            )
            asyncio.create_task(_flush_active_turn_metric())

    first_speech_start = None
    first_speech_duration = 0.0
    amd_classified = False

    async def _handle_voicemail_shutdown() -> None:
        try:
            await asyncio.to_thread(db.upsert_active_call, ctx.room.name, caller_phone, caller_name, "voicemail")
            await asyncio.to_thread(
                db.save_call_log,
                phone=caller_phone,
                duration=0,
                transcript="",
                summary="Call hung up: Voicemail / Answering Machine detected.",
                caller_name=caller_name,
                call_room_id=ctx.room.name,
            )
            # Send Webhook
            from notify import send_webhook
            send_webhook("call.completed", {
                "phone_number": caller_phone,
                "caller_name": caller_name,
                "duration_seconds": 0,
                "call_summary": "Voicemail / Answering Machine detected.",
                "status": "voicemail"
            }, config=live_config)
        except Exception as e:
            logger.error("[AMD] Error logging voicemail: %s", e)
        ctx.shutdown()

    @session.on("user_state_changed")
    def _on_user_state_changed(ev) -> None:
        nonlocal first_speech_start, amd_classified, first_speech_duration
        new_state = getattr(ev, "new_state", None)
        
        if new_state == "speaking":
            if first_speech_start is None and not amd_classified:
                first_speech_start = time.monotonic()
                logger.info("[AMD] First speech segment started...")
                
            active_turn = runtime_state.get("active_turn")
            if active_turn:
                return
            runtime_state["active_turn"] = _make_active_turn(time.monotonic())
            
        elif first_speech_start is not None and not amd_classified:
            # Speech ended
            duration = time.monotonic() - first_speech_start
            first_speech_start = None
            first_speech_duration = duration
            logger.info("[AMD] First speech duration: %.2fs", duration)
            
            # If the first segment is short (< 4.2s), we verify them as human immediately
            if duration < 4.2:
                amd_classified = True
                logger.info("[AMD] Human verified (short first greeting duration: %.2fs)", duration)

    @session.on("user_input_transcribed")
    def _on_user_input_transcribed(ev) -> None:
        nonlocal amd_classified
        if not getattr(ev, "is_final", False):
            return
        transcript = getattr(ev, "transcript", "")
        if transcript:
            logger.info("🎤 [STT ] Transcribed (final): %s", transcript)
        _record_user_turn(transcript)

        # Run transcription-based AMD verification if duration is long but not yet classified
        if not amd_classified and first_speech_duration > 0.0:
            amd_classified = True
            clean_text = str(transcript or "").strip().lower()
            logger.info("[AMD] Analyzing first segment transcript for voicemail: '%s' (Duration: %.2fs)", clean_text, first_speech_duration)
            
            is_voicemail = False
            if first_speech_duration > 4.2:
                # Common human greetings
                greetings = ["hello", "hi", "yes", "namaste", "halo", "namaskar", "please", "sir", "mam", "madam", "avunu", "cheppandi"]
                has_greeting = any(g in clean_text for g in greetings)
                
                # Explicit voicemail keywords
                voicemail_keywords = ["leave a message", "not available", "after the beep", "after the tone", "record your", "voicemail", "message after"]
                has_voicemail_keywords = any(kw in clean_text for kw in voicemail_keywords)
                
                if has_voicemail_keywords:
                    is_voicemail = True
                elif not has_greeting and len(clean_text.split()) >= 5:
                    # Long continuous segment with no human greeting is likely a machine
                    is_voicemail = True
                elif first_speech_duration > 8.5:
                    # Incredibly long first segment (> 8.5s)
                    is_voicemail = True
            
            if is_voicemail:
                logger.warning("[AMD] Voicemail detected! Hanging up call to save resources.")
                asyncio.create_task(_handle_voicemail_shutdown())
            else:
                logger.info("[AMD] Human verified successfully.")

    @session.on("agent_state_changed")
    def _on_agent_state_changed(ev) -> None:
        nonlocal agent_is_speaking
        if getattr(ev, "new_state", None) == "speaking":
            agent_is_speaking = True
            return
        if getattr(ev, "old_state", None) == "speaking":
            asyncio.create_task(_clear_agent_speaking_after_cooldown())

    @session.on("agent_speech_started")
    def _on_agent_speech_started(ev) -> None:
        del ev
        nonlocal agent_is_speaking
        agent_is_speaking = True

    @session.on("agent_speech_finished")
    def _on_agent_speech_finished(ev) -> None:
        del ev
        asyncio.create_task(_clear_agent_speaking_after_cooldown())

    @session.on("agent_speech_interrupted")
    def _on_interrupted(ev) -> None:
        del ev
        nonlocal interrupt_count
        interrupt_count += 1

    @ctx.room.on("participant_disconnected")
    def _on_participant_disconnected(participant) -> None:
        del participant
        asyncio.create_task(unified_shutdown_hook(ctx))

    await asyncio.to_thread(db.upsert_active_call, ctx.room.name, caller_phone, caller_name, "active")

    shutdown_guard = {"started": False}
    shutdown_lock = asyncio.Lock()

    async def unified_shutdown_hook(shutdown_ctx: JobContext) -> None:
        async with shutdown_lock:
            if shutdown_guard["started"]:
                return
            shutdown_guard["started"] = True

        await _flush_active_turn_metric(reason="call_ended")
        duration = int((datetime.now(timezone.utc) - call_start_time).total_seconds())
        booking_was_confirmed = False

        transcript_text = ""
        try:
            messages = agent.chat_ctx.messages
            if callable(messages):
                messages = messages()
            lines = []
            for message in messages:
                role = getattr(message, "role", None)
                if role not in ("user", "assistant"):
                    continue
                content = getattr(message, "content", "")
                if isinstance(content, list):
                    content = " ".join(str(piece) for piece in content if isinstance(piece, str))
                content = str(content or "").strip()
                if content:
                    lines.append(f"[{str(role).upper()}] {content}")
            transcript_text = "\n".join(lines).strip()
        except Exception:
            transcript_text = ""
        if not transcript_text:
            rows = await asyncio.to_thread(db.list_call_transcripts, call_room_id=ctx.room.name, limit=500)
            transcript_text = "\n".join(
                f"[{str(row.get('role') or '').upper()}] {str(row.get('content') or '').strip()}"
                for row in rows
                if str(row.get("content") or "").strip()
            ).strip()

        booking_status_msg = "No booking"
        if agent_tools.booking_intent:
            intent = agent_tools.booking_intent
            if intent.get("confirmed") and intent.get("booking_id"):
                booking_was_confirmed = True
                booking_status_msg = f"Booking Confirmed: {intent.get('booking_id')}"
            else:
                # This fallback handles cases where save_booking_intent was called but failed or didn't confirm
                booking_status_msg = f"Booking Pending/Failed"
            agent_tools.booking_intent = None
        else:
            summary_text = transcript_text or "Caller did not schedule during this call."
            handle_call_no_booking(
                caller_name=agent_tools._effective_name(agent_tools.caller_name) or "Unknown Caller",
                phone_number=agent_tools._effective_phone(agent_tools.caller_phone),
                call_summary=summary_text[:1200],
                related_call_room_id=ctx.room.name,
                config=live_config,
            )

        duration_minutes = duration / 60.0
        cost_vobiz_inr = round(duration_minutes * 0.40, 2)
        cost_livekit_inr = 0.00
        cost_gemini_inr = round(duration_minutes * 0.85, 2)
        cost_total_inr = round(cost_vobiz_inr + cost_livekit_inr + cost_gemini_inr, 2)
        estimated_cost = round((duration / 60) * 0.008 + (len(transcript_text) / 1000) * 0.003, 5)
        call_dt = call_start_time.astimezone(_IST)

        recording_url = ""
        if egress_id:
            try:
                stop_api = api.LiveKitAPI(
                    url=os.environ["LIVEKIT_URL"],
                    api_key=os.environ["LIVEKIT_API_KEY"],
                    api_secret=os.environ["LIVEKIT_API_SECRET"],
                )
                await stop_api.egress.stop_egress(api.StopEgressRequest(egress_id=egress_id))
                await stop_api.aclose()
                base_url = str(os.environ.get("SUPABASE_URL", "") or os.environ.get("VITE_SUPABASE_URL", "")).rstrip("/")
                if base_url:
                    recording_url = (
                        f"{base_url}/storage/v1/object/public/call-recordings/recordings/{ctx.room.name}.ogg"
                    )
            except Exception as exc:
                logger.warning("[RECORDING] Stop failed: %s", exc)

        final_phone = agent_tools._effective_phone()
        final_name = agent_tools._effective_name()
        
        try:
            await asyncio.wait_for(
                asyncio.to_thread(db.upsert_active_call, ctx.room.name, final_phone, final_name, "completed"),
                timeout=5.0
            )
        except Exception as exc:
            logger.warning("[SHUTDOWN] upsert_active_call failed or timed out: %s", exc)

        # Determine sentiment / caller interest level dynamically using Gemini (with keyword fallback)
        sentiment_label = "neutral"
        if booking_was_confirmed:
            sentiment_label = "interested"
        elif not transcript_text.strip():
            sentiment_label = "not_lifted"
        else:
            try:
                from google import genai
                client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
                prompt = (
                    "Analyze this phone call transcript and classify the caller's interest in the product/service "
                    "into exactly one of these labels: 'interested', 'not_interested', or 'neutral'.\n\n"
                    f"Transcript:\n{transcript_text}\n\n"
                    "Respond with only the label itself."
                )
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model="gemini-2.5-flash",
                        contents=prompt
                    ),
                    timeout=6.0
                )
                result = str(response.text).strip().lower()
                if "not_interested" in result or "not interested" in result:
                    sentiment_label = "not_interested"
                elif "interested" in result:
                    sentiment_label = "interested"
                else:
                    sentiment_label = "neutral"
            except Exception as e:
                logger.warning("[AGENT] Failed to analyze call sentiment with Gemini: %s", e)
                # Rule-based fallback
                lowered_transcript = transcript_text.lower()
                interested_keywords = [
                    "interested", "yes", "book", "visit", "buy", "details", "contact", 
                    "location", "price", "site", "meeting", "appointment", "schedule",
                    "chala", "bagundi", "kavalali", "interest", "sare", "ok"
                ]
                not_interested_keywords = [
                    "not interested", "wrong number", "don't call", "no", "busy", 
                    "hang up", "stop", "cancel", "vaddu", "interesam ledu"
                ]
                int_score = sum(lowered_transcript.count(kw) for kw in interested_keywords)
                not_int_score = sum(lowered_transcript.count(kw) for kw in not_interested_keywords)
                if int_score > not_int_score:
                    sentiment_label = "interested"
                elif not_int_score > int_score:
                    sentiment_label = "not_interested"

        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    db.save_call_log,
                    final_phone,
                    duration,
                    transcript_text,
                    booking_status_msg,
                    recording_url,
                    final_name,
                    sentiment_label,
                    estimated_cost,
                    call_dt.date().isoformat(),
                    call_dt.hour,
                    call_dt.strftime("%A"),
                    booking_was_confirmed,
                    interrupt_count,
                    ctx.room.name,
                    cost_vobiz_inr=cost_vobiz_inr,
                    cost_livekit_inr=cost_livekit_inr,
                    cost_gemini_inr=cost_gemini_inr,
                    cost_total_inr=cost_total_inr,
                ),
                timeout=5.0
            )
        except Exception as exc:
            logger.warning("[SHUTDOWN] save_call_log failed or timed out: %s", exc)

    ctx.add_shutdown_callback(unified_shutdown_hook)


def main() -> None:
    _maybe_relaunch_in_venv()
    worker_host = str(os.environ.get("AGENT_HOST") or os.environ.get("LIVEKIT_WORKER_HOST") or "").strip()
    worker_port = parse_int(os.environ.get("AGENT_PORT") or os.environ.get("LIVEKIT_WORKER_PORT"), 8081)
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=DEFAULT_AGENT_NAME,
            host=worker_host,
            port=worker_port,
        )
    )


if __name__ == "__main__":
    main()
