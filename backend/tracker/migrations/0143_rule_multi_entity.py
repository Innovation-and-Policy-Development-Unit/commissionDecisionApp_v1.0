import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0142_seed_builtin_submission_rules"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissionrule",
            name="entity",
            field=models.CharField(
                choices=[("submission", "Submission"), ("commission_task", "Commission task"), ("meeting", "Meeting / minutes")],
                default="submission", max_length=20,
            ),
        ),
        migrations.AlterUniqueTogether(
            name="submissionflag",
            unique_together=set(),
        ),
        migrations.AlterField(
            model_name="submissionflag",
            name="submission",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="tracker.submission"),
        ),
        migrations.AddField(
            model_name="submissionflag",
            name="commission_task",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="tracker.commissiontask"),
        ),
        migrations.AddField(
            model_name="submissionflag",
            name="meeting",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="tracker.meeting"),
        ),
    ]
