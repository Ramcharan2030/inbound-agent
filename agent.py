import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.genai import types as google_types


def _bootstrap_venv() -> None:
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
    os.execv(str(target_python), [str(target_python), str(Path(__file__).resolve()), *sys.argv[1:]])


_bootstrap_venv()
load_dotenv()

from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession

try:
    from livekit.plugins import google as google_plugin
except ImportError:
    google_plugin = None


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

CONFIG_FILE = Path(__file__).resolve().parent / "config.json"
DEFAULT_CONFIG = {
    "first_line": "Namaste! This is Aryan from SPX AI. We help businesses automate with AI. Hmm, may I ask what kind of business you run?",
    "agent_instructions": "",
    "gemini_live_model": "gemini-3.1-flash-live-preview",
    "gemini_live_voice": "Puck",
    "gemini_live_language": "",
    "gemini_live_temperature": 0.8,
}


def read_config() -> dict:
    if not CONFIG_FILE.exists():
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return dict(DEFAULT_CONFIG)
    merged = dict(DEFAULT_CONFIG)
    merged.update({k: v for k, v in data.items() if v is not None})
    return merged


def build_turn_handling() -> dict:
    return {
        "turn_detection": "realtime_llm",
        "endpointing": {"mode": "fixed", "min_delay": 0.2, "max_delay": 0.8},
        # Realtime Gemini uses server-side turn detection, and LiveKit requires
        # speech to remain interruptible in that mode.
        "interruption": {"enabled": True},
    }


def build_realtime_model(config: dict):
    if google_plugin is None:
        raise RuntimeError("livekit-plugins-google is required to start the voice agent.")
    api_key = str(os.environ.get("GOOGLE_API_KEY") or config.get("google_api_key") or "").strip()
    if not api_key:
        raise RuntimeError("Set GOOGLE_API_KEY so Gemini Live can connect.")
    instructions = str(config.get("agent_instructions") or "").strip()
    first_line = str(config.get("first_line") or DEFAULT_CONFIG["first_line"]).strip()
    if first_line:
        greeting_hint = (
            "If the caller greets you or asks who is speaking, respond with this opening line "
            f"or a very close natural variation: {first_line}"
        )
        instructions = f"{instructions}\n\n{greeting_hint}".strip() if instructions else greeting_hint
    language = str(config.get("gemini_live_language") or "").strip() or None
    model = str(config.get("gemini_live_model") or DEFAULT_CONFIG["gemini_live_model"]).strip()
    voice = str(config.get("gemini_live_voice") or DEFAULT_CONFIG["gemini_live_voice"]).strip()
    temperature = config.get("gemini_live_temperature", DEFAULT_CONFIG["gemini_live_temperature"])
    try:
        temperature = float(temperature)
    except (TypeError, ValueError):
        temperature = float(DEFAULT_CONFIG["gemini_live_temperature"])
    return google_plugin.realtime.RealtimeModel(
        api_key=api_key,
        model=model,
        voice=voice,
        language=language,
        temperature=temperature,
        instructions=instructions,
        modalities=[google_types.Modality.AUDIO],
        input_audio_transcription=google_types.AudioTranscriptionConfig(),
        output_audio_transcription=google_types.AudioTranscriptionConfig(),
        thinking_config=google_types.ThinkingConfig(include_thoughts=False),
    )


class InboundVoiceAgent(Agent):
    def __init__(self, config: dict) -> None:
        instructions = str(config.get("agent_instructions") or "").strip() or (
            "You are a concise, polite Indian inbound voice assistant. "
            "Keep replies short, ask one question at a time, and stay helpful."
        )
        self._first_line = str(config.get("first_line") or DEFAULT_CONFIG["first_line"]).strip()
        super().__init__(
            instructions=instructions,
            turn_handling={"interruption": {"enabled": True}},
        )

    async def on_enter(self):
        if not self._first_line:
            return
        await self.session.say(
            self._first_line,
            allow_interruptions=True,
            add_to_chat_ctx=True,
        )


async def entrypoint(ctx: JobContext):
    config = read_config()
    logger.info("Worker joined room: %s", ctx.room.name)
    session = AgentSession(
        llm=build_realtime_model(config),
        turn_handling=build_turn_handling(),
    )
    await session.start(
        agent=InboundVoiceAgent(config),
        room=ctx.room,
    )


if __name__ == "__main__":
    worker_host = str(os.environ.get("AGENT_HOST") or "0.0.0.0").strip() or "0.0.0.0"
    worker_port = int(str(os.environ.get("AGENT_PORT") or "8081"))
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="inbound-voice-agent",
            host=worker_host,
            port=worker_port,
        )
    )
