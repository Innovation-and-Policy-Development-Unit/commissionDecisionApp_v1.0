from django.db import migrations, models


class Migration(migrations.Migration):
    """Insert the `with_secretary` review state into the agenda workflow.

    Stage-B agenda chain is now: draft → with_secretary → with_chairman →
    chairman_approved → circulated (SAO builds → Secretary reviews → Chairman
    endorses). Existing stored values are unchanged; this only widens the
    choices and relabels them, so it is a state-only AlterField (no DDL).
    """

    dependencies = [
        ("tracker", "0134_mention"),
    ]

    operations = [
        migrations.AlterField(
            model_name="meeting",
            name="agenda_status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("with_secretary", "With Secretary for Review"),
                    ("with_chairman", "With Chairman for Endorsement"),
                    ("chairman_approved", "Chairman Endorsed"),
                    ("circulated", "Circulated to Members"),
                ],
                default="draft",
                help_text="Tracking: draft → with Secretary → with Chairman → endorsed → circulated.",
                max_length=24,
            ),
        ),
    ]
