"""Flatten / unflatten i18next JSON and load bundled locale files."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.conf import settings

SUPPORTED_LANGS = ("en", "fr", "bi")


def locale_files_dir() -> Path:
    """Frontend locale JSON shipped with the repo."""
    return Path(settings.BASE_DIR).parent / "frontend" / "src" / "i18n" / "locales"


def load_bundled_locale_files() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    base = locale_files_dir()
    for lang in SUPPORTED_LANGS:
        path = base / f"{lang}.json"
        if path.is_file():
            with path.open(encoding="utf-8") as fh:
                out[lang] = json.load(fh)
        else:
            out[lang] = {}
    return out


def flatten_translation_tree(tree: dict[str, Any], parent: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in tree.items():
        full = f"{parent}.{key}" if parent else key
        if isinstance(value, dict):
            flat.update(flatten_translation_tree(value, full))
        else:
            flat[full] = "" if value is None else str(value)
    return flat


def unflatten_translation_tree(flat: dict[str, str]) -> dict[str, Any]:
    tree: dict[str, Any] = {}
    for dotted, value in flat.items():
        parts = dotted.split(".")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = value
    return tree


def namespace_from_key(key: str) -> str:
    if "." in key:
        return key.split(".", 1)[0]
    return "general"


def merge_bundles(
    base_by_lang: dict[str, dict[str, Any]],
    overrides: list[tuple[str, str, str, str]],
) -> dict[str, dict[str, Any]]:
    """
    overrides: list of (key, text_en, text_fr, text_bi) from DB.
    DB values win when non-empty for that language.
    """
    flat_en = flatten_translation_tree(base_by_lang.get("en") or {})
    flat_fr = flatten_translation_tree(base_by_lang.get("fr") or {})
    flat_bi = flatten_translation_tree(base_by_lang.get("bi") or {})

    for key, en, fr, bi in overrides:
        if en:
            flat_en[key] = en
        if fr:
            flat_fr[key] = fr
        if bi:
            flat_bi[key] = bi
        if key not in flat_en and en:
            flat_en[key] = en
        if key not in flat_fr and fr:
            flat_fr[key] = fr
        if key not in flat_bi and bi:
            flat_bi[key] = bi

    return {
        "en": unflatten_translation_tree(flat_en),
        "fr": unflatten_translation_tree(flat_fr),
        "bi": unflatten_translation_tree(flat_bi),
    }
