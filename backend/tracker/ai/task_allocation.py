"""
AI task allocation — suggests which OPSC unit manager should action each
Commission decision that the rule-based router could not place.

One batched call per request: every unresolved decision plus the list of
eligible managers (with their current open-task load) goes in, and a
suggestion per decision comes out. The output is a *suggestion*: the
Secretariat accepts or changes it on the Allocation review screen, and
nothing is created until they do.
"""

from __future__ import annotations

import logging
from typing import Any

from ..models import CommissionActionUnit
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

MAX_ITEMS_PER_CALL = 25

SYSTEM = """You help the Secretariat of the Vanuatu Public Service Commission (OPSC)
allocate Commission decisions from signed minutes to the unit manager who must
action them.

For each decision choose:
1. The manager best placed to action it, judged by the manager's unit/role and the
   subject of the decision (form type, ministry, decision text).
2. Among managers of the same unit, prefer the one with fewer open tasks.
3. action_unit: one of the allowed unit codes.
4. due_days: realistic days to action it (7-180); urgent or time-bound decisions shorter.
5. confidence 0-100 and a one-sentence reason a busy Secretary can verify at a glance.

If you cannot tell who should action a decision, give a low confidence (below 50)
and say why. Never invent a manager: manager_id must come from the managers list.

Output valid JSON only:
{"suggestions": [
  {"index": 0, "manager_id": 12, "action_unit": "HRMU", "due_days": 30,
   "confidence": 85, "reason": "Appointment decision; HR Unit manager with the lightest load."}
]}"""

VALID_UNITS = {c.value for c in CommissionActionUnit}


def _sanitize(data: Any, managers: dict[int, dict], count: int) -> dict[int, dict]:
    out: dict[int, dict] = {}
    rows = data.get("suggestions") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            idx = int(row.get("index"))
            manager_id = int(row.get("manager_id"))
        except (TypeError, ValueError):
            continue
        if not (0 <= idx < count) or manager_id not in managers:
            continue
        try:
            confidence = max(0, min(100, int(row.get("confidence", 0))))
        except (TypeError, ValueError):
            confidence = 0
        try:
            due_days = max(7, min(180, int(row.get("due_days") or 30)))
        except (TypeError, ValueError):
            due_days = 30
        unit = str(row.get("action_unit") or "").strip()
        out[idx] = {
            "manager_id": manager_id,
            "action_unit": unit if unit in VALID_UNITS else "",
            "due_days": due_days,
            "confidence": confidence,
            "reason": str(row.get("reason") or "").strip()[:300],
        }
    return out


def suggest_allocations(
    items: list[dict], managers: list[dict]
) -> tuple[dict[int, dict] | None, str | None]:
    """items: [{title, decision, outcome, form_type, ministry}], managers:
    [{id, username, role, open_tasks}]. Returns ({item_index: suggestion}, error)."""
    if not ai_enabled():
        return None, "AI is not configured (no API key)."
    if not items:
        return {}, None
    if not managers:
        return None, "No eligible managers to allocate to."

    items = items[:MAX_ITEMS_PER_CALL]
    lines = ["Allowed action_unit codes: " + ", ".join(sorted(VALID_UNITS)), "", "Managers:"]
    for m in managers:
        lines.append(f'- id={m["id"]} username={m["username"]} role={m["role"]} open_tasks={m["open_tasks"]}')
    lines += ["", "Decisions to allocate:"]
    for i, it in enumerate(items):
        lines.append(
            f'[{i}] title={it["title"]!r} | outcome={it["outcome"] or "—"} | '
            f'form_type={it["form_type"] or "—"} | ministry={it["ministry"] or "—"}\n'
            f'    decision: {(it["decision"] or "")[:600]}'
        )

    tier = FEATURE_MODEL_TIER.get("task_allocation", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM, user="\n".join(lines), tier=tier, max_tokens=4096,
    )
    if data is None:
        return None, err or "Empty AI response."
    return _sanitize(data, {m["id"]: m for m in managers}, len(items)), None
