"""
OpenAI Whisper API wrapper for meeting recording transcription.

Configure via OPENAI_API_KEY and optional WHISPER_MODEL (default whisper-1).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger("scdms.app")

# OpenAI Audio API upload limit (bytes)
WHISPER_MAX_BYTES = 25 * 1024 * 1024


def _settings_attr(name: str, default: str = "") -> str:
    try:
        from django.conf import settings

        return getattr(settings, name, None) or os.environ.get(name, default)
    except Exception:
        return os.environ.get(name, default)


def whisper_enabled() -> bool:
    return bool(_settings_attr("OPENAI_API_KEY"))


def get_openai_client():
    api_key = _settings_attr("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        return OpenAI(api_key=api_key)
    except ImportError:
        logger.error("openai package not installed — run: pip install openai")
        return None


def transcribe_audio_file(path: str) -> tuple[str | None, str | None]:
    """
    Transcribe a local audio file with Whisper.

    Returns (text, error_message). On success error is None.
    """
    file_path = Path(path)
    if not file_path.is_file():
        return None, f"Audio file not found: {path}"

    size = file_path.stat().st_size
    if size > WHISPER_MAX_BYTES:
        mb = size / (1024 * 1024)
        return None, (
            f"Recording is {mb:.1f} MB (limit 25 MB for Whisper). "
            "Compress or split the audio, then upload again."
        )

    client = get_openai_client()
    if client is None:
        return None, "OPENAI_API_KEY is not set — Whisper transcription is disabled."

    model = _settings_attr("WHISPER_MODEL", "whisper-1").strip() or "whisper-1"

    try:
        with open(file_path, "rb") as audio:
            result = client.audio.transcriptions.create(
                model=model,
                file=audio,
                response_format="verbose_json",
            )
    except Exception as exc:
        logger.exception("WHISPER_FAIL | path=%s | %s", path, exc)
        return None, str(exc)

    text = (getattr(result, "text", None) or "").strip()
    if not text:
        return None, "Whisper returned an empty transcript."

    return text, None
