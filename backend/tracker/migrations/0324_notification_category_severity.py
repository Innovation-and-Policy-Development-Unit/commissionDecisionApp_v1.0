from django.db import migrations, models


def backfill(apps, schema_editor):
    from tracker.notification_meta import classify

    Notification = apps.get_model("tracker", "Notification")
    for n in Notification.objects.all().only("id", "title").iterator():
        category, severity = classify(n.title)
        Notification.objects.filter(pk=n.pk).update(category=category, severity=severity)


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0323_submission_duplicate_review"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="category",
            field=models.CharField(
                blank=True, db_index=True, default="", max_length=24,
                help_text="What it is about (minutes, agenda, approval, ...). Filled from the title when blank.",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="severity",
            field=models.CharField(
                blank=True, default="info", max_length=10,
                help_text="info, success, warning or error: drives the icon in the bell.",
            ),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "is_read", "-created_at"], name="notif_recip_read_idx"),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
