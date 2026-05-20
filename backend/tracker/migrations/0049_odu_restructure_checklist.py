from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0048_pscformtype_agenda_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ODURestructureChecklist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(
                    choices=[("draft", "Draft"), ("submitted", "Submitted"), ("approved", "Approved")],
                    db_index=True, default="draft", max_length=12,
                )),
                # Section A
                ("ministry_department", models.CharField(blank=True, max_length=255)),
                ("division_unit",       models.CharField(blank=True, max_length=255)),
                ("submission_type", models.CharField(
                    blank=True,
                    choices=[
                        ("full_restructure", "Full Restructure"),
                        ("partial_review",   "Partial Review"),
                        ("new_jd",           "New Job Description"),
                        ("amendment",        "Amendment"),
                    ],
                    max_length=20,
                )),
                ("odu_officer_assigned", models.CharField(blank=True, max_length=255)),
                ("manager_odu",          models.CharField(blank=True, max_length=255)),
                # Section B — 20 nullable boolean fields
                ("b1_cover_letter",        models.BooleanField(blank=True, null=True)),
                ("b2_org_chart",           models.BooleanField(blank=True, null=True)),
                ("b3_positions_list",      models.BooleanField(blank=True, null=True)),
                ("b4_jds_attached",        models.BooleanField(blank=True, null=True)),
                ("b5_rationale_stated",    models.BooleanField(blank=True, null=True)),
                ("b6_mandate_alignment",   models.BooleanField(blank=True, null=True)),
                ("b7_reporting_lines",     models.BooleanField(blank=True, null=True)),
                ("b8_no_duplication",      models.BooleanField(blank=True, null=True)),
                ("b9_span_of_control",     models.BooleanField(blank=True, null=True)),
                ("b10_job_purpose_linked", models.BooleanField(blank=True, null=True)),
                ("b11_kra_kta_kpi",        models.BooleanField(blank=True, null=True)),
                ("b12_competencies",       models.BooleanField(blank=True, null=True)),
                ("b13_qual_experience",    models.BooleanField(blank=True, null=True)),
                ("b14_cost_analysis",      models.BooleanField(blank=True, null=True)),
                ("b15_grt_mapping",        models.BooleanField(blank=True, null=True)),
                ("b16_consultation",       models.BooleanField(blank=True, null=True)),
                ("b17_odu_analysis",       models.BooleanField(blank=True, null=True)),
                ("b18_feedback_provided",  models.BooleanField(blank=True, null=True)),
                ("b19_final_docs_ready",   models.BooleanField(blank=True, null=True)),
                ("b20_manager_final_check",models.BooleanField(blank=True, null=True)),
                # Section C
                ("recommendation", models.CharField(
                    blank=True,
                    choices=[
                        ("verified",       "Submission verified and ready for Commission submission"),
                        ("needs_revision", "Submission requires revision before further processing"),
                        ("incomplete",     "Submission incomplete — return to Ministry for clarification"),
                    ],
                    max_length=20,
                )),
                ("officer_comments", models.TextField(blank=True)),
                # Section D
                ("verifying_officer_name", models.CharField(blank=True, max_length=255)),
                ("verifying_officer_date", models.DateField(blank=True, null=True)),
                ("manager_verifier_name",  models.CharField(blank=True, max_length=255)),
                ("manager_verifier_date",  models.DateField(blank=True, null=True)),
                # Meta
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at",   models.DateTimeField(auto_now_add=True)),
                ("updated_at",   models.DateTimeField(auto_now=True)),
                # FKs
                ("submission", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="odu_checklist",
                    to="tracker.submission",
                )),
                ("created_by", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="odu_checklists_created",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "ODU Restructure Checklist",
                "verbose_name_plural": "ODU Restructure Checklists",
                "ordering": ["-created_at"],
            },
        ),
    ]
