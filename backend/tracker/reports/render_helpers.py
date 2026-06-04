"""
Pure-Python render helpers for the Smart Report Quarto document.

This module is **copied into the render work_dir** and imported by `report.qmd`
(`import render_helpers`). It must therefore stay dependency-free (stdlib only) and
must NOT import Django — it only turns a validated spec + resolved aggregates into HTML
strings.

Charts use Highcharts when a real bundle is present; otherwise they degrade gracefully
to static HTML tables so a report always renders.
"""

from __future__ import annotations

import html
import json
import uuid
from typing import Any

HIGHCHARTS_COLORS = ["#003876", "#0078d4", "#107c10", "#d13438", "#f59e0b", "#5c2d91", "#06b6d4"]


def _esc(val: Any) -> str:
    return html.escape("" if val is None else str(val))


def highcharts_available(highcharts_js: str) -> bool:
    return bool(highcharts_js) and "PLACEHOLDER" not in highcharts_js and len(highcharts_js) > 2000


# ── KPIs ─────────────────────────────────────────────────────────────────────
def render_kpis(spec: dict[str, Any], agg: dict[str, Any]) -> str:
    kpis = spec.get("kpis") or []
    if not kpis:
        return ""
    cards = []
    for k in kpis:
        source = k.get("source")
        if source not in agg:
            continue
        value = agg.get(source, 0)
        cards.append(
            f'<div class="kpi-card"><div class="kpi-value">{_esc(value)}</div>'
            f'<div class="kpi-label">{_esc(k.get("label") or source)}</div></div>'
        )
    if not cards:
        return ""
    return f'<div class="kpi-grid">{"".join(cards)}</div>'


# ── Charts ───────────────────────────────────────────────────────────────────
def _series(agg: dict[str, Any], source: str) -> list[dict[str, Any]]:
    data = agg.get(source) or []
    return [d for d in data if isinstance(d, dict) and "name" in d and "value" in d]


def _highcharts_config(chart: dict[str, Any], series: list[dict[str, Any]]) -> dict[str, Any]:
    ctype = chart.get("type", "bar")
    title = chart.get("title", "")
    if ctype == "pie":
        return {
            "chart": {"type": "pie"},
            "title": {"text": title},
            "colors": HIGHCHARTS_COLORS,
            "credits": {"enabled": False},
            "series": [{"name": title or "Value",
                        "data": [{"name": d["name"], "y": d["value"]} for d in series]}],
        }
    categories = [d["name"] for d in series]
    values = [d["value"] for d in series]
    return {
        "chart": {"type": ctype},
        "title": {"text": title},
        "colors": HIGHCHARTS_COLORS,
        "credits": {"enabled": False},
        "legend": {"enabled": False},
        "xAxis": {"categories": categories, "labels": {"style": {"fontSize": "11px"}}},
        "yAxis": {"title": {"text": None}, "allowDecimals": False},
        "series": [{"name": title or "Value", "data": values}],
    }


def _fallback_table(chart: dict[str, Any], series: list[dict[str, Any]]) -> str:
    rows = "".join(
        f"<tr><td>{_esc(d['name'])}</td><td style='text-align:right'>{_esc(d['value'])}</td></tr>"
        for d in series
    )
    return (
        f'<div class="chart-block"><h3>{_esc(chart.get("title", ""))}</h3>'
        f'<table class="table chart-fallback"><thead><tr><th>Category</th>'
        f'<th style="text-align:right">Count</th></tr></thead><tbody>{rows}</tbody></table></div>'
    )


def render_highcharts(spec: dict[str, Any], agg: dict[str, Any], highcharts_js: str) -> str:
    charts = spec.get("charts") or []
    if not charts:
        return ""

    use_hc = highcharts_available(highcharts_js)
    blocks: list[str] = []

    if use_hc:
        # Inject the library once.
        blocks.append(f"<script>{highcharts_js}</script>")

    for chart in charts:
        series = _series(agg, chart.get("source", ""))
        if not series:
            continue
        if not use_hc:
            blocks.append(_fallback_table(chart, series))
            continue
        div_id = "hc_" + uuid.uuid4().hex[:10]
        config = _highcharts_config(chart, series)
        blocks.append(
            f'<div class="chart-block"><div id="{div_id}" class="hc-container"></div>'
            f"<script>Highcharts.chart('{div_id}', {json.dumps(config)});</script></div>"
        )

    if not blocks:
        return ""
    return f'<div class="charts">{"".join(blocks)}</div>'


# ── Table ────────────────────────────────────────────────────────────────────
COLUMN_LABELS = {
    "reference_number": "Reference",
    "title": "Title",
    "ministry": "Ministry",
    "department": "Department",
    "category": "Category",
    "stage": "Stage",
    "created": "Created",
    "turnaround_days": "Turnaround (days)",
    "status": "Status",
}


def render_table(rows: list[dict[str, Any]], columns: list[str]) -> str:
    if not rows:
        return "<p><em>No records match this report.</em></p>"
    head = "".join(f"<th>{_esc(COLUMN_LABELS.get(c, c))}</th>" for c in columns)
    body = []
    for r in rows:
        cells = "".join(f"<td>{_esc(r.get(c, ''))}</td>" for c in columns)
        body.append(f"<tr>{cells}</tr>")
    return (
        f'<table class="table data-table"><thead><tr>{head}</tr></thead>'
        f'<tbody>{"".join(body)}</tbody></table>'
    )


REPORT_CSS = """
<style>
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
  gap:14px; margin:18px 0; }
.kpi-card { border:1px solid #e2e8f0; border-radius:12px; padding:16px 18px; background:#fff; }
.kpi-value { font-size:28px; font-weight:700; color:#003876; line-height:1.1; }
.kpi-label { font-size:12px; text-transform:uppercase; letter-spacing:.04em;
  color:#64748b; margin-top:6px; }
.charts { display:grid; gap:22px; margin:18px 0; }
.chart-block { border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; background:#fff; }
.hc-container { width:100%; height:360px; }
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table th, .data-table td { border-bottom:1px solid #e2e8f0; padding:6px 8px; text-align:left; }
.data-table thead th { background:#f8fafc; }
.chart-fallback { max-width:480px; }
</style>
"""
