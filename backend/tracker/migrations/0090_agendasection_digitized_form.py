import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0089_agenda_section_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="agendasection",
            name="digitized_form",
            field=models.ForeignKey(
                blank=True,
                help_text="Default digitized PSC form for submissions lodged under this agenda section.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="agenda_sections_as_default",
                to="tracker.pscformtype",
            ),
        ),
    ]
