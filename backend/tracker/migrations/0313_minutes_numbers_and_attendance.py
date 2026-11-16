from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0312_commissiontask_completion_and_update_kind"),
    ]

    operations = [
        migrations.AddField(
            model_name="meeting",
            name="psc_meeting_number",
            field=models.CharField(
                blank=True,
                help_text=(
                    "The Commission's own meeting number (e.g. 23 for PSC Meeting No. 23). "
                    "Not the system reference. Used to number decisions as decision#-meeting#-year."
                ),
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="meeting",
            name="minute_attendance",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Who was present / absent / sent apologies, recorded in minute intake.",
            ),
        ),
        migrations.AddField(
            model_name="minuteagendaintake",
            name="decision_number",
            field=models.CharField(
                blank=True,
                help_text=(
                    "The Commission's own decision number for this item, as it appears in the "
                    "minutes (e.g. 03(n)-23-2026). Typed by the minute-taker, never AI-generated."
                ),
                max_length=64,
            ),
        ),
    ]
