from django.db import migrations

SEED_TEMPLATES = [
    {
        "slug": "submissions_volume_turnaround",
        "name": "Submission Volume & Turnaround",
        "description": "Monthly submission volume, turnaround distribution, and breakdown by ministry.",
        "domain": "submissions",
        "param_schema": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "ministry_id", "type": "ministry", "label": "Ministry", "optional": True},
        ],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": [
                {"label": "Total submissions", "source": "total"},
                {"label": "Active", "source": "active"},
                {"label": "Avg turnaround (days)", "source": "turnaround_avg"},
                {"label": "Median turnaround (days)", "source": "turnaround_median"},
            ],
            "charts": [
                {"id": "volume_trend", "type": "line", "title": "Submissions per month", "source": "by_month"},
                {"id": "by_ministry", "type": "bar", "title": "By ministry", "source": "by_ministry"},
                {"id": "turnaround", "type": "column", "title": "Turnaround distribution", "source": "turnaround_buckets"},
            ],
            "table": {"columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"]},
        },
    },
    {
        "slug": "submissions_by_ministry",
        "name": "Submissions by Ministry",
        "description": "Volume by ministry and form category, with current workload.",
        "domain": "submissions",
        "param_schema": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "stage", "type": "stage", "label": "Stage", "optional": True},
        ],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": [
                {"label": "Total submissions", "source": "total"},
                {"label": "Active", "source": "active"},
                {"label": "Overdue assessments", "source": "overdue_assessments"},
            ],
            "charts": [
                {"id": "by_ministry", "type": "bar", "title": "By ministry", "source": "by_ministry"},
                {"id": "by_category", "type": "bar", "title": "By form category", "source": "by_category"},
            ],
            "table": {"columns": ["reference_number", "title", "ministry", "category", "stage", "created"]},
        },
    },
    {
        "slug": "submissions_stage_pipeline",
        "name": "Stage Pipeline & Aging",
        "description": "Where submissions sit in the workflow and how long they have been in scope.",
        "domain": "submissions",
        "param_schema": [
            {"key": "date_from", "type": "date", "label": "From"},
            {"key": "date_to", "type": "date", "label": "To"},
            {"key": "ministry_id", "type": "ministry", "label": "Ministry", "optional": True},
            {"key": "overdue_only", "type": "bool", "label": "Overdue assessments only", "optional": True},
        ],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": [
                {"label": "Total submissions", "source": "total"},
                {"label": "Active", "source": "active"},
                {"label": "Overdue assessments", "source": "overdue_assessments"},
            ],
            "charts": [
                {"id": "by_stage", "type": "bar", "title": "By stage", "source": "by_stage"},
                {"id": "turnaround", "type": "column", "title": "Turnaround distribution", "source": "turnaround_buckets"},
            ],
            "table": {"columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"]},
        },
    },
]


def seed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")

    perm, _ = SystemPermission.objects.update_or_create(
        code="manage_report_templates",
        defaults={
            "label": "Manage Report Templates",
            "description": "Create, edit, and delete report templates used to generate reports.",
            "category": "administration",
            "is_builtin": True,
        },
    )
    admin_rd = RoleDefinition.objects.filter(role="psc_admin").first()
    if admin_rd:
        admin_rd.permissions.add(perm)

    for tpl in SEED_TEMPLATES:
        ReportTemplate.objects.update_or_create(
            slug=tpl["slug"],
            defaults={
                "name": tpl["name"],
                "description": tpl["description"],
                "domain": tpl["domain"],
                "spec": tpl["spec"],
                "param_schema": tpl["param_schema"],
                "default_params": {},
                "visible_to_all": True,
                "visible_roles": [],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    ReportTemplate.objects.filter(slug__in=[t["slug"] for t in SEED_TEMPLATES]).delete()
    SystemPermission.objects.filter(code="manage_report_templates").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0128_report_template"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
