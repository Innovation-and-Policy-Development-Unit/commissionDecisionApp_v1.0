from django.db import migrations

# Built-in rules for commission tasks (manager→principal chain) and meetings/minutes.
# Seeded in test_mode so they flag but send no alerts until an admin enables them.
BUILTIN = [
    # ── Commission tasks ─────────────────────────────────────────────────────
    {
        "name": "Task with manager, not delegated",
        "entity": "commission_task", "level": "at_risk", "match": "all",
        "conditions": [
            {"field": "is_undelegated", "op": "is_true"},
            {"field": "status", "op": "eq", "value": "open"},
            {"field": "days_since_created", "op": "gt", "value": 3},
        ],
        "description": "Allocated to a manager but not delegated to a principal/senior in 3 days.",
        "notify_roles": ["psc_manager", "senior_admin_officer"],
    },
    {
        "name": "Task overdue",
        "entity": "commission_task", "level": "critical", "match": "all",
        "conditions": [{"field": "is_overdue", "op": "is_true"}],
        "description": "Past its due date and not completed.",
        "notify_roles": ["psc_manager", "senior_admin_officer"],
    },
    {
        "name": "Task stalled — no update in 7 days",
        "entity": "commission_task", "level": "at_risk", "match": "all",
        "conditions": [
            {"field": "status", "op": "eq", "value": "in_progress"},
            {"field": "days_since_update", "op": "gt", "value": 7},
        ],
        "description": "In progress with no update for over a week.",
        "notify_roles": ["psc_manager"],
    },
    {
        "name": "Matters arising not actioned",
        "entity": "commission_task", "level": "monitoring", "match": "all",
        "conditions": [
            {"field": "implementation_status", "op": "eq", "value": "matters_arising"},
            {"field": "days_since_update", "op": "gt", "value": 14},
        ],
        "description": "Carried as matters arising for over 14 days.",
        "notify_roles": ["psc_secretary", "senior_admin_officer"],
    },
    # ── Meetings / minutes ───────────────────────────────────────────────────
    {
        "name": "Minutes unsigned after sitting",
        "entity": "meeting", "level": "at_risk", "match": "all",
        "conditions": [
            {"field": "status", "op": "eq", "value": "completed"},
            {"field": "days_since_meeting", "op": "gt", "value": 7},
            {"field": "minutes_signed", "op": "is_false"},
        ],
        "description": "Sitting completed over 7 days ago with no signed minutes.",
        "notify_roles": ["psc_secretary", "senior_admin_officer", "psc_admin"],
    },
    {
        "name": "Decisions not entered after sitting",
        "entity": "meeting", "level": "at_risk", "match": "all",
        "conditions": [
            {"field": "status", "op": "eq", "value": "completed"},
            {"field": "days_since_meeting", "op": "gt", "value": 3},
            {"field": "has_decisions", "op": "is_false"},
        ],
        "description": "Sitting completed but no decisions entered into the register.",
        "notify_roles": ["psc_secretary", "senior_admin_officer"],
    },
]


def seed(apps, schema_editor):
    SubmissionRule = apps.get_model("tracker", "SubmissionRule")
    for spec in BUILTIN:
        SubmissionRule.objects.update_or_create(
            name=spec["name"],
            defaults={
                "entity": spec["entity"],
                "description": spec["description"],
                "level": spec["level"],
                "match": spec["match"],
                "conditions": spec["conditions"],
                "is_active": True,
                "is_builtin": True,
                "test_mode": True,
                "cooldown_minutes": 60,
                "notify_assignee": True,
                "notify_roles": spec["notify_roles"],
            },
        )


def unseed(apps, schema_editor):
    SubmissionRule = apps.get_model("tracker", "SubmissionRule")
    SubmissionRule.objects.filter(is_builtin=True, name__in=[s["name"] for s in BUILTIN]).delete()


class Migration(migrations.Migration):

    dependencies = [("tracker", "0143_rule_multi_entity")]

    operations = [migrations.RunPython(seed, unseed)]
