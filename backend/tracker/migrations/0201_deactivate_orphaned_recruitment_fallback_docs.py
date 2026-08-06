"""
Migrations 0156/0157 seeded 9 category-level RequiredDocument rows for
RECRUIT-CONFIRM/RECRUIT-DIRECT ("Confirmation: ..."/"Direct Appointment: ...")
and 0157 was meant to deactivate them once form-type-specific RequiredDocument
rows took over (see 0157's RECRUIT-CONFIRM/RECRUIT-DIRECT entries). 0157's
cleanup filtered on form_category=<RECRUITMENT category>, but these 9 rows
actually have form_category_id=NULL in the DB, so the filter never matched
and they stayed is_active=True.

Per RequiredDocument's docstring, form_type=NULL and form_category=NULL means
"applies to every submission" — so these 9 rows have been silently acting as
a global fallback checklist for any submission whose form type has no
dedicated RequiredDocument rows. This caused the ORG-3.1 restructure
checklist bug fixed in migration 0200.

Deactivate (not delete — SubmissionChecklistItem.document is a PROTECT FK)
these specific orphaned rows. Confirmed against the dev DB: exactly 9 rows
(ids 59-67), all form_type_id=NULL, form_category_id=NULL, is_active=True.
"""
from django.db import migrations

NAME_PREFIXES = ('Confirmation: ', 'Direct Appointment: ')


def _orphaned_docs(RequiredDocument):
    from django.db.models import Q
    prefix_filter = Q()
    for prefix in NAME_PREFIXES:
        prefix_filter |= Q(name__startswith=prefix)
    return RequiredDocument.objects.filter(
        form_type__isnull=True,
        form_category__isnull=True,
    ).filter(prefix_filter)


def deactivate(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    _orphaned_docs(RequiredDocument).update(is_active=False)


def reactivate(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    _orphaned_docs(RequiredDocument).update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0200_org_3_1_required_documents_odu_confirmed'),
    ]

    operations = [
        migrations.RunPython(deactivate, reactivate),
    ]
