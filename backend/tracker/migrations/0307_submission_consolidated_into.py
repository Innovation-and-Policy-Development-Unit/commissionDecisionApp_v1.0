"""Ministry plans and reports can be covered by one consolidated ODU paper."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0306_decision_letter_target"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="consolidated_into",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="consolidated_submissions", to="tracker.submission",
                help_text="The ODU paper that covers this ministry plan or report. ODU sends one paper "
                          "to the Commission for all the Business Plans, all the Corporate Plans or all "
                          "the Annual Reports it has noted; each of those ministry submissions points here.",
            ),
        ),
    ]
