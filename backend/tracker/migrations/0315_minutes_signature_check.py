from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0314_decision_holds_and_unsigned_actioning"),
    ]

    operations = [
        migrations.AddField(
            model_name="minutes",
            name="signature_check",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
