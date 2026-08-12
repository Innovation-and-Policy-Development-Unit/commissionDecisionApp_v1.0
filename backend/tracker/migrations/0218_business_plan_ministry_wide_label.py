"""
A Ministry Business Plan (PSC 2-5) combines and consolidates the business
plans of every department within the ministry into one submission — it's
not a single department's plan. The digitized form's first field asked for
a single "Department / Organization Name", which contradicted that and
implied the submission belongs to one department. Relabels it to reflect
the ministry-wide, all-departments-combined scope.
"""
from django.db import migrations

FORM_TYPE_CODE = 'BUSINESS-PLAN'
FIELD_KEY = 'department_name'

NEW_LABEL = 'Departments Included in this Plan'
NEW_HELP_TEXT = (
    "List every department within the ministry whose business plan is combined "
    "into this submission."
)
NEW_PLACEHOLDER = (
    "e.g. Department of Finance and Treasury; Department of Customs and Inland Revenue; "
    "Vanuatu Bureau of Statistics"
)

OLD_LABEL = 'Department / Organization Name'
OLD_HELP_TEXT = ''
OLD_PLACEHOLDER = 'Full name of the department'


def apply_relabel(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()
    if not form_type:
        return
    PSCFormField.objects.filter(form_type=form_type, field_key=FIELD_KEY).update(
        label=NEW_LABEL, help_text=NEW_HELP_TEXT, placeholder=NEW_PLACEHOLDER,
    )


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()
    if not form_type:
        return
    PSCFormField.objects.filter(form_type=form_type, field_key=FIELD_KEY).update(
        label=OLD_LABEL, help_text=OLD_HELP_TEXT, placeholder=OLD_PLACEHOLDER,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0217_corporate_plan_field_pagination'),
    ]

    operations = [
        migrations.RunPython(apply_relabel, revert),
    ]
