"""RequiredDocument item_type and mandatory_for_stage (no index renames)."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0084_minute_agenda_intake"),
    ]

    operations = [
        migrations.AddField(
            model_name="requireddocument",
            name="item_type",
            field=models.CharField(
                choices=[
                    ("document", "Required Document"),
                    ("procedural", "Procedural Task / Milestone"),
                ],
                default="document",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="requireddocument",
            name="mandatory_for_stage",
            field=models.CharField(
                blank=True,
                help_text="Block transition FROM this stage if this item is incomplete.",
                max_length=50,
                null=True,
            ),
        ),
        migrations.AlterModelOptions(
            name="requireddocument",
            options={
                "ordering": ["form_category", "form_type", "order", "name"],
                "verbose_name": "Required Document / Task",
                "verbose_name_plural": "Required Documents & Tasks",
            },
        ),
    ]
