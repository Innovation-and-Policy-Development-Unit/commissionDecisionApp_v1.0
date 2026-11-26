from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0328_comment_field_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="feedbackcomment",
            name="image",
            field=models.ImageField(
                blank=True, null=True, upload_to="feedback/comment_images/",
                help_text="Screenshot pasted or attached to the note.",
            ),
        ),
        migrations.AlterField(
            model_name="feedbackcomment",
            name="body",
            field=models.TextField(blank=True),
        ),
    ]
