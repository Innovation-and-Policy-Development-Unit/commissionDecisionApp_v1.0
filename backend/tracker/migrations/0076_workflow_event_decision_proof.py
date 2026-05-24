from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0075_sitting_pack_session"),
    ]

    operations = [
        migrations.AddField(
            model_name="workflowevent",
            name="content_hash",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="SHA-256 of canonical decision snapshot (decision transitions only).",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="workflowevent",
            name="proof_payload",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Immutable JSON snapshot used to verify content_hash.",
            ),
        ),
    ]
