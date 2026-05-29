"""Agenda section receiver_roles — which roles are notified when submissions are lodged."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0096_odu_principal_analyst_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="agendasection",
            name="receiver_roles",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    "PSC profile roles notified when a submission is lodged under this "
                    "agenda section. Empty falls back to the submission routed-unit manager."
                ),
            ),
        ),
    ]
