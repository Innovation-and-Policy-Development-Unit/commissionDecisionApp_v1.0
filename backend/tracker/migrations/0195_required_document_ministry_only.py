from django.db import migrations, models


def mark_dg_endorsement_ministry_only(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    RequiredDocument.objects.filter(
        name__istartswith="DG's Endorsement"
    ).update(ministry_only=True)


def unmark(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    RequiredDocument.objects.filter(
        name__istartswith="DG's Endorsement"
    ).update(ministry_only=False)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0194_add_letter_template'),
    ]

    operations = [
        migrations.AddField(
            model_name='requireddocument',
            name='ministry_only',
            field=models.BooleanField(
                default=False,
                help_text="Only required for ministry-origin submissions (e.g. DG "
                          "endorsement letters). Skipped for OPSC-internal submissions "
                          "that follow the normal PSC route (e.g. CSU/ODU appointments "
                          "of OPSC staff), which have no Director-General step in their "
                          "workflow.",
            ),
        ),
        migrations.RunPython(mark_dg_endorsement_ministry_only, unmark),
    ]
