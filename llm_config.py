from __future__ import annotations

from typing import Any

SUPPORTED_LLM_PROVIDERS = ("gemini",)
DEFAULT_LLM_PROVIDER = "gemini"

LLM_PROVIDER_UI = {
    "gemini": {
        "label": "Gemini",
        "default_model": "gemini-3.1-flash-live-preview",
        "hint": "Google Gemini Live realtime voice model.",
    },
}

def normalize_llm_provider(value: str | None) -> str:
    return "gemini"

def get_default_llm_model(provider: str | None = None) -> str:
    return "gemini-3.1-flash-live-preview"

def apply_llm_defaults(config: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(config or {})
    merged["llm_provider"] = "gemini"
    merged["llm_model"] = "gemini-3.1-flash-live-preview"
    return merged
