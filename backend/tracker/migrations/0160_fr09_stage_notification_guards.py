from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0159_fr05_new_compliance_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="compliancecasestage",
            name="at_risk_notified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="compliancecasestage",
            name="overdue_notified",
            field=models.BooleanField(default=False),
        ),
    ]
