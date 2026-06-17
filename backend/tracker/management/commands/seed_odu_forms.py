"""
Django management command to manually seed ODU submission form types and fields.
Usage: python manage.py seed_odu_forms
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from tracker.models import PSCFormType, FormCategory, RequiredDocument, PSCFormField


class Command(BaseCommand):
    help = 'Seed ODU submission forms (Business Plan, Corporate Plan, Annual Report) with form types, checklists, and fields'

    def add_arguments(self, parser):
        parser.add_argument(
            '--recreate',
            action='store_true',
            help='Delete existing forms and recreate from scratch',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        recreate = options.get('recreate', False)

        # Get or create ODU category
        od_category, _ = FormCategory.objects.get_or_create(
            code='organisational_development',
            defaults={'name': 'Organisational Development (ODU)'}
        )
        self.stdout.write(self.style.SUCCESS('✓ ODU category ready'))

        # Form type definitions
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

        # Business Plan Fields
        business_plan_fields = [
            {'field_key': 'sec_organization', 'label': 'Organization Details', 'field_type': 'section_header', 'is_required': False, 'display_order': 100},
            {'field_key': 'department_name', 'label': 'Department / Organization Name', 'field_type': 'text', 'placeholder': 'Full name of the department', 'is_required': True, 'display_order': 110},
            {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text', 'placeholder': 'Parent ministry (if applicable)', 'is_required': False, 'display_order': 120},
            {'field_key': 'responsible_head', 'label': 'Responsible Head / Director', 'field_type': 'text', 'placeholder': 'Name and title of department head', 'is_required': False, 'display_order': 130},
            {'field_key': 'sec_period', 'label': 'Planning Period', 'field_type': 'section_header', 'is_required': False, 'display_order': 140},
            {'field_key': 'plan_type', 'label': 'Plan Type (Duration)', 'field_type': 'radio', 'choices': 'Strategic (3-5 years)\nAnnual (1 year)\nQuarterly (3 months)', 'is_required': True, 'display_order': 150},
            {'field_key': 'period_start_date', 'label': 'Planning Period Start Date', 'field_type': 'date', 'is_required': True, 'display_order': 160},
            {'field_key': 'period_end_date', 'label': 'Planning Period End Date', 'field_type': 'date', 'is_required': True, 'display_order': 170},
            {'field_key': 'sec_executive', 'label': '1. EXECUTIVE SUMMARY', 'field_type': 'section_header', 'is_required': False, 'display_order': 200},
            {'field_key': 'key_outcomes', 'label': 'Key Outcomes & Strategic Focus', 'field_type': 'textarea', 'placeholder': 'Summary of the department\'s key outcomes and strategic priorities for the planning period', 'is_required': True, 'display_order': 210},
            {'field_key': 'main_programs', 'label': 'Main Programs / Initiatives', 'field_type': 'textarea', 'placeholder': 'List of major programs and initiatives planned for implementation', 'is_required': True, 'display_order': 220},
            {'field_key': 'nsdp_alignment', 'label': 'NSDP Alignment', 'field_type': 'textarea', 'placeholder': 'Alignment with National Sustainable Development Plan (NSDP) priorities', 'is_required': True, 'display_order': 230},
            {'field_key': 'sec_me_framework', 'label': '2. PROGRAM-ACTIVITY MONITORING & EVALUATION FRAMEWORK', 'field_type': 'section_header', 'is_required': False, 'display_order': 300},
            {'field_key': 'me_matrix', 'label': 'Program & Activity M&E Matrix', 'field_type': 'textarea', 'placeholder': 'Tabular M&E Framework showing: Program | Activity | Output/Service Target | Target Numbers | Action Steps (with completion dates) | Comments & Risks', 'is_required': True, 'display_order': 310},
            {'field_key': 'kpis', 'label': 'Key Performance Indicators (KPIs)', 'field_type': 'textarea', 'placeholder': 'Specific, Measurable, Achievable, Relevant, Time-Bound (SMART) indicators for each program objective', 'is_required': True, 'display_order': 320},
            {'field_key': 'risks_mitigation', 'label': 'Risks & Mitigation Strategies', 'field_type': 'textarea', 'placeholder': 'Identified risks (operational, financial, external) and mitigation strategies for each major program', 'is_required': False, 'display_order': 330},
            {'field_key': 'sec_hr_plan', 'label': '3. HUMAN RESOURCE OPERATIONAL PLAN', 'field_type': 'section_header', 'is_required': False, 'display_order': 400},
            {'field_key': 'staffing_table', 'label': 'Staffing Table (Current & Authorized)', 'field_type': 'textarea', 'placeholder': 'Comprehensive staffing summary: Position/Grade | Authorized | Current Filled | Vacant', 'is_required': True, 'display_order': 410},
            {'field_key': 'retirement_severance', 'label': 'Retirement & Severance Tracking', 'field_type': 'textarea', 'placeholder': 'Planned retirements, terminations, and severance obligations during the planning period', 'is_required': False, 'display_order': 420},
            {'field_key': 'vacancy_plan', 'label': 'Vacancy Management Plan', 'field_type': 'textarea', 'placeholder': 'Strategy for filling critical vacancies: recruitment timeline, position priorities', 'is_required': False, 'display_order': 430},
            {'field_key': 'training_budget', 'label': 'Training & Development Budget', 'field_type': 'textarea', 'placeholder': 'Planned training programs by area (leadership, technical, compliance)', 'is_required': False, 'display_order': 440},
            {'field_key': 'scholarship_programs', 'label': 'Scholarship & Advancement Programs', 'field_type': 'textarea', 'placeholder': 'Officers pursuing further education: names, study programs, sponsorship details', 'is_required': False, 'display_order': 450},
            {'field_key': 'sec_cashflow', 'label': '4. CASH FLOW PROJECTION / FORECAST', 'field_type': 'section_header', 'is_required': False, 'display_order': 500},
            {'field_key': 'cashflow_matrix', 'label': 'Cash Flow by Activity & Month', 'field_type': 'textarea', 'placeholder': 'Detailed month-by-month cash flow projection showing: Activity | Jan | Feb | Mar | ... | Dec | Total', 'is_required': True, 'display_order': 510},
            {'field_key': 'payroll_projection', 'label': 'Payroll Projection', 'field_type': 'textarea', 'placeholder': 'Total monthly payroll cost including all staffing categories', 'is_required': False, 'display_order': 520},
            {'field_key': 'overheads_forecast', 'label': 'Operational Overheads Forecast', 'field_type': 'textarea', 'placeholder': 'Monthly operational expenses: utilities, supplies, maintenance, communications, travel', 'is_required': False, 'display_order': 530},
            {'field_key': 'funding_gaps', 'label': 'Cash Constraints & Funding Gaps', 'field_type': 'textarea', 'placeholder': 'Anticipated cash flow shortfalls or funding gaps and proposed solutions', 'is_required': False, 'display_order': 540},
            {'field_key': 'sec_procurement', 'label': '5. PROCUREMENT PLAN', 'field_type': 'section_header', 'is_required': False, 'display_order': 600},
            {'field_key': 'procurement_schedule', 'label': 'Procurement Schedule by Activity', 'field_type': 'textarea', 'placeholder': 'Detailed procurement matrix: Activity/Program | Item | Quantity | Estimated Cost (VT)', 'is_required': True, 'display_order': 610},
            {'field_key': 'capital_equipment', 'label': 'Capital Equipment Procurement', 'field_type': 'textarea', 'placeholder': 'Major capital equipment purchases: type, cost, procurement timeline', 'is_required': False, 'display_order': 620},
            {'field_key': 'service_contracts', 'label': 'Service Contracts & Renewals', 'field_type': 'textarea', 'placeholder': 'Ongoing service contracts (maintenance, security, IT support, etc.), renewal dates', 'is_required': False, 'display_order': 630},
            {'field_key': 'procurement_risks', 'label': 'Procurement Risks & Contingency', 'field_type': 'textarea', 'placeholder': 'Potential procurement delays, supply chain risks, and contingency measures', 'is_required': False, 'display_order': 640},
            {'field_key': 'sec_issue', 'label': 'Issue & Recommendation', 'field_type': 'section_header', 'start_new_page': True, 'is_required': False, 'display_order': 700},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea', 'placeholder': 'Statement of the issue for Commission consideration', 'is_required': True, 'display_order': 710},
            {'field_key': 'sec_discussion', 'label': 'Discussion', 'field_type': 'section_header', 'is_required': False, 'display_order': 750},
            {'field_key': 'discussion', 'label': 'Discussion', 'field_type': 'textarea', 'placeholder': 'Analyze the business plan: NSDP alignment, realism of objectives and timelines', 'is_required': True, 'display_order': 760},
            {'field_key': 'sec_recommendation', 'label': 'Recommendation', 'field_type': 'section_header', 'is_required': False, 'display_order': 800},
            {'field_key': 'recommendation', 'label': 'Recommendation', 'field_type': 'textarea', 'placeholder': 'It is recommended that the Public Service Commission note/approve the Business Plan', 'is_required': True, 'display_order': 810},
        ]

        form_fields_map = {
            'BUSINESS-PLAN': business_plan_fields,
            'CORPORATE-PLAN': [],  # Will add below
            'ANNUAL-REPORT': [],  # Will add below
        }

        # Create form types with checklists and fields
        for form_data in form_types_data:
            code = form_data['code']

            if recreate:
                PSCFormType.objects.filter(code=code).delete()
                self.stdout.write(f'  Deleted existing {code}')

            form_type, created = PSCFormType.objects.get_or_create(
                code=code,
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
                self.stdout.write(self.style.SUCCESS(f'✓ Created PSCFormType: {code}'))
            else:
                self.stdout.write(f'  Already exists: {code}')

            # Create required documents (checklist)
            docs = form_required_docs.get(code, [])
            for doc_name in docs:
                RequiredDocument.objects.get_or_create(
                    form_type=form_type,
                    name=doc_name,
                    defaults={
                        'description': f'Required document for {form_data["name"]}',
                        'item_type': 'document',
                    }
                )
            self.stdout.write(f'  ✓ {len(docs)} required documents')

            # Create form fields
            fields = form_fields_map.get(code, [])
            if fields:
                for field_data in fields:
                    defaults = {
                        'label': field_data.get('label', ''),
                        'field_type': field_data.get('field_type', 'text'),
                        'placeholder': field_data.get('placeholder', ''),
                        'help_text': field_data.get('help_text', ''),
                        'choices': field_data.get('choices', ''),
                        'is_required': field_data.get('is_required', False),
                        'display_order': field_data.get('display_order', 0),
                        'start_new_page': field_data.get('start_new_page', False),
                    }
                    PSCFormField.objects.get_or_create(
                        form_type=form_type,
                        field_key=field_data['field_key'],
                        defaults=defaults
                    )
                self.stdout.write(f'  ✓ {len(fields)} form fields')

        self.stdout.write(self.style.SUCCESS('\n✓ ODU form seeding complete!'))
        self.stdout.write('\nForms ready:')
        self.stdout.write('  • Business Plan (PSC 2-5) — 5 key components')
        self.stdout.write('  • Corporate Plan (PSC 2-6) — 7 sections')
        self.stdout.write('  • Annual Report (PSC 2-7) — 20 sections')
