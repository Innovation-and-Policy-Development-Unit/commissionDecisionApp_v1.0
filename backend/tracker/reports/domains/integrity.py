"""
Integrity & access attestation domain for the Smart Report engine.

A recurring assurance snapshot for the Chairperson / Secretary / IPDU: is the audit
trail still tamper-evident, who holds privileged access (and do they use two-factor),
and what security-relevant events occurred in the period. It reports facts the system
already records; it does not change any of them.

Restricted to a small set of roles because it lists privileged accounts.
"""

from __future__ import annotations

from collections import Counter
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from tracker.audit_integrity import verify_audit_chain
from tracker.models import AuditLog, Profile, Role, RoleDefinition

from ._common import period_bounds
from .base import ResolvedDataset, register_resolver

DEFAULT_WINDOW_DAYS = 30
DORMANT_DAYS = 90

ALLOWED_ROLES = frozenset({
    Role.PSC_ADMIN, Role.CHAIRPERSON, Role.PSC_SECRETARY, Role.IPDU_MANAGER,
})

_A = AuditLog.Action
SECURITY_ACTIONS = [
    _A.LOGIN_FAILED, _A.LOCKOUT, _A.UNLOCK, _A.PASSWORD_CHANGE,
    _A.PERMISSION, _A.SETTINGS, _A.BACKUP, _A.RESTORE, _A.EXPORT,
]
_ACTION_LABELS = dict(AuditLog.Action.choices)


def _date_str(moment) -> str:
    return timezone.localtime(moment).strftime("%Y-%m-%d") if moment else "Never"


