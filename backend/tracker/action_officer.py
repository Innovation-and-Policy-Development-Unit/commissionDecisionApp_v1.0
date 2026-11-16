"""Read the Action Officer the Commission names in the minutes.

Every decision in the signed minutes ends with a line like
``Action Officer: Manager HRM`` (or ``Secretary, HRM, CIU``). That is the
Commission's own instruction about who acts, so allocation honours it before
falling back to the submission's routed unit or the AI.
"""

from __future__ import annotations

import re

# Words that name a unit → the unit's routed_unit key (see decision_allocation).
UNIT_WORDS = {
    "csu": "csu",
    "hrm": "hr", "hrmu": "hr", "hr": "hr",
    "ciu": "compliance", "compliance": "compliance",
    "vipam": "vipam", "hrdu": "vipam",
    "odu": "odu",
}

_WORD = re.compile(r"[a-z]+")
_IN_TEXT = re.compile(r"action\s+officers?\s*:\s*([^\n\r)]+)", re.IGNORECASE)


def parse_action_officer(text: str) -> list[str]:
    """Units named in an Action Officer string, in the order written, no repeats.

    ``"Secretary, HRM, CIU"`` → ``["hr", "compliance"]`` (Secretary has no unit
    manager, so it is skipped). Unknown words are ignored.
    """
    units: list[str] = []
    for word in _WORD.findall((text or "").lower()):
        unit = UNIT_WORDS.get(word)
        if unit and unit not in units:
            units.append(unit)
    return units


def officer_text_for_block(block: dict | None) -> str:
    """The Action Officer text for a minutes block: the intake field, else the
    ``Action Officer:`` line inside the decision text, else the named
    responsible parties of its action items."""
    if not block:
        return ""
    direct = (block.get("action_officer") or "").strip()
    if direct:
        return direct
    hit = _IN_TEXT.search(block.get("decision") or "")
    if hit:
        return hit.group(1).strip()
    return ", ".join(
        str(a.get("responsible") or "").strip()
        for a in (block.get("action_items") or [])
        if isinstance(a, dict) and a.get("responsible")
    )
