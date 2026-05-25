"""Per-agenda-item minute intake rows for Claude formatting."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0083_knowledge_role_guides"),
    ]

    operations = [
        migrations.CreateModel(
            name="MinuteAgendaIntake",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("agenda_title", models.CharField(max_length=512)),
                (
                    "agenda_description",
                    models.TextField(
                        blank=True,
                        help_text="From approved agenda (blurb / submission summary).",
                    ),
                ),
                (
                    "discussion_notes",
                    models.TextField(
                        blank=True,
                        help_text="Plain English discussion notes from the minute-taker.",
                    ),
                ),
                (
                    "decision_text",
                    models.TextField(
                        blank=True,
                        help_text="Free-text decision notes from the minute-taker.",
                    ),
                ),
                (
                    "action_officer",
                    models.CharField(
                        blank=True,
                        help_text="Officer or unit responsible for follow-up.",
                        max_length=255,
                    ),
                ),
                ("formatted_discussion", models.TextField(blank=True)),
                ("formatted_decision", models.TextField(blank=True)),
                ("formatted_decision_type", models.CharField(blank=True, max_length=32)),
                ("formatted_action_items", models.JSONField(blank=True, default=list)),
                ("formatted_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "agenda_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="minute_intake",
                        to="tracker.agendaitem",
                    ),
                ),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="minute_intakes",
                        to="tracker.meeting",
                    ),
                ),
            ],
            options={
                "ordering": ["agenda_item__sequence", "agenda_item__id"],
            },
        ),
        migrations.AddConstraint(
            model_name="minuteagendaintake",
            constraint=models.UniqueConstraint(
                fields=("meeting", "agenda_item"),
                name="uniq_minute_intake_per_agenda_item",
            ),
        ),
    ]
