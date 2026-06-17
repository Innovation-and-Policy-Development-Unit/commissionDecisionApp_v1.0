"""
Seed Special Skills Allowance form type and required documents/checklist.
PSC 2-8: Request for Approval of Special Skills Allowance
"""

from django.db import migrations


def seed_special_skills_allowance(apps, schema_editor):
    """
    Create PSCFormType and RequiredDocument checklist for Special Skills Allowance (PSC 2-8).
    Based on PSSM Chapter 4, Section 4.2.10 requirements.
    """
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    FormCategory = apps.get_model('tracker', 'FormCategory')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    # Get or create the Organisational Development form category
    od_category, _ = FormCategory.objects.get_or_create(
        code='organisational_development',
        defaults={'name': 'Organisational Development (ODU)'}
    )

    # Create the Special Skills Allowance form type
    form_type, created = PSCFormType.objects.get_or_create(
        code='SPECIAL-SKILLS',
        defaults={
            'name': 'Request for Approval of Special Skills Allowance',
            'description': 'PSC 2-8: Commission board submission paper for approval of special skills allowance (PSSM 4.2.10)',
            'form_category': od_category,
            'is_digitized': True,
            'digitized_form_key': 'special_skills_allowance',
            'is_active': True,
            'is_checklist': False,
        }
    )

    if created:
        print("✓ Created PSCFormType 'SPECIAL-SKILLS'")

    # Define required documents/checklist items for Special Skills Allowance
    required_docs = [
        # Section A: Submission Documents
        {
            'name': 'A. Request letter from ministry/organization',
            'description': 'Letter from Minister or Director requesting approval of Special Skills Allowance for the named officer.',
        },
        {
            'name': 'A. Supporting letter from Director General / Head of Organization',
            'description': 'Letter from DG/head confirming the officer\'s assignment, specialized nature of duties, and endorsement of the request.',
        },
        {
            'name': 'A. Point Matrix assessment form',
            'description': 'ODU-completed PSC Point Matrix analysis showing total points and recommended allowance band (PSSM Table 4-16).',
        },
        {
            'name': 'A. Original PSC decision approving the assignment',
            'description': 'PSC Board decision letter or meeting minutes approving the temporary assignment or transfer.',
        },

        # Section B: Officer Information
        {
            'name': 'B. Officer CV or resume',
            'description': 'Current curriculum vitae demonstrating qualifications and expertise relevant to the assignment.',
        },
        {
            'name': 'B. Substantive position details',
            'description': 'Job description or contract for the officer\'s substantive position.',
        },
        {
            'name': 'B. Performance appraisal or HR record',
            'description': 'Recent performance review demonstrating officer suitability for the assignment.',
        },

        # Section C: Assignment Context & Justification
        {
            'name': 'C. Organizational context document',
            'description': 'Council of Ministers decision, legislative act, or policy directive establishing the need for the assignment.',
        },
        {
            'name': 'C. List of key tasks and responsibilities',
            'description': 'Detailed breakdown of the specialized tasks and responsibilities assigned during the special assignment period.',
        },
        {
            'name': 'C. Job description or TOR for special assignment',
            'description': 'Formal job description or terms of reference for the special assignment role.',
        },
        {
            'name': 'C. Consultant cost comparison',
            'description': 'Document showing equivalent cost if the work were contracted to external consultant.',
        },

        # Section D: Financial & Policy Compliance
        {
            'name': 'D. Confirmation of cost recovery/funding source',
            'description': 'Written confirmation that the requesting organization will fund the Special Skills Allowance.',
        },
        {
            'name': 'D. Financial impact statement',
            'description': 'Analysis of financial impact: Is the allowance time-bound? Does it create ongoing commitment?',
        },
        {
            'name': 'D. Budget capacity letter',
            'description': 'Letter from Finance or ministry confirming budget allocation/capacity to fund the allowance.',
        },
        {
            'name': 'D. PSSM Chapter 4 compliance statement',
            'description': 'Written analysis confirming consistency with PSSM Chapter 4, Section 4.2.10.',
        },
    ]

    # Create required documents
    for idx, doc_data in enumerate(required_docs, start=1):
        RequiredDocument.objects.get_or_create(
            form_type=form_type,
            name=doc_data['name'],
            defaults={
                'description': doc_data['description'],
                'item_type': 'document',
            }
        )

    print(f"✓ Created {len(required_docs)} required documents for Special Skills Allowance")


def reverse_seed(apps, schema_editor):
    """Reverse: delete Special Skills Allowance form type and documents."""
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    form_type = PSCFormType.objects.filter(code='SPECIAL-SKILLS').first()
    if form_type:
        form_type.delete()
        print("✓ Removed Special Skills Allowance form type and documents")


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0157_seed_recruitment_submission_paper_types'),
    ]

    operations = [
        migrations.RunPython(seed_special_skills_allowance, reverse_seed),
    ]
