"""
Natural-language → query_spec for SCDMS Intelligence.

Claude maps a prompt to a query specification drawn from the dataset's declared
dimensions/metrics. It never returns code — only a JSON spec the executor then
re-validates against the same whitelist.
"""

from __future__ import annotations

import json
from typing import Any

from ..ai.claude_client import ai_enabled, complete_json_with_error
from .datasets import get_dataset
from .query import CHART_TYPES, TIME_GRAINS

SYSTEM = """You are the analyst for the Public Service Commission of Vanuatu (SCDMS).
Convert the user's request into a chart QUERY SPECIFICATION as JSON only. You do not
write code or SQL — you only choose from the dimensions, time dimensions, and metrics
provided in the user message.

Rules:
- "x" is the main axis: either {"dimension": <category_dim>} or
  {"dimension": <time_dim>, "time_grain": one of day|week|month|quarter|year}.
- "dimensions" is an optional list with ONE breakdown (series) category dimension.
- "metrics" is a list like [{"key": "count"}] using only the provided metric keys.
- "filters" optional: [{"col": <dim>, "op": one of =,!=,in,contains,gte,lte, "val": ...}].
- "chart_type": one of bar, column, line, area, pie, table, number.
  Prefer line/area for time, bar/column for categories, pie for share, number for a
  single total.
- Keep it minimal and answerable from the listed fields.

Output schema:
{
  "x": {"dimension": "...", "time_grain": "month"},
  "dimensions": [],
  "metrics": [{"key": "count"}],
  "filters": [],
  "chart_type": "bar",
  "sort": {"by": "count", "dir": "desc"},
  "row_limit": 1000
}"""


def interpret_query(*, user_prompt: str, dataset_key: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return (query_spec, error_message). The executor re-validates the spec."""
    if not ai_enabled():
        return None, "AI is not configured (GEMINI_API_KEY missing)."
    prompt = (user_prompt or "").strip()
    if not prompt:
        return None, "Ask a question to explore."
    ds = get_dataset(dataset_key)
    if not ds:
        return None, f"Unknown dataset '{dataset_key}'."

    user_msg = json.dumps(
        {
            "request": prompt,
            "dataset": ds.key,
            "dimensions": [d.to_dict() for d in ds.dimensions()],
            "time_dimensions": [d.to_dict() for d in ds.time_dimensions()],
            "metrics": [m.to_dict() for m in ds.metrics()],
            "chart_types": sorted(CHART_TYPES),
            "time_grains": sorted(TIME_GRAINS),
        },
        indent=2,
        default=str,
    )

    data, err = complete_json_with_error(system=SYSTEM, user=user_msg, tier="sonnet", max_tokens=2048)
    if not data:
        return None, err or "Could not interpret the question."
    if not isinstance(data, dict):
        return None, "AI returned an invalid query specification."

    # Light shaping; the executor enforces the real whitelist.
    if data.get("chart_type") not in CHART_TYPES:
        data["chart_type"] = "bar"
    return data, None
