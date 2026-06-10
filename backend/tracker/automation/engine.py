"""Act engine — trigger → conditions → actions, reusing the Watch condition layer.

Safe actions only (notify / escalate / remind / comment / tag / shift due date /
create task). Stage transitions are intentionally NOT auto-applied here — they
stay human-in-loop. Every firing is logged immutably in ``AutomationRun``.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings as dj_settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

from tracker.rules.entities import _role_users, get_adapter
from tracker.rules.fields import build_q

logger = logging.getLogger(__name__)

ESCALATION_ROLES = {
    "submission": ["psc_manager", "senior_admin_officer", "psc_admin"],
    "commission_task": ["psc_manager", "senior_admin_officer"],
    "meeting": ["psc_secretary", "senior_admin_officer", "psc_admin"],
}


def _portal():
    try:
        from tracker.email_templates import get_frontend_base_url
        return (get_frontend_base_url() or "").rstrip("/")
    except Exception:  # noqa: BLE001
        return ""


def _system_user():
    from django.contrib.auth.models import User
    u, _ = User.objects.get_or_create(
        username="scdms_automation",
        defaults={"is_active": False, "first_name": "SCDMS", "last_name": "Automation"},
    )
    return u


# ── Action handlers ───────────────────────────────────────────────────────────

def _send_notify(automation, adapter, obj, users, message, simulate):
    from tracker.models import Notification

    users = list({u.id: u for u in users if u and u.is_active}.values())
    if not users:
        return {"recipients": 0, "skipped": "no recipients"}
    if simulate:
        return {"recipients": len(users), "simulated": True}

    desc = adapter.describe(obj)
    emails = []
    for u in users:
        Notification.objects.create(
            recipient=u, submission=(obj if adapter.key == "submission" else None),
            channel=Notification.Channel.IN_APP, title=f"Automation: {automation.name}",
            body=f"{desc['ref']} — {message}",
        )
        if (u.email or "").strip():
            emails.append(u.email.strip())
    if emails:
        try:
            base = _portal()
            link = f"{base}{desc['link']}" if base else ""
            cta = f"<p><a href='{escape(link)}'>Open in SCDMS</a></p>" if link else ""
            html = (
                "<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a'>"
                f"<h3 style='margin:0 0 6px'>{escape(automation.name)}</h3>"
                f"<p><strong>{escape(str(desc['ref']))}</strong> — {escape(str(desc['title']))}</p>"
                f"<p>{escape(message)}</p>{cta}</div>"
            )
            msg = EmailMultiAlternatives(subject=f"[SCDMS] {automation.name}"[:200], body=message,
                                         from_email=dj_settings.DEFAULT_FROM_EMAIL, to=emails)
            msg.attach_alternative(html, "text/html")
            msg.send(fail_silently=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Automation notify email failed: %s", exc)
    return {"recipients": len(users)}


def action_notify(automation, adapter, obj, params, *, simulate):
    users = list(_role_users(params.get("roles") or []))
    if params.get("to_assignee"):
        users += adapter.entity_users(automation, obj)
    return _send_notify(automation, adapter, obj, users, params.get("message") or "Attention required.", simulate)


def action_escalate(automation, adapter, obj, params, *, simulate):
    users = _role_users(ESCALATION_ROLES.get(adapter.key, []))
    return _send_notify(automation, adapter, obj, users, params.get("message") or "Escalated for attention.", simulate)


def action_remind(automation, adapter, obj, params, *, simulate):
    return _send_notify(automation, adapter, obj, adapter.entity_users(automation, obj),
                        params.get("message") or "Reminder: action pending.", simulate)


def action_comment(automation, adapter, obj, params, *, simulate):
    body = (params.get("body") or "").strip()
    if not body:
        return {"skipped": "no body"}
    if simulate:
        return {"simulated": True}
    from django.contrib.contenttypes.models import ContentType
    from tracker.models import Comment
    Comment.objects.create(
        content_type=ContentType.objects.get_for_model(obj), object_id=obj.pk,
        author=_system_user(), body=f"[Automation: {automation.name}] {body}", is_internal=True,
    )
    return {"commented": True}


def action_tag(automation, adapter, obj, params, *, simulate):
    tag = (params.get("tag") or "").strip()
    if not tag or not hasattr(obj, "tags"):
        return {"skipped": "no tag field"}
    if simulate:
        return {"simulated": True}
    tags = list(obj.tags or [])
    if tag.lower() not in [str(x).lower() for x in tags]:
        tags.append(tag)
        type(obj).objects.filter(pk=obj.pk).update(tags=tags)
    return {"tagged": tag}


def action_shift_due_date(automation, adapter, obj, params, *, simulate):
    try:
        days = int(params.get("days"))
    except (TypeError, ValueError):
        return {"skipped": "bad days"}
    if adapter.key == "commission_task":
        if not obj.due_date:
            return {"skipped": "no due_date"}
        if not simulate:
            type(obj).objects.filter(pk=obj.pk).update(due_date=obj.due_date + timedelta(days=days))
        return {"shifted_days": days}
    if adapter.key == "submission":
        if not obj.assessment_deadline_at:
            return {"skipped": "no deadline"}
        if not simulate:
            type(obj).objects.filter(pk=obj.pk).update(assessment_deadline_at=obj.assessment_deadline_at + timedelta(days=days))
        return {"shifted_days": days}
    return {"skipped": "n/a"}


def action_create_task(automation, adapter, obj, params, *, simulate):
    from tracker.models import CommissionTask
    role = params.get("manager_role")
    manager = next(iter(_role_users([role])), None) if role else None
    if manager is None:
        return {"skipped": "no manager for role"}
    title = (params.get("title") or f"Follow-up: {adapter.describe(obj)['ref']}")[:255]
    if simulate:
        return {"simulated": True, "title": title}
    kwargs = {"title": title, "assigned_manager": manager, "created_by": _system_user(), "status": "open"}
    if adapter.key == "submission":
        kwargs["submission"] = obj
    if adapter.key == "meeting":
        kwargs["meeting"] = obj
    return {"created_task": CommissionTask.objects.create(**kwargs).id}


ACTIONS = {
    "notify": action_notify, "escalate": action_escalate, "remind": action_remind,
    "comment": action_comment, "tag": action_tag, "shift_due_date": action_shift_due_date,
    "create_task": action_create_task,
}


def action_catalog(entity):
    items = [
        {"type": "notify", "label": "Notify", "params": [{"key": "roles", "kind": "roles"}, {"key": "to_assignee", "kind": "bool"}, {"key": "message", "kind": "text"}]},
        {"type": "escalate", "label": "Escalate", "params": [{"key": "message", "kind": "text"}]},
        {"type": "remind", "label": "Remind assignee", "params": [{"key": "message", "kind": "text"}]},
        {"type": "comment", "label": "Add comment", "params": [{"key": "body", "kind": "text"}]},
        {"type": "tag", "label": "Add tag", "params": [{"key": "tag", "kind": "text"}]},
    ]
    if entity in ("submission", "meeting"):
        items.append({"type": "create_task", "label": "Create task", "params": [{"key": "title", "kind": "text"}, {"key": "manager_role", "kind": "role"}]})
    if entity in ("submission", "commission_task"):
        items.append({"type": "shift_due_date", "label": "Shift due date", "params": [{"key": "days", "kind": "number"}]})
    return items


# ── Execution ─────────────────────────────────────────────────────────────────

def _matches(automation, adapter, obj, now):
    q = build_q(adapter.leaf, automation.conditions, automation.match, now)
    if q is None:
        return True  # no conditions → always act on trigger
    return adapter.base_qs().filter(q).filter(pk=obj.pk).exists()


def _in_cooldown(automation, adapter, obj, now):
    if not automation.cooldown_minutes:
        return False
    from tracker.models import AutomationRun
    cutoff = now - timedelta(minutes=automation.cooldown_minutes)
    return AutomationRun.objects.filter(
        automation=automation, created_at__gt=cutoff, **{adapter.flag_fk: obj}
    ).exists()


def _run_actions(automation, adapter, obj, trigger):
    from tracker.models import AutomationRun

    simulate = automation.test_mode
    results = []
    for action in automation.actions or []:
        atype = action.get("type")
        handler = ACTIONS.get(atype)
        if not handler:
            results.append({"type": atype, "ok": False, "error": "unknown action"})
            continue
        try:
            detail = handler(automation, adapter, obj, action.get("params") or {}, simulate=simulate) or {}
            results.append({"type": atype, "ok": True, **detail})
        except Exception as exc:  # noqa: BLE001
            results.append({"type": atype, "ok": False, "error": str(exc)[:200]})

    if simulate:
        st = AutomationRun.Status.SIMULATED
    elif results and all(not r["ok"] for r in results):
        st = AutomationRun.Status.FAILED
    else:
        st = AutomationRun.Status.RAN
    AutomationRun.objects.create(
        automation=automation, trigger=trigger, status=st,
        detail={"ref": adapter.describe(obj)["ref"], "actions": results},
        **{adapter.flag_fk: obj},
    )
    return results


def run_event(entity, obj, trigger):
    """Fire matching event-triggered automations for one entity object."""
    from tracker.models import Automation

    adapter = get_adapter(entity)
    if adapter is None:
        return
    now = timezone.now()
    for automation in Automation.objects.filter(is_active=True, entity=entity, trigger=trigger):
        try:
            if not _matches(automation, adapter, obj, now):
                continue
            if _in_cooldown(automation, adapter, obj, now):
                continue
            _run_actions(automation, adapter, obj, trigger)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Automation %s failed on %s: %s", automation.id, entity, exc)


def run_automation_now(automation, now=None):
    """Manually run one automation over its currently-matching entities (admin/test)."""
    now = now or timezone.now()
    adapter = get_adapter(automation.entity)
    if adapter is None:
        return {"matched": 0, "acted": 0}
    ids = adapter.matched_ids(automation, now)
    acted = 0
    for obj in adapter.base_qs().filter(id__in=ids):
        if _in_cooldown(automation, adapter, obj, now):
            continue
        _run_actions(automation, adapter, obj, "manual")
        acted += 1
    return {"matched": len(ids), "acted": acted}


def run_scheduled(now=None):
    """Hourly: run schedule-triggered automations over their matching entities."""
    from tracker.models import Automation

    now = now or timezone.now()
    summary = {"automations": 0, "acted": 0}
    for automation in Automation.objects.filter(is_active=True, trigger=Automation.Trigger.SCHEDULE):
        adapter = get_adapter(automation.entity)
        if adapter is None:
            continue
        summary["automations"] += 1
        ids = adapter.matched_ids(automation, now)
        for obj in adapter.base_qs().filter(id__in=ids):
            if _in_cooldown(automation, adapter, obj, now):
                continue
            _run_actions(automation, adapter, obj, "schedule")
            summary["acted"] += 1
    return summary
