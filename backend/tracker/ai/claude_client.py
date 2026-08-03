"""
Google Gemini API wrapper for CDP/CMS AI features (Google AI Studio, free tier).

Configure via:
  GEMINI_API_KEY
  GEMINI_MODEL_HAIKU  — fast / high-volume (checklist, feedback, classification)
  GEMINI_MODEL_SONNET — reasoning / drafting (briefs, minutes, similarity)

Function names/tiers ("haiku"/"sonnet") are kept as internal labels for a 1:1 mapping
from the previous Claude integration — they no longer refer to Anthropic models.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from typing import Any, Literal

logger = logging.getLogger("scdms.app")

ModelTier = Literal["haiku", "sonnet"]

# Rolling aliases (not pinned snapshots) — Google periodically retires pinned
# model IDs for new API keys/projects (e.g. gemini-2.5-flash-lite 404s on new
# projects as of Aug 2026); the -latest aliases track whatever generation is
# current so this doesn't need a code change every time Google cycles models.
_CURRENT_DEFAULTS: dict[ModelTier, str] = {
    "sonnet": "gemini-flash-latest",
    "haiku": "gemini-flash-lite-latest",
}


def _settings_attr(name: str, default: str = "") -> str:
    # 1. Runtime override stored in SystemSetting (admin-configurable via the
    #    Administration panel). Takes precedence so a key entered in the UI works
    #    without redeploying / editing .env.
    try:
        from ..models import SystemSetting

        stored = (SystemSetting.get_val(name) or "").strip()
        if stored:
            return stored
    except Exception:
        pass

    # 2. Django settings / environment (.env).
    try:
        from django.conf import settings

        return getattr(settings, name, None) or os.environ.get(name, default)
    except Exception:
        return os.environ.get(name, default)


def resolve_gemini_api_key() -> str:
    """
    Active Gemini API key: Admin SystemSetting overrides environment/.env.
    """
    try:
        from tracker.models import SystemSetting

        db_key = (SystemSetting.get_val("GEMINI_API_KEY") or "").strip()
        if db_key:
            return db_key
    except Exception:
        pass
    return (_settings_attr("GEMINI_API_KEY") or "").strip()


def gemini_config_diagnostics() -> dict:
    """Non-secret summary for Admin → System Config."""
    db_key = ""
    try:
        from tracker.models import SystemSetting

        db_key = (SystemSetting.get_val("GEMINI_API_KEY") or "").strip()
    except Exception:
        pass
    env_key = (_settings_attr("GEMINI_API_KEY") or "").strip()
    active = resolve_gemini_api_key()
    if db_key:
        source = "admin_settings"
    elif env_key:
        source = "environment"
    else:
        source = "none"
    return {
        "source": source,
        "api_key_configured": bool(active),
        "admin_key_set": bool(db_key),
        "env_key_set": bool(env_key),
        "model_haiku": get_model_id("haiku"),
        "model_sonnet": get_model_id("sonnet"),
    }


def get_gemini_client():
    """Return a Gemini client, or None if the API key is missing."""
    api_key = resolve_gemini_api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — AI features are disabled.")
        return None
    try:
        from google import genai

        return genai.Client(api_key=api_key)
    except ImportError:
        logger.error("google-genai package not installed — run: pip install google-genai")
        return None


def ai_enabled() -> bool:
    return bool(resolve_gemini_api_key())


def get_model_id(tier: ModelTier = "haiku") -> str:
    default = _CURRENT_DEFAULTS[tier]
    if tier == "sonnet":
        raw = _settings_attr("GEMINI_MODEL_SONNET", default)
    else:
        raw = _settings_attr("GEMINI_MODEL_HAIKU", default)
    return (raw or default).strip()


def _api_error_message(exc: Exception) -> str:
    try:
        from google.genai import errors
    except ImportError:
        return str(exc)
    if isinstance(exc, errors.APIError):
        return f"Gemini API HTTP {exc.code}: {exc.message or str(exc)}"
    return str(exc)


def _extract_text(response) -> str:
    return (getattr(response, "text", None) or "").strip()


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _parse_json_text(text: str) -> Any:
    cleaned = _FENCE_RE.sub("", text.strip()).strip()
    return json.loads(cleaned)


def complete_text_with_error(
    *,
    system: str,
    user: str,
    tier: ModelTier = "haiku",
    max_tokens: int = 8192,
) -> tuple[str | None, str | None]:
    """Returns (text, error_message). On success error is None."""
    client = get_gemini_client()
    if client is None:
        return None, "GEMINI_API_KEY is not set"
    model = get_model_id(tier)

    try:
        from google.genai import types

        response = client.models.generate_content(
            model=model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
            ),
        )
        text = _extract_text(response)
        if not text:
            return None, f"Gemini returned empty content (model={model})"
        return text, None
    except Exception as exc:
        logger.exception("GEMINI_TEXT_FAIL | model=%s | %s", model, exc)
        return None, _api_error_message(exc)


def complete_text(
    *,
    system: str,
    user: str,
    tier: ModelTier = "haiku",
    max_tokens: int = 8192,
) -> str | None:
    """Single user turn; returns assistant text or None on failure."""
    text, _err = complete_text_with_error(
        system=system, user=user, tier=tier, max_tokens=max_tokens
    )
    return text


def complete_json_with_error(
    *,
    system: str,
    user: str,
    tier: ModelTier = "haiku",
    max_tokens: int = 8192,
) -> tuple[Any | None, str | None]:
    """Structured JSON response. Returns (data, error_message)."""
    sys = (
        f"{system.strip()}\n\n"
        "Respond with valid JSON only. No markdown code fences or commentary."
    )
    text, err = complete_text_with_error(system=sys, user=user, tier=tier, max_tokens=max_tokens)
    if err:
        return None, err
    try:
        return _parse_json_text(text), None
    except json.JSONDecodeError as exc:
        logger.error("GEMINI_JSON_PARSE_FAIL | %s | body=%r", exc, text[:500])
        return None, f"Gemini returned invalid JSON: {exc}"


def complete_json(
    *,
    system: str,
    user: str,
    tier: ModelTier = "haiku",
    max_tokens: int = 8192,
) -> dict | list | None:
    """Structured JSON response (object or array)."""
    data, _err = complete_json_with_error(
        system=system, user=user, tier=tier, max_tokens=max_tokens
    )
    return data


def complete_json_with_images(
    *,
    system: str,
    user_text: str,
    images: list[tuple[str, str]],
    tier: ModelTier = "sonnet",
    max_tokens: int = 8192,
) -> tuple[Any | None, str | None]:
    """Vision: images as list of (media_type, base64_data). Returns parsed JSON."""
    client = get_gemini_client()
    if client is None:
        return None, "GEMINI_API_KEY is not set"
    if not images:
        return None, "No images provided for vision extraction"

    try:
        from google.genai import types

        parts: list[types.Part] = []
        for media_type, b64 in images[:10]:
            parts.append(types.Part.from_bytes(data=base64.b64decode(b64), mime_type=media_type))
        parts.append(types.Part.from_text(text=user_text))

        sys = (
            f"{system.strip()}\n\n"
            "Respond with valid JSON only. No markdown code fences or commentary."
        )
        model = get_model_id(tier)
        response = client.models.generate_content(
            model=model,
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=sys,
                max_output_tokens=max_tokens,
            ),
        )
        text = _extract_text(response)
        if not text:
            return None, f"Gemini returned empty content (model={model})"
        return _parse_json_text(text), None
    except Exception as exc:
        logger.exception("GEMINI_VISION_FAIL | %s", exc)
        return None, _api_error_message(exc)


def complete_chat_with_error(
    *,
    system: str,
    messages: list[dict[str, str]],
    tier: ModelTier = "haiku",
    max_tokens: int = 4096,
) -> tuple[str | None, str | None]:
    """Multi-turn chat. messages: [{\"role\": \"user\"|\"assistant\", \"content\": \"...\"}, ...]."""
    client = get_gemini_client()
    if client is None:
        return None, "GEMINI_API_KEY is not set"
    model = get_model_id(tier)

    try:
        from google.genai import types

        contents = [
            types.Content(
                role="user" if m.get("role") == "user" else "model",
                parts=[types.Part.from_text(text=m.get("content", ""))],
            )
            for m in messages
        ]
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
            ),
        )
        text = _extract_text(response)
        if not text:
            return None, f"Gemini returned empty content (model={model})"
        return text, None
    except Exception as exc:
        logger.exception("GEMINI_CHAT_FAIL | model=%s | %s", model, exc)
        return None, _api_error_message(exc)
