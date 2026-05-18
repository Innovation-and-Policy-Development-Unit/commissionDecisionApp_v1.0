from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import tracker.models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0029_document_signature"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserSignature",
            fields=[
                ("id",         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image",      models.ImageField(upload_to=tracker.models._user_sig_path)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user",       models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="stored_signature", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