class IntegrityAttestationResolver:
    key = "integrity"

    vocab = {
        "kpi_labels": {
            "audit_chain_status": "Audit log chain",
            "audit_rows_checked": "Audit rows verified",
            "audit_chain_breaks": "Chain breaks found",
            "privileged_accounts": "Privileged accounts",
            "privileged_without_2fa": "Privileged without 2FA",
            "two_factor_coverage_pct": "Privileged 2FA coverage (%)",
            "accounts_total": "Active accounts",
            "dormant_accounts": "Dormant accounts (90 days)",
            "hard_locked_accounts": "Hard-locked accounts",
            "failed_logins": "Failed sign-ins",
            "lockouts": "Account lockouts",
            "permission_changes": "Permission changes",
            "restores": "Database restores",
        },
        "list_sources": {"security_events", "security_events_by_day", "privileged_by_reason"},
        "table_columns": [
            "username", "full_name", "role", "privilege", "two_factor", "last_login", "status",
        ],
        "column_labels": {
            "username": "Username",
            "full_name": "Name",
            "role": "Role",
            "privilege": "Why privileged",
            "two_factor": "2FA enabled",
            "last_login": "Last sign-in",
            "status": "Status",
        },
        "default_table_columns": ["username", "full_name", "role", "privilege", "two_factor", "last_login"],
        "default_kpis": ["audit_chain_status", "privileged_accounts", "two_factor_coverage_pct"],
        "default_charts": [("security_events", "bar", "Security events in period")],
    }

    def param_schema(self) -> dict[str, str]:
        return {"date_from": "date", "date_to": "date"}

    def authorize(self, user) -> bool:
        if not getattr(user, "is_authenticated", False):
            return False
        if user.is_superuser or user.is_staff:
            return True
        try:
            return user.psc_profile.role in ALLOWED_ROLES
        except Exception:
            return False

    def resolve(self, *, user, params: dict[str, Any]) -> ResolvedDataset:
        if not self.authorize(user):
            raise PermissionDenied("The integrity attestation is restricted to administrators and PSC leadership.")

        now = timezone.now()
        start, end = period_bounds(params)
        if start is None:
            start = now - timedelta(days=DEFAULT_WINDOW_DAYS)
        end = end or now

        # ── Audit-log hash chain ─────────────────────────────────────────────
        rows_checked, breaks = verify_audit_chain()

        # ── Privileged accounts ──────────────────────────────────────────────
        User = get_user_model()
        manage_roles_holders = set(
            RoleDefinition.objects.filter(permissions__code="manage_roles").values_list("role", flat=True)
        )
        privileged_roles = manage_roles_holders | {Role.PSC_ADMIN}
        active_users = User.objects.filter(is_active=True)
        privileged_qs = (
            active_users.filter(
                Q(is_superuser=True) | Q(is_staff=True) | Q(psc_profile__role__in=privileged_roles)
            )
            .select_related("psc_profile")
            .distinct()
            .order_by("username")
        )

        rows: list[dict[str, Any]] = []
        reasons_count: Counter = Counter()
        without_2fa = 0
        for u in privileged_qs:
            profile = getattr(u, "psc_profile", None)
            role = profile.role if profile else ""
            reasons = []
            if u.is_superuser:
                reasons.append("Superuser")
            if u.is_staff:
                reasons.append("Staff")
            if role == Role.PSC_ADMIN:
                reasons.append("PSC Administrator")
            elif role in manage_roles_holders:
                reasons.append("Holds manage_roles")
            has_2fa = bool(profile and profile.two_factor_enabled)
            if not has_2fa:
                without_2fa += 1
            for reason in reasons:
                reasons_count[reason] += 1
            rows.append({
                "username": u.username,
                "full_name": u.get_full_name() or u.username,
                "role": profile.get_role_display() if profile else "No profile",
                "privilege": ", ".join(reasons),
                "two_factor": "Yes" if has_2fa else "No",
                "last_login": _date_str(u.last_login),
                "status": "Hard-locked" if profile and profile.hard_locked else "Active",
            })

        dormant_cutoff = now - timedelta(days=DORMANT_DAYS)
        dormant = active_users.filter(
            Q(last_login__lt=dormant_cutoff) | Q(last_login__isnull=True, date_joined__lt=dormant_cutoff)
        ).count()

        # ── Security events in the period ────────────────────────────────────
        events = AuditLog.objects.filter(
            action__in=SECURITY_ACTIONS, timestamp__gte=start, timestamp__lt=end,
        )
        by_action = Counter(dict(events.values_list("action").annotate(n=Count("id")).order_by()))
        by_day = list(
            events.annotate(d=TruncDate("timestamp")).values("d").annotate(n=Count("id")).order_by("d")
        )

        total_privileged = len(rows)
        aggregates = {
            "audit_chain_status": "Intact" if not breaks else "BROKEN",
            "audit_rows_checked": rows_checked,
            "audit_chain_breaks": len(breaks),
            "privileged_accounts": total_privileged,
            "privileged_without_2fa": without_2fa,
            "two_factor_coverage_pct": (
                round(100 * (total_privileged - without_2fa) / total_privileged, 1) if total_privileged else 0
            ),
            "accounts_total": active_users.count(),
            "dormant_accounts": dormant,
            "hard_locked_accounts": Profile.objects.filter(hard_locked=True, user__is_active=True).count(),
            "failed_logins": by_action[_A.LOGIN_FAILED],
            "lockouts": by_action[_A.LOCKOUT],
            "permission_changes": by_action[_A.PERMISSION],
            "restores": by_action[_A.RESTORE],
            "security_events": [
                {"name": _ACTION_LABELS.get(a, a), "value": n}
                for a, n in sorted(by_action.items(), key=lambda kv: -kv[1])
            ],
            "security_events_by_day": [
                {"name": r["d"].isoformat(), "value": r["n"]} for r in by_day if r["d"]
            ],
            "privileged_by_reason": [
                {"name": reason, "value": n} for reason, n in reasons_count.most_common()
            ],
        }

        notes = [
            "The audit-log chain is re-verified in full each time this report runs, using the same "
            "check as the verify_audit_log_integrity management command.",
            "Privileged accounts are active users who are superusers or staff, hold the PSC "
            "Administrator role, or hold a role granted the manage_roles permission.",
            f"Security events cover {timezone.localtime(start).strftime('%d %B %Y')} to "
            f"{timezone.localtime(end).strftime('%d %B %Y')}: failed sign-ins, lockouts, unlocks, "
            "password changes, permission changes, settings changes, backups, restores and exports.",
            f"Dormant accounts are active accounts with no sign-in for {DORMANT_DAYS}+ days "
            "(or never, if created that long ago).",
        ]
        if breaks:
            notes.insert(0, "AUDIT CHAIN BROKEN at AuditLog id(s): "
                         + ", ".join(str(i) for i, _ in breaks[:20])
                         + ("…" if len(breaks) > 20 else "") + ". Investigate before relying on the audit trail.")

        meta = {
            "row_count": len(rows),
            "rows_shown": len(rows),
            "truncated": False,
            "scope": "integrity",
            "filters": {k: v for k, v in params.items() if v not in (None, "")},
            "generated_at": timezone.localtime().strftime("%d %B %Y %H:%M"),
            "notes": notes,
        }
        return ResolvedDataset(rows=rows, aggregates=aggregates, meta=meta)


register_resolver(IntegrityAttestationResolver())
