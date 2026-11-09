"""Decision letters can be addressed to a particular ministry (and department).

A letter used to go to the submission's own ministry. An OPSC-internal paper that covers every
ministry (ODU's Organisation Performance Assessment Feedback Report) has no ministry, and the
Commission's decisions on it are aimed at particular ministries and departments, so each
letter now says who it is for. Existing letters are untouched: blank still means the
submission's ministry.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0305_odu_opa_feedback_report"),
    ]

    operations = [
        migrations.AddField(
            model_name="decisionletter",
            name="ministry",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="decision_letters", to="tracker.ministry",
                help_text="Who the letter is addressed to. Blank means the submission's own ministry. "
                          "Set when the Commission's decision is aimed at a particular ministry from an "
                          "OPSC-internal paper that covers several (e.g. an ODU performance report).",
            ),
        ),
        migrations.AddField(
            model_name="decisionletter",
            name="department",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="decision_letters", to="tracker.department",
                help_text="Optional department within the ministry the letter is aimed at.",
            ),
        ),
    ]
