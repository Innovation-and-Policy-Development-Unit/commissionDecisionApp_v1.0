from django.db import migrations

# Date-range params exposed on every unit report's Generate form; the unit itself
# is fixed via default_params.routed_unit so each report is pre-scoped to its unit.
DATE_PARAMS = [
    {"key": "date_from", "type": "date", "label": "From"},
    {"key": "date_to", "type": "date", "label": "To"},
]

UNIT_TEMPLATES = [
    {
        "slug": "odu_workload",
        "name": "ODU — Workload & Turnaround",
        "description": "Organisation Development Unit: workload, stage pipeline, and turnaround.",
        "routed_unit": "odu",
        "roles": ["odu_manager", "odu_principal", "principal_org_dev_analyst", "principal_job_analyst"],
        "kpis": ["total", "active", "overdue_assessments", "turnaround_avg"],
        "charts": [
            ("by_stage", "bar", "By stage"),
            ("by_month", "line", "Submissions per month"),
            ("turnaround_buckets", "column", "Turnaround distribution"),
        ],
        "columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"],
    },
    {
        "slug": "compliance_caseload",
        "name": "Compliance — Caseload",
        "description": "Compliance Unit: caseload, stage pipeline, and breakdown by ministry.",
        "routed_unit": "compliance",
        "roles": ["compliance_manager", "compliance_senior", "compliance_principal"],
        "kpis": ["total", "active", "overdue_assessments"],
        "charts": [
            ("by_stage", "bar", "By stage"),
            ("by_ministry", "bar", "By ministry"),
            ("by_month", "line", "Cases per month"),
        ],
        "columns": ["reference_number", "title", "ministry", "stage", "created"],
    },
    {
        "slug": "hrm_workload",
        "name": "HR Unit — Workload & Turnaround",
        "description": "Manager HR Unit: workload by category, stage pipeline, and turnaround.",
        "routed_unit": "hr",
        "roles": ["hr_unit_manager", "hr_unit_principal"],
        "kpis": ["total", "active", "turnaround_avg", "turnaround_median"],
        "charts": [
            ("by_stage", "bar", "By stage"),
            ("by_category", "bar", "By form category"),
            ("turnaround_buckets", "column", "Turnaround distribution"),
        ],
        "columns": ["reference_number", "title", "ministry", "category", "stage", "created", "turnaround_days"],
    },
    {
        "slug": "vipam_workload",
        "name": "VIPAM — Workload & Turnaround",
        "description": "VIPAM Unit: workload, stage pipeline, and turnaround.",
        "routed_unit": "vipam",
        "roles": ["vipam_manager", "vipam_principal"],
        "kpis": ["total", "active", "overdue_assessments", "turnaround_avg"],
        "charts": [
            ("by_stage", "bar", "By stage"),
            ("by_month", "line", "Submissions per month"),
            ("turnaround_buckets", "column", "Turnaround distribution"),
        ],
        "columns": ["reference_number", "title", "ministry", "stage", "created", "turnaround_days"],
    },
    {
        "slug": "csu_workload",
        "name": "CSU — Workload",
        "description": "Corporate Services Unit: workload by category, stage pipeline, and trend.",
        "routed_unit": "csu",
        "roles": ["csu_manager"],
        "kpis": ["total", "active", "overdue_assessments"],
        "charts": [
            ("by_stage", "bar", "By stage"),
            ("by_category", "bar", "By form category"),
            ("by_month", "line", "Submissions per month"),
        ],
        "columns": ["reference_number", "title", "ministry", "category", "stage", "created"],
    },
]

KPI_LABELS = {
    "total": "Total submissions",
    "active": "Active",
    "overdue_assessments": "Overdue assessments",
    "decided_total": "Decided",
    "turnaround_avg": "Avg turnaround (days)",
    "turnaround_median": "Median turnaround (days)",
}


def _spec(tpl):
    return {
        "sections": ["kpis", "charts", "table"],
        "kpis": [{"source": s, "label": KPI_LABELS.get(s, s)} for s in tpl["kpis"]],
        "charts": [
            {"id": f"{src}_{i}", "source": src, "type": ctype, "title": title}
            for i, (src, ctype, title) in enumerate(tpl["charts"])
        ],
        "table": {"columns": tpl["columns"]},
        "narrative_markdown": "",
    }


def seed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    for tpl in UNIT_TEMPLATES:
        ReportTemplate.objects.update_or_create(
            slug=tpl["slug"],
            defaults={
                "name": tpl["name"],
                "description": tpl["description"],
                "domain": "submissions",
                "spec": _spec(tpl),
                "param_schema": DATE_PARAMS,
                "default_params": {"routed_unit": tpl["routed_unit"]},
                "visible_to_all": False,
                "visible_roles": tpl["roles"],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    ReportTemplate.objects.filter(slug__in=[t["slug"] for t in UNIT_TEMPLATES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0130_alter_smartreport_report_type"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
