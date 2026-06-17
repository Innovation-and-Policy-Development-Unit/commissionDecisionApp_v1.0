"""
Seed ODU submissions for Business Plan, Corporate Plan, and Annual Report.
PSC 2-5, 2-6, 2-7
"""

from django.db import migrations


def seed_odu_submissions(apps, schema_editor):
    """
    Create PSCFormType and RequiredDocument for Business Plan, Corporate Plan, and Annual Report.
    """
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    FormCategory = apps.get_model('tracker', 'FormCategory')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    # Get or create ODU category
    od_category, _ = FormCategory.objects.get_or_create(
        code='organisational_development',
        defaults={'name': 'Organisational Development (ODU)'}
    )

    # Define the 3 form types
    form_types_data = [
        {
            'code': 'BUSINESS-PLAN',
            'name': 'Department Business Plan Submission',
            'description': 'PSC 2-5: Commission board submission for department business plan review and approval',
            'digitized_form_key': 'business_plan',
        },
        {
            'code': 'CORPORATE-PLAN',
            'name': 'Ministry Corporate Plan Submission',
            'description': 'PSC 2-6: Commission board submission for ministry corporate plan review and approval',
            'digitized_form_key': 'corporate_plan',
        },
        {
            'code': 'ANNUAL-REPORT',
            'name': 'Annual Report Submission',
            'description': 'PSC 2-7: Commission board submission of annual report for organizational performance review',
            'digitized_form_key': 'annual_report',
        },
    ]

    # Required documents for each form type
    form_required_docs = {
        'BUSINESS-PLAN': [
            'Signed business plan document',
            'NSDP alignment memo',
            'Strategic objectives summary',
            'Budget allocation proposal',
            'Staffing and capacity plan',
        ],
        'CORPORATE-PLAN': [
            'Signed corporate plan document',
            'Ministry vision and mission statements',
            'NSDP alignment statement',
            'Strategic priorities outline',
            'Organizational structure overview',
            'Budget and resource allocation',
            'Capacity building plan',
        ],
        'ANNUAL-REPORT': [
            'Annual report document',
            'Executive summary',
            'Performance against objectives summary',
            'Key achievements list',
            'Challenges and constraints summary',
            'Budget utilization report',
            'Staffing summary',
            'Outlook and next year focus',
        ],
    }

    # Create form types and associated required documents
    for form_data in form_types_data:
        form_type, created = PSCFormType.objects.get_or_create(
            code=form_data['code'],
            defaults={
                'name': form_data['name'],
                'description': form_data['description'],
                'form_category': od_category,
                'is_digitized': True,
                'digitized_form_key': form_data['digitized_form_key'],
                'is_active': True,
                'is_checklist': False,
            }
        )

        if created:
            print(f"✓ Created PSCFormType '{form_data['code']}'")

        # Create required documents for this form type
        docs = form_required_docs.get(form_data['code'], [])
        for idx, doc_name in enumerate(docs, start=1):
            RequiredDocument.objects.get_or_create(
                form_type=form_type,
                name=doc_name,
                defaults={
                    'description': f'Required document or report section for {form_data["name"]}',
                    'item_type': 'document',
                }
            )

        print(f"  - Added {len(docs)} required documents for {form_data['code']}")


def reverse_seed(apps, schema_editor):
    """Reverse: delete the 3 ODU form types and their documents."""
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    codes = ['BUSINESS-PLAN', 'CORPORATE-PLAN', 'ANNUAL-REPORT']
    for code in codes:
        form_type = PSCFormType.objects.filter(code=code).first()
        if form_type:
            form_type.delete()
            print(f"✓ Removed {code} form type and documents")


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0158_seed_special_skills_allowance_checklist'),
    ]

    operations = [
        migrations.RunPython(seed_odu_submissions, reverse_seed),
    ]
