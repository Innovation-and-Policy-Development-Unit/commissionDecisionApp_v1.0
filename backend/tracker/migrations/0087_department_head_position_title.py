from django.db import migrations, models


def set_statistics_head_titles(apps, schema_editor):
    Department = apps.get_model("tracker", "Department")
    for dept in Department.objects.all():
        name = (dept.name or "").upper()
        code = (dept.code or "").upper()
        if "STATISTIC" in name or code in {"VNSO", "NSO", "VBS"}:
            if not dept.head_position_title:
                dept.head_position_title = "Chief Statistician"
                dept.save(update_fields=["head_position_title"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0086_email_cron_schedule"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="head_position_title",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Title of the department head for travel endorsements "
                    "(e.g. Chief Statistician). Leave blank to derive from department name."
                ),
                max_length=128,
            ),
        ),
        migrations.RunPython(set_statistics_head_titles, migrations.RunPython.noop),
    ]
