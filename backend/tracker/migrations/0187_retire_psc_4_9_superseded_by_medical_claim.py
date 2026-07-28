"""
PSC 4-9 ("PSC Form 4-9: Medical Expenses Claim Form") is a non-digitized,
zero-field legacy placeholder for the exact same real-world form that
MEDICAL-CLAIM (added this session, fully digitized) now covers. Unlike the
PSC 3-x / PSC 4-x forms that remain genuinely distinct from the new
Recruitment/Cessation submission papers, this one is a direct, same-purpose
duplicate — retiring it (not deleting; one historical demo submission
references it) so it stops appearing as a confusing second option next to
Medical Claim in the ministry submission-type picker.
"""
from django.db import migrations


def retire(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code='PSC 4-9').update(is_active=False)


def unretire(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code='PSC 4-9').update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0186_agenda_category_for_new_form_types'),
    ]

    operations = [
        migrations.RunPython(retire, unretire),
    ]
