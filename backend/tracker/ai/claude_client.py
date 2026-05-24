"""
Anthropic Claude API wrapper for CDP/CMS AI features.

Replaces the previous Google Gemini integration. Configure via:
  ANTHROPIC_API_KEY
  CLAUDE_MODEL_HAIKU  — fast / high-volume (checklist, feedback, classification)
  CLAUDE_MODEL_SONNET — reasoning / drafting (briefs, minutes, similarity)
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal

logger = logging.getLogger("scdms.app")

ModelTier = Literal["haiku", "sonnet"]

# Map retired / legacy .env model IDs to IDs that work on the Anthropic API today.
_MODEL_FALLBACKS: dict[str, str] = {
    "claude-sonnet-4-20250514": "claude-sonnet-4-6",
    "claude-sonnet-4-0": "claude-sonnet-4-6",
    "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
    "claude-3-5-sonnet-20240620": "claude-sonnet-4-6",
    "claude-opus-4-20250514": "claude-opus-4-7",
    "claude-opus-4-0": "claude-opus-4-7",
    "claude-3-5-haiku-20241022": "claude-haiku-4-5-20251001",
}

_CURRENT_DEFAULTS: dict[ModelTier, str] = {
    "sonnet": "claude-sonnet-4-6",
    "haiku": "claude-haiku-4-5-20251001",
}


def _settings_attr(name: str, default: str = "") -> str:
    try:
        from django.conf import settings

        return getattr(settings, name, None) or os.environ.get(name, default)
    except Exception:
        return os.environ.get(name, default)


def get_anthropic_client():
    """Return an Anthropic client, or None if the API key is missing."""
    api_key = _settings_attr("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — AI features are disabled.")
        return None
    try:
        from anthropic import Anthropic

        return Anthropic(api_key=api_key)
    except ImportError:
        logger.error("anthropic package not installed — run: pip install anthropic")
        return None


def ai_enabled() -> bool:
    return bool(_settings_attr("ANTHROPIC_API_KEY"))


def get_model_id(tier: ModelTier = "haiku") -> str:
    """Resolved model ID (applies fallbacks for retired IDs in .env)."""
    default = _CURRENT_DEFAULTS[tier]
    if tier == "sonnet":
        raw = _settings_attr("CLAUDE_MODEL_SONNET", default)
    else:
        raw = _settings_attr("CLAUDE_MODEL_HAIKU", default)
    raw = (raw or default).strip()
    resolved = _MODEL_FALLBACKS.get(raw, raw)
    if resolved != raw:
        logger.warning(
            "Claude model %s is retired or unavailable; using %s instead. "
            "Update CLAUDE_MODEL_%s in .env.",
            raw,
            resolved,
            "SONNET" if tier == "sonnet" else "HAIKU",
        )
    return resolved


def _is_model_not_found(exc: Exception) -> bool:
    try:
        from anthropic import NotFoundError
    except ImportError:
        return "not_found" in str(exc).lower() or "404" in str(exc)
    return isinstance(exc, NotFoundError)


def _api_error_message(exc: Exception) -> str:
    try:
        from anthropic import APIConnectionError, APIStatusError
    except ImportError:
        return str(exc)
    if isinstance(exc, APIConnectionError):
        return f"Cannot reach Anthropic API: {exc}"
    if isinstance(exc, APIStatusError):
        detail = ""
        body = getattr(exc, "body", None)
        if isinstance(body, dict):
            err = body.get("error")
            if isinstance(err, dict):
                detail = err.get("message") or ""
        return f"Anthropic API HTTP {exc.status_code}: {detail or str(exc)}"
    return str(exc)


def _extract_text(response) -> str:
    parts = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts).strip()


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
    client = get_anthropic_client()
    if client is None:
        return None, "ANTHROPIC_API_KEY is not set"
    model = get_model_id(tier)
    fallback = _CURRENT_DEFAULTS[tier]
    models_to_try = [model]
    if fallback not in models_to_try:
        models_to_try.append(fallback)

    last_exc: Exception | None = None
    for attempt_model in models_to_try:
        try:
            response = client.messages.create(
                model=attempt_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = _extract_text(response)
            if not text:
                return None, f"Claude returned empty content (model={attempt_model})"
            return text, None
        except Exception as exc:
            last_exc = exc
            if _is_model_not_found(exc) and attempt_model != fallback:
                logger.warning(
                    "CLAUDE_TEXT_RETRY | model=%s not found, retrying with %s",
                    attempt_model,
                    fallback,
                )
                continue
            logger.exception("CLAUDE_TEXT_FAIL | model=%s | %s", attempt_model, exc)
            return None, _api_error_message(exc)
    if last_exc:
        return None, _api_error_message(last_exc)
    return None, "Claude request failed"


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
        logger.error("CLAUDE_JSON_PARSE_FAIL | %s | body=%r", exc, text[:500])
        return None, f"Claude returned invalid JSON: {exc}"


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
    client = get_anthropic_client()
    if client is None:
        return None, "ANTHROPIC_API_KEY is not set"
    if not images:
        return None, "No images provided for vision extraction"

    content: list[dict] = []
    for media_type, b64 in images[:10]:
        content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            }
        )
    content.append({"type": "text", "text": user_text})

    sys = (
        f"{system.strip()}\n\n"
        "Respond with valid JSON only. No markdown code fences or commentary."
    )
    model = get_model_id(tier)
    fallback = _CURRENT_DEFAULTS[tier]
    models_to_try = [model]
    if fallback not in models_to_try:
        models_to_try.append(fallback)

    last_exc: Exception | None = None
    for attempt_model in models_to_try:
        try:
            response = client.messages.create(
                model=attempt_model,
                max_tokens=max_tokens,
                system=sys,
                messages=[{"role": "user", "content": content}],
            )
            text = _extract_text(response)
            if not text:
                return None, f"Claude returned empty content (model={attempt_model})"
            return _parse_json_text(text), None
        except Exception as exc:
            last_exc = exc
            if _is_model_not_found(exc) and attempt_model != fallback:
                logger.warning(
                    "CLAUDE_VISION_RETRY | model=%s not found, retrying with %s",
                    attempt_model,
                    fallback,
                )
                continue
            logger.exception("CLAUDE_VISION_FAIL | model=%s | %s", attempt_model, exc)
            return None, _api_error_message(exc)
    if last_exc:
        return None, _api_error_message(last_exc)
    return None, "Claude vision request failed"


def complete_chat_with_error(
    *,
    system: str,
    messages: list[dict[str, str]],
    tier: ModelTier = "haiku",
    max_tokens: int = 4096,
) -> tuple[str | None, str | None]:
    """Multi-turn chat. messages: [{\"role\": \"user\"|\"assistant\", \"content\": \"...\"}, ...]."""
    client = get_anthropic_client()
    if client is None:
        return None, "ANTHROPIC_API_KEY is not set"
    model = get_model_id(tier)
    fallback = _CURRENT_DEFAULTS[tier]
    models_to_try = [model]
    if fallback not in models_to_try:
        models_to_try.append(fallback)

    last_exc: Exception | None = None
    for attempt_model in models_to_try:
        try:
            response = client.messages.create(
                model=attempt_model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            text = _extract_text(response)
            if not text:
                return None, f"Claude returned empty content (model={attempt_model})"
            return text, None
        except Exception as exc:
            last_exc = exc
            if _is_model_not_found(exc) and attempt_model != fallback:
                logger.warning(
                    "CLAUDE_CHAT_RETRY | model=%s not found, retrying with %s",
                    attempt_model,
                    fallback,
                )
                continue
            logger.exception("CLAUDE_CHAT_FAIL | model=%s | %s", attempt_model, exc)
            return None, _api_error_message(exc)
    if last_exc:
        return None, _api_error_message(last_exc)
    return None, "Claude request failed"
