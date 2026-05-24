"""
D1 RAG — chunk PSC staff knowledge + form instructions for Staff Chat retrieval.
Simple token-overlap search (no vector DB required).
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from django.conf import settings

from .staff_chat import _knowledge_path, load_knowledge_base

_CHUNK_SIZE = 900
_CHUNK_OVERLAP = 120
_MAX_CHUNKS = 400


def _split_markdown(text: str) -> list[dict]:
    chunks: list[dict] = []
    parts = re.split(r"(?=\n#{1,3}\s)", text)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        heading = ""
        m = re.match(r"^(#{1,3})\s+(.+)", part)
        if m:
            heading = m.group(2).strip()
        start = 0
        while start < len(part):
            piece = part[start : start + _CHUNK_SIZE]
            if piece.strip():
                chunks.append({"heading": heading, "content": piece.strip()})
            start += _CHUNK_SIZE - _CHUNK_OVERLAP
        if len(chunks) >= _MAX_CHUNKS:
            break
    return chunks


@lru_cache(maxsize=1)
def load_knowledge_chunks() -> tuple[dict, ...]:
    text = load_knowledge_base()
    forms_dir = Path(settings.BASE_DIR).resolve().parent / "docs"
    extra_paths = [
        forms_dir / "psc_staff_knowledge.md",
        Path(__file__).resolve().parent / "psc_staff_knowledge.md",
    ]
    for p in extra_paths:
        if p.is_file() and str(p) not in text[:200]:
            try:
                text += "\n\n" + p.read_text(encoding="utf-8")[:12000]
            except OSError:
                pass
    return tuple(_split_markdown(text))


def _score_chunk(query: str, chunk: dict) -> float:
    q_tokens = set(re.findall(r"[a-z0-9]{3,}", query.lower()))
    if not q_tokens:
        return 0.0
    body = (chunk.get("heading", "") + " " + chunk.get("content", "")).lower()
    c_tokens = set(re.findall(r"[a-z0-9]{3,}", body))
    if not c_tokens:
        return 0.0
    return len(q_tokens & c_tokens) / len(q_tokens)


def retrieve_knowledge(query: str, *, top_k: int = 5) -> list[dict]:
    chunks = load_knowledge_chunks()
    scored = sorted(
        (( _score_chunk(query, c), c) for c in chunks),
        key=lambda x: x[0],
        reverse=True,
    )
    out = []
    for score, chunk in scored[:top_k]:
        if score <= 0:
            break
        out.append({
            "heading": chunk.get("heading", ""),
            "content": chunk.get("content", ""),
            "score": round(score, 3),
        })
    return out


def format_retrieved_context(query: str, *, top_k: int = 5) -> str:
    hits = retrieve_knowledge(query, top_k=top_k)
    if not hits:
        return "(No matching knowledge sections — using general KB excerpt.)\n" + load_knowledge_base()[:4000]
    lines = ["Retrieved PSC knowledge (cite these sections when relevant):"]
    for i, h in enumerate(hits, 1):
        title = h.get("heading") or f"Section {i}"
        lines.append(f"\n### [{i}] {title}\n{h['content']}")
    return "\n".join(lines)
