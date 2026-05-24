"""Track when SCDMS notified CMS to close the linked case."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0059_seed_opsc_ministry"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="cms_case_closed_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="When SCDMS notified CMS to close the linked case after portal completion.",
            ),
        ),
    ]
