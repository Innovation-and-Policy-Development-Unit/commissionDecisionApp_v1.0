from django.db import migrations, models

DATE_PARAMS = [
    {"key": "date_from", "type": "date", "label": "From"},
    {"key": "date_to", "type": "date", "label": "To"},
]
INCLUDE_TEST = {"key": "include_test", "type": "bool", "label": "Include test submissions", "optional": True}


def _kpis(pairs):
    return [{"source": src, "label": label} for src, label in pairs]


def _charts(triples):
    return [
        {"id": f"{src}_{i}", "source": src, "type": ctype, "title": title}
        for i, (src, ctype, title) in enumerate(triples)
    ]


TEMPLATES = [
    {
        "slug": "pilot_adoption_scorecard",
        "name": "Pilot Adoption & Readiness Scorecard",
        "description": (
            "Per-ministry evidence for the pilot go/no-go: who is signing in, what has been lodged, "
            "how often matters come back for clarification, and how long decisions take."
        ),
        "domain": "pilot_adoption",
        "param_schema": [*DATE_PARAMS, INCLUDE_TEST],
        "visible_to_all": False,
        "visible_roles": [
            "psc_admin", "chairperson", "psc_secretary", "senior_admin_officer", "psc_manager",
            "ipdu_manager", "vipam_manager", "hr_unit_manager", "odu_manager", "csu_manager",
            "compliance_manager",
        ],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": _kpis([
                ("ministries_total", "Ministries with accounts"),
                ("ministries_active", "Ministries active"),
                ("ministries_needs_support", "Ministries needing support"),
                ("ministries_not_started", "Ministries not started"),
                ("active_users", "Active users (30 days)"),
                ("activation_rate", "Activation rate (%)"),
                ("lodged_total", "Matters lodged"),
                ("first_time_right_pct", "First-time-right (%)"),
                ("median_turnaround_days", "Median days to decision"),
            ]),
            "charts": _charts([
                ("adoption_status", "pie", "Ministries by adoption status"),
                ("lodged_by_ministry", "bar", "Matters lodged by ministry"),
                ("active_users_by_ministry", "bar", "Active users by ministry"),
                ("returns_by_ministry", "bar", "Returns for clarification by ministry"),
                ("lodged_by_month", "line", "Matters lodged per month"),
            ]),
            "table": {"columns": [
                "ministry", "accounts", "active_users", "never_logged_in", "lodged", "returned",
                "first_time_right_pct", "decided", "median_turnaround_days", "stalled_drafts", "status",
            ]},
            "narrative_markdown": "",
        },
    },
    {
        "slug": "stage_flow_bottlenecks",
        "name": "Where Do Matters Wait?",
        "description": (
            "Time spent in each workflow stage, the longest-waiting matters right now, and where "
            "the total time goes — built from workflow event timestamps."
        ),
        "domain": "stage_flow",
        "param_schema": [
            *DATE_PARAMS,
            {"key": "ministry_id", "type": "ministry", "label": "Ministry", "optional": True},
            {"key": "routed_unit", "type": "routed_unit", "label": "Unit", "optional": True},
            INCLUDE_TEST,
        ],
        "visible_to_all": True,
        "visible_roles": [],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": _kpis([
                ("matters_in_scope", "Matters in scope"),
                ("open_now", "Waiting now"),
                ("median_end_to_end_days", "Median days to decision"),
                ("p90_end_to_end_days", "90th percentile days to decision"),
                ("slowest_stage", "Slowest stage"),
                ("slowest_stage_median_days", "Slowest stage median (days)"),
                ("longest_open_days", "Longest current wait (days)"),
                ("waiting_over_30_days", "Waiting over 30 days"),
            ]),
            "charts": _charts([
                ("stage_median_days", "bar", "Median days in each stage"),
                ("stage_p90_days", "bar", "90th percentile days in each stage"),
                ("time_share_by_stage", "pie", "Where the time goes (% of total stage time)"),
                ("stage_open_now", "bar", "Matters waiting now, by stage"),
                ("stage_oldest_open_days", "bar", "Longest current wait by stage (days)"),
                ("open_by_unit", "bar", "Matters waiting, by unit"),
            ]),
            "table": {"columns": [
                "reference_number", "title", "ministry", "stage", "unit", "days_in_stage", "days_open",
            ]},
            "narrative_markdown": "",
        },
    },
    {
        "slug": "integrity_access_attestation",
        "name": "Integrity & Access Attestation",
        "description": (
            "Audit-log chain verification, privileged accounts and their two-factor coverage, and "
            "security events in the period. For the Chairperson, Secretary and IPDU."
        ),
        "domain": "integrity",
        "param_schema": DATE_PARAMS,
        "visible_to_all": False,
        "visible_roles": ["psc_admin", "chairperson", "psc_secretary", "ipdu_manager"],
        "spec": {
            "sections": ["kpis", "charts", "table"],
            "kpis": _kpis([
                ("audit_chain_status", "Audit log chain"),
                ("audit_rows_checked", "Audit rows verified"),
                ("privileged_accounts", "Privileged accounts"),
                ("privileged_without_2fa", "Privileged without 2FA"),
                ("two_factor_coverage_pct", "Privileged 2FA coverage (%)"),
                ("dormant_accounts", "Dormant accounts (90 days)"),
                ("hard_locked_accounts", "Hard-locked accounts"),
                ("failed_logins", "Failed sign-ins"),
                ("lockouts", "Account lockouts"),
                ("permission_changes", "Permission changes"),
                ("restores", "Database restores"),
            ]),
            "charts": _charts([
                ("security_events", "bar", "Security events in period"),
                ("security_events_by_day", "line", "Security events per day"),
                ("privileged_by_reason", "pie", "Privileged accounts by reason"),
            ]),
            "table": {"columns": [
                "username", "full_name", "role", "privilege", "two_factor", "last_login", "status",
            ]},
            "narrative_markdown": "",
        },
    },
]


def seed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    for tpl in TEMPLATES:
        ReportTemplate.objects.update_or_create(
            slug=tpl["slug"],
            defaults={
                "name": tpl["name"],
                "description": tpl["description"],
                "domain": tpl["domain"],
                "spec": tpl["spec"],
                "param_schema": tpl["param_schema"],
                "default_params": {},
                "visible_to_all": tpl["visible_to_all"],
                "visible_roles": tpl["visible_roles"],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    ReportTemplate = apps.get_model("tracker", "ReportTemplate")
    ReportTemplate.objects.filter(slug__in=[t["slug"] for t in TEMPLATES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0276_signed_paper_lodgement"),
    ]

    operations = [
        migrations.AlterField(
            model_name="smartreport",
            name="domain",
            field=models.CharField(
                choices=[
                    ("submissions", "Submissions"),
                    ("pilot_adoption", "Pilot adoption"),
                    ("stage_flow", "Stage flow"),
                    ("integrity", "Integrity & access"),
                ],
                default="submissions",
                max_length=24,
            ),
        ),
        migrations.RunPython(seed, unseed),
    ]
