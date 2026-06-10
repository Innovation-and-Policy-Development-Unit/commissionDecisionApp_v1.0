"""Per-entity adapters for the Watch engine.

Each adapter knows how to: build the matching queryset (whitelist Q), scope flags
for viewing (RBAC), wire the flag's entity FK, pick alert recipients, and produce
a normalised flag payload for the generic Flag Monitor.
"""

from __future__ import annotations

from . import fields


def _profile(user):
    from tracker.views import _profile as p
    return p(user)


def _is_psc_internal(user):
    if user.is_superuser or user.is_staff:
        return True
    from tracker.models import Role
    return _profile(user).role in {
        Role.PSC_ADMIN, Role.PSC_OFFICER, Role.PSC_SECRETARY, Role.PSC_MANAGER,
        Role.CHAIRPERSON, Role.PSC_COMMISSIONER, Role.SENIOR_ADMIN_OFFICER,
        Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER, Role.VIPAM_MANAGER,
        Role.HR_UNIT_MANAGER, Role.ODU_MANAGER, Role.COMPLIANCE_MANAGER,
        Role.VIPAM_PRINCIPAL, Role.HR_UNIT_PRINCIPAL, Role.ODU_PRINCIPAL,
        Role.COMPLIANCE_PRINCIPAL,
    }


def _role_users(roles):
    from tracker.models import Profile
    if not roles:
        return []
    return [p.user for p in Profile.objects.filter(role__in=roles).select_related("user") if p.user.is_active]


class _Adapter:
    key = ""
    label = ""
    flag_fk = ""          # SubmissionFlag field name holding this entity
    leaf = None           # translator from fields.py

    def catalog(self):
        raise NotImplementedError

    def base_qs(self):
        raise NotImplementedError

    def matched_ids(self, rule, now):
        q = fields.build_q(self.leaf, rule.conditions, rule.match, now)
        if q is None:
            return set()
        return set(self.base_qs().filter(q).distinct().values_list("id", flat=True))

    def scoped_ids(self, user):
        raise NotImplementedError

    def entity_users(self, rule, obj):
        return []

    def recipients(self, rule, obj):
        users = {}
        if rule.notify_assignee:
            for u in self.entity_users(rule, obj):
                if u and u.is_active:
                    users[u.id] = u
        for u in _role_users(rule.notify_roles):
            users[u.id] = u
        return list(users.values())

    def payload(self, flag):
        raise NotImplementedError


class SubmissionAdapter(_Adapter):
    key = "submission"
    label = "Submission"
    flag_fk = "submission"
    leaf = staticmethod(fields.submission_leaf)

    def catalog(self):
        return fields.submission_fields()

    def base_qs(self):
        from tracker.models import Submission
        return Submission.objects.filter(is_attachment=False).select_related("ministry", "assigned_to")

    def scoped_ids(self, user):
        from tracker.views import _submission_queryset_for
        return _submission_queryset_for(user).values("id")

    def entity_users(self, rule, obj):
        return [obj.assigned_to] if obj.assigned_to_id else []

    def payload(self, flag):
        s = flag.submission
        return {
            "ref": s.reference_number, "title": s.title,
            "context": s.ministry.name if s.ministry_id else "",
            "state": s.current_stage, "link": f"/submissions/{s.id}", "entity_id": s.id,
        }


class CommissionTaskAdapter(_Adapter):
    key = "commission_task"
    label = "Commission task"
    flag_fk = "commission_task"
    leaf = staticmethod(fields.task_leaf)

    def catalog(self):
        return fields.task_fields()

    def base_qs(self):
        from tracker.models import CommissionTask
        return CommissionTask.objects.select_related("assigned_manager", "assigned_staff", "submission")

    def scoped_ids(self, user):
        from django.db.models import Q
        from tracker.models import CommissionTask
        qs = CommissionTask.objects.all()
        if not _is_psc_internal(user):
            qs = qs.filter(
                Q(assigned_manager=user) | Q(assigned_staff=user) | Q(assigned_staff_m2m=user)
            ).distinct()
        return qs.values("id")

    def entity_users(self, rule, obj):
        users = []
        if obj.assigned_manager_id:
            users.append(obj.assigned_manager)
        if obj.assigned_staff_id:
            users.append(obj.assigned_staff)
        users.extend(obj.assigned_staff_m2m.all())
        return users

    def payload(self, flag):
        tk = flag.commission_task
        return {
            "ref": tk.decision_number or f"Task #{tk.id}", "title": tk.title,
            "context": (tk.assigned_manager.get_username() if tk.assigned_manager_id else ""),
            "state": tk.status, "link": "/secretariat/tasks", "entity_id": tk.id,
        }


class MeetingAdapter(_Adapter):
    key = "meeting"
    label = "Meeting / minutes"
    flag_fk = "meeting"
    leaf = staticmethod(fields.meeting_leaf)

    def catalog(self):
        return fields.meeting_fields()

    def base_qs(self):
        from tracker.models import Meeting
        return Meeting.objects.all()

    def scoped_ids(self, user):
        from tracker.models import Meeting
        qs = Meeting.objects.all() if _is_psc_internal(user) else Meeting.objects.none()
        return qs.values("id")

    def entity_users(self, rule, obj):
        return []  # meetings are PSC-internal; alert by role only

    def payload(self, flag):
        m = flag.meeting
        return {
            "ref": m.reference_number, "title": m.title,
            "context": str(m.date) if m.date else "",
            "state": m.agenda_status, "link": f"/secretariat/meetings/{m.id}/workspace", "entity_id": m.id,
        }


ADAPTERS = {a.key: a for a in (SubmissionAdapter(), CommissionTaskAdapter(), MeetingAdapter())}


def get_adapter(entity):
    return ADAPTERS.get(entity or "submission")
