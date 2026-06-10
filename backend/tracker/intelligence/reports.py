"""Scheduled SCDMS Intelligence reports & threshold alerts.

An hourly Celery-beat tick (``run_intelligence_reports_task``) calls
``run_due_reports``; each active report whose schedule matches the current
Pacific/Efate hour (and hasn't run today) is executed *as its owner* — so the
ministry firewall / RBAC scoping applies — and emailed. Alerts only email when
their metric crosses the configured threshold.
"""

from __future__ import annotations

import base64
import json
import logging
from urllib.parse import quote, urlencode

from django.conf import settings as dj_settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

from .query import execute_query

logger = logging.getLogger(__name__)

PERIODIC_NAME = "intelligence-reports"
TASK_NAME = "tracker.tasks.run_intelligence_reports_task"

_OPS = {
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
}
_OP_LABEL = {"gt": ">", "gte": "≥", "lt": "<", "lte": "≤"}


# ── Scheduling ────────────────────────────────────────────────────────────────

def sync_intelligence_reports_scheduler() -> None:
    """Ensure the hourly beat tick exists (cheap; the task no-ops when nothing is due)."""
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        cron, _ = CrontabSchedule.objects.get_or_create(
            minute="0", hour="*", day_of_month="*", month_of_year="*", day_of_week="*",
            timezone="Pacific/Efate",
        )
        PeriodicTask.objects.update_or_create(
            name=PERIODIC_NAME,
            defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
        logger.info("Intelligence reports schedule synced to Celery beat (hourly)")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to sync intelligence reports schedule: %s", exc)


def report_is_due(report, now=None) -> bool:
    from tracker.models import IntelligenceReport

    now = now or timezone.localtime()
    if not report.is_active:
        return False
    if int(report.hour) != now.hour:
        return False
    if report.frequency == IntelligenceReport.Frequency.WEEKLY and int(report.day_of_week) != now.weekday():
        return False
    if report.frequency == IntelligenceReport.Frequency.MONTHLY and int(report.day_of_month or 1) != now.day:
        return False
    # Don't re-send within the same local day.
    if report.last_run_at and timezone.localtime(report.last_run_at).date() == now.date():
        return False
    return True


# ── Evaluation + rendering ────────────────────────────────────────────────────

def metric_total(result, metric_key) -> float | None:
    """Sum a numeric metric across result rows (a single big-number row → its value)."""
    total, found = 0.0, False
    for r in result.get("rows") or []:
        v = r.get(metric_key)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            total += float(v)
            found = True
    return total if found else None


def _frontend_link(report) -> str:
    """Deep link that restores this query in the explorer (matches the JS share URL)."""
    try:
        from tracker.email_templates import get_frontend_base_url

        base = (get_frontend_base_url() or "").rstrip("/")
        if not base:
            return ""
        b64 = base64.b64encode(json.dumps(report.spec).encode("utf-8")).decode("ascii")
        return f"{base}/intelligence?{urlencode({'ds': report.dataset, 'q': quote(b64, safe='')})}"
    except Exception:  # noqa: BLE001
        return ""


def _results_table_html(result) -> str:
    cols = result.get("columns") or []
    rows = result.get("rows") or []
    if not cols or not rows:
        return "<p style='color:#64748b'>No data for this query.</p>"
    head = "".join(
        f"<th style='text-align:left;padding:6px 10px;border-bottom:2px solid #e2e8f0;"
        f"font-size:12px;color:#475569'>{escape(c.get('label', ''))}</th>"
        for c in cols
    )
    body = ""
    for r in rows[:100]:
        tds = "".join(
            f"<td style='padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a'>"
            f"{'' if r.get(c['key']) is None else escape(str(r.get(c['key'])))}</td>"
            for c in cols
        )
        body += f"<tr>{tds}</tr>"
    extra = "" if len(rows) <= 100 else f"<p style='color:#94a3b8;font-size:11px'>Showing first 100 of {len(rows)} rows.</p>"
    return (
        "<table style='border-collapse:collapse;width:100%'>"
        f"<thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>{extra}"
    )


def _send(subject, html, recipients) -> bool:
    recipients = [e for e in (recipients or []) if isinstance(e, str) and "@" in e]
    if not recipients:
        return False
    try:
        msg = EmailMultiAlternatives(
            subject=subject[:200],
            body="Open SCDMS Intelligence to view this report.",
            from_email=dj_settings.DEFAULT_FROM_EMAIL,
            to=recipients,
        )
        msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Intelligence report email failed: %s", exc)
        return False


# ── Execution ─────────────────────────────────────────────────────────────────

def run_report(report, *, force: bool = False) -> dict:
    """Run one report: execute the query, evaluate any alert, email if due, log status."""
    from tracker.models import IntelligenceReport

    S = IntelligenceReport.Status
    now = timezone.now()

    try:
        result = execute_query(user=report.owner, dataset_key=report.dataset, spec=report.spec)
    except Exception as exc:  # noqa: BLE001
        report.last_run_at = now
        report.last_status = S.FAILED
        report.last_error = str(exc)[:500]
        report.save(update_fields=["last_run_at", "last_status", "last_error"])
        return {"status": "failed", "error": str(exc)}

    is_alert = report.kind == IntelligenceReport.Kind.ALERT
    value, triggered = None, True
    if is_alert:
        value = metric_total(result, report.alert_metric)
        op = _OPS.get(report.alert_operator)
        triggered = bool(value is not None and op and report.alert_threshold is not None
                         and op(value, report.alert_threshold))

    report.last_run_at = now
    report.last_value = value
    report.last_error = ""

    # Alerts that didn't trigger: record the check, send nothing (unless forced/test).
    if is_alert and not triggered and not force:
        report.last_status = S.OK
        report.save(update_fields=["last_run_at", "last_value", "last_status", "last_error"])
        return {"status": "ok", "value": value}

    link = _frontend_link(report)
    alert_line = ""
    if is_alert:
        cols = result.get("columns") or []
        metric_label = next((c["label"] for c in cols if c.get("key") == report.alert_metric), report.alert_metric)
        opl = _OP_LABEL.get(report.alert_operator, report.alert_operator)
        state = "TRIGGERED" if triggered else "not triggered (test)"
        alert_line = (
            f"<p style='font-size:14px'><strong>Alert {state}:</strong> "
            f"{escape(str(metric_label))} = <strong>{value}</strong> "
            f"(threshold {opl} {report.alert_threshold})</p>"
        )
    subject = f"⚠ Alert: {report.name}" if (is_alert and triggered) else f"SCDMS report: {report.name}"
    cta = (
        f"<p style='margin-top:16px'><a href='{escape(link)}' style='background:#003b66;color:#fff;"
        f"padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px'>Open in SCDMS Intelligence</a></p>"
        if link else ""
    )
    html = (
        "<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:680px'>"
        f"<h2 style='margin:0 0 4px'>{escape(report.name)}</h2>"
        f"<p style='color:#64748b;font-size:12px;margin:0 0 16px'>SCDMS Intelligence · "
        f"{timezone.localtime(now).strftime('%d %b %Y %H:%M')}</p>"
        f"{alert_line}{_results_table_html(result)}{cta}</div>"
    )

    ok = _send(subject, html, report.recipients)
    if ok:
        report.last_status = S.TRIGGERED if (is_alert and triggered) else S.SENT
    else:
        report.last_status = S.FAILED
        report.last_error = "Email send failed (no valid recipients or SMTP error)."
    report.save(update_fields=["last_run_at", "last_value", "last_status", "last_error"])
    return {"status": report.last_status, "value": value, "sent": ok}


def run_due_reports() -> dict:
    from tracker.models import IntelligenceReport

    now = timezone.localtime()
    qs = IntelligenceReport.objects.filter(is_active=True).select_related("owner")
    ran = 0
    for report in qs:
        if report_is_due(report, now):
            run_report(report)
            ran += 1
    return {"checked": qs.count(), "ran": ran}
