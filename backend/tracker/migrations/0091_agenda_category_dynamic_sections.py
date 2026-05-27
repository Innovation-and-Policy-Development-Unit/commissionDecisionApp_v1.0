"""Allow any AgendaSection.code on submissions, form types, and agenda items (not fixed enum)."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0090_agendasection_digitized_form"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pscformtype",
            name="agenda_category",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Agenda section code (AgendaSection.code). "
                    "Used to auto-categorize agenda items when a submission is added to a meeting."
                ),
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="submission",
            name="agenda_category",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Agenda section code (AgendaSection.code) chosen at lodge.",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="agendaitem",
            name="category",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Agenda section code (AgendaSection.code) for this item.",
                max_length=32,
            ),
        ),
    ]
