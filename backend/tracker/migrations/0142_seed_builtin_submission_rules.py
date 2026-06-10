from django.db import migrations

# Built-in rules migrated from the existing SLA / overdue / escalation logic.
# Seeded with test_mode=True so they flag (visible in the Flag Monitor) but send
# no emails until an admin reviews and switches test mode off — avoiding a
# notification flood on day one.
BUILTIN = [
    {
        "name": "Assessment overdue",
        "level": "critical",
        "match": "all",
        "conditions": [{"field": "is_overdue", "op": "is_true"}],
        "description": "Under assessment past its deadline.",
    },
    {
        "name": "Assessment due soon",
        "level": "at_risk",
        "match": "all",
        "conditions": [
            {"field": "days_to_deadline", "op": "lt", "value": 2},
            {"field": "is_overdue", "op": "is_false"},
        ],
        "description": "Assessment deadline within 2 days.",
    },
    {
        "name": "Stalled — no update in 7 days",
        "level": "at_risk",
        "match": "all",
        "conditions": [
            {"field": "days_since_update", "op": "gt", "value": 7},
            {"field": "current_stage", "op": "in",
             "value": ["under_assessment", "manager_checklist_review", "registered_routed"]},
        ],
        "description": "No progress for over a week.",
    },
    {
        "name": "Unassigned after registration",
        "level": "at_risk",
        "match": "all",
        "conditions": [
            {"field": "current_stage", "op": "in", "value": ["registered_routed", "manager_checklist_review"]},
            {"field": "is_unassigned", "op": "is_true"},
        ],
        "description": "Routed to a unit but no officer assigned.",
    },
    {
        "name": "Awaiting legal/cabinet too long",
        "level": "monitoring",
        "match": "all",
        "conditions": [
            {"field": "current_stage", "op": "in", "value": ["awaiting_legal_advice", "awaiting_cabinet_decision"]},
            {"field": "days_since_update", "op": "gt", "value": 14},
        ],
        "description": "Held for external advice for over 14 days.",
    },
    {
        "name": "Returned, not resubmitted",
        "level": "monitoring",
        "match": "all",
        "conditions": [
            {"field": "current_stage", "op": "eq", "value": "returned_for_clarification"},
            {"field": "days_since_update", "op": "gt", "value": 7},
        ],
        "description": "Returned for clarification with no resubmission in 7 days.",
    },
]

NOTIFY_ROLES = ["psc_admin", "psc_manager", "senior_admin_officer"]


def seed(apps, schema_editor):
    SubmissionRule = apps.get_model("tracker", "SubmissionRule")
    for spec in BUILTIN:
        SubmissionRule.objects.update_or_create(
            name=spec["name"],
            defaults={
                "description": spec["description"],
                "level": spec["level"],
                "match": spec["match"],
                "conditions": spec["conditions"],
                "is_active": True,
                "is_builtin": True,
                "test_mode": True,
                "cooldown_minutes": 60,
                "notify_assignee": True,
                "notify_roles": NOTIFY_ROLES,
            },
        )


def unseed(apps, schema_editor):
    SubmissionRule = apps.get_model("tracker", "SubmissionRule")
    SubmissionRule.objects.filter(is_builtin=True, name__in=[s["name"] for s in BUILTIN]).delete()


class Migration(migrations.Migration):

    dependencies = [("tracker", "0141_submission_rule_flag")]

    operations = [migrations.RunPython(seed, unseed)]
