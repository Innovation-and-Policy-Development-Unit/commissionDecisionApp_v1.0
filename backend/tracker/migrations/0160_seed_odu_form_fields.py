"""
Seed form fields for ODU submissions: Business Plan, Corporate Plan, Annual Report
PSC 2-5, 2-6, 2-7 — Enhanced templates with detailed field definitions from government guidelines
"""

from django.db import migrations

# ════════════════════════════════════════════════════════════════════════════════
# BUSINESS PLAN (PSC 2-5) FORM FIELDS
# ════════════════════════════════════════════════════════════════════════════════
BUSINESS_PLAN_FIELDS = [
    # 1. Organization & Planning Details
    {'field_key': 'sec_organization', 'label': 'Organization Details', 'field_type': 'section_header', 'is_required': False, 'display_order': 100},
    {'field_key': 'department_name', 'label': 'Department / Organization Name', 'field_type': 'text', 'placeholder': 'Full name of the department', 'is_required': True, 'display_order': 110},
    {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text', 'placeholder': 'Parent ministry (if applicable)', 'is_required': False, 'display_order': 120},
    {'field_key': 'responsible_head', 'label': 'Responsible Head / Director', 'field_type': 'text', 'placeholder': 'Name and title of department head', 'is_required': False, 'display_order': 130},
    {'field_key': 'sec_period', 'label': 'Planning Period', 'field_type': 'section_header', 'is_required': False, 'display_order': 140},
    {'field_key': 'plan_type', 'label': 'Plan Type (Duration)', 'field_type': 'radio', 'choices': 'Strategic (3-5 years)\nAnnual (1 year)\nQuarterly (3 months)', 'is_required': True, 'display_order': 150},
    {'field_key': 'period_start_date', 'label': 'Planning Period Start Date', 'field_type': 'date', 'is_required': True, 'display_order': 160},
    {'field_key': 'period_end_date', 'label': 'Planning Period End Date', 'field_type': 'date', 'is_required': True, 'display_order': 170},

    # 2. Executive Summary
    {'field_key': 'sec_executive', 'label': '1. EXECUTIVE SUMMARY', 'field_type': 'section_header', 'is_required': False, 'display_order': 200},
    {'field_key': 'key_outcomes', 'label': 'Key Outcomes & Strategic Focus', 'field_type': 'textarea', 'placeholder': 'Summary of the department\'s key outcomes and strategic priorities for the planning period', 'is_required': True, 'display_order': 210},
    {'field_key': 'main_programs', 'label': 'Main Programs / Initiatives', 'field_type': 'textarea', 'placeholder': 'List of major programs and initiatives planned for implementation', 'is_required': True, 'display_order': 220},
    {'field_key': 'nsdp_alignment', 'label': 'NSDP Alignment', 'field_type': 'textarea', 'placeholder': 'Alignment with National Sustainable Development Plan (NSDP) priorities', 'is_required': True, 'display_order': 230},

    # 3. Program/Activity M&E Framework
    {'field_key': 'sec_me_framework', 'label': '2. PROGRAM-ACTIVITY MONITORING & EVALUATION FRAMEWORK', 'field_type': 'section_header', 'is_required': False, 'display_order': 300},
    {'field_key': 'me_matrix', 'label': 'Program & Activity M&E Matrix', 'field_type': 'textarea', 'placeholder': 'Program | Activity | Target | Numbers | Action Steps | Risks. Core planning document.', 'is_required': True, 'display_order': 310},
    {'field_key': 'kpis', 'label': 'Key Performance Indicators (KPIs)', 'field_type': 'textarea', 'placeholder': 'Specific, Measurable, Achievable, Relevant, Time-Bound (SMART) indicators for each program objective', 'is_required': True, 'display_order': 320},
    {'field_key': 'risks_mitigation', 'label': 'Risks & Mitigation Strategies', 'field_type': 'textarea', 'placeholder': 'Identified risks (operational, financial, external) and mitigation strategies for each major program', 'is_required': False, 'display_order': 330},

    # 4. Human Resource Operational Plan
    {'field_key': 'sec_hr_plan', 'label': '3. HUMAN RESOURCE OPERATIONAL PLAN', 'field_type': 'section_header', 'is_required': False, 'display_order': 400},
    {'field_key': 'staffing_table', 'label': 'Staffing Table (Current & Authorized)', 'field_type': 'textarea', 'placeholder': 'Position | Authorized | Filled | Vacant (by gender, language group)', 'is_required': True, 'display_order': 410},
    {'field_key': 'retirement_severance', 'label': 'Retirement & Severance Tracking', 'field_type': 'textarea', 'placeholder': 'Planned retirements, terminations, and severance obligations during the planning period', 'is_required': False, 'display_order': 420},
    {'field_key': 'vacancy_plan', 'label': 'Vacancy Management Plan', 'field_type': 'textarea', 'placeholder': 'Strategy for filling critical vacancies: recruitment timeline, position priorities, anticipated hiring constraints', 'is_required': False, 'display_order': 430},
    {'field_key': 'training_budget', 'label': 'Training & Development Budget', 'field_type': 'textarea', 'placeholder': 'Planned training programs by area (leadership, technical, compliance), budget allocation, and expected participant numbers disaggregated by gender/language group', 'is_required': False, 'display_order': 440},
    {'field_key': 'scholarship_programs', 'label': 'Scholarship & Advancement Programs', 'field_type': 'textarea', 'placeholder': 'Officers pursuing further education: names, study programs, sponsorship details, expected completion dates', 'is_required': False, 'display_order': 450},

    # 5. Cash Flow Projection
    {'field_key': 'sec_cashflow', 'label': '4. CASH FLOW PROJECTION / FORECAST', 'field_type': 'section_header', 'is_required': False, 'display_order': 500},
    {'field_key': 'cashflow_matrix', 'label': 'Cash Flow by Activity & Month', 'field_type': 'textarea', 'placeholder': 'Detailed month-by-month cash flow projection showing: Activity | Jan | Feb | Mar | ... | Dec | Total. Separate rows for payroll, operational expenses, and capital expenditure. Include cumulative total line.', 'is_required': True, 'display_order': 510},
    {'field_key': 'payroll_projection', 'label': 'Payroll Projection', 'field_type': 'textarea', 'placeholder': 'Total monthly payroll cost including all staffing categories (permanent, contract, etc.) and anticipated adjustments', 'is_required': False, 'display_order': 520},
    {'field_key': 'overheads_forecast', 'label': 'Operational Overheads Forecast', 'field_type': 'textarea', 'placeholder': 'Monthly operational expenses: utilities, supplies, maintenance, communications, travel, etc.', 'is_required': False, 'display_order': 530},
    {'field_key': 'funding_gaps', 'label': 'Cash Constraints & Funding Gaps', 'field_type': 'textarea', 'placeholder': 'Anticipated cash flow shortfalls or funding gaps and proposed solutions', 'is_required': False, 'display_order': 540},

    # 6. Procurement Plan
    {'field_key': 'sec_procurement', 'label': '5. PROCUREMENT PLAN', 'field_type': 'section_header', 'is_required': False, 'display_order': 600},
    {'field_key': 'procurement_schedule', 'label': 'Procurement Schedule by Activity', 'field_type': 'textarea', 'placeholder': 'Activity | Item | Quantity | Cost (VT) | Timeline | Supplier', 'is_required': True, 'display_order': 610},
    {'field_key': 'capital_equipment', 'label': 'Capital Equipment Procurement', 'field_type': 'textarea', 'placeholder': 'Major capital equipment purchases: type, cost, procurement timeline, functional area impact', 'is_required': False, 'display_order': 620},
    {'field_key': 'service_contracts', 'label': 'Service Contracts & Renewals', 'field_type': 'textarea', 'placeholder': 'Ongoing service contracts (maintenance, security, IT support, etc.), renewal dates, and cost implications', 'is_required': False, 'display_order': 630},
    {'field_key': 'procurement_risks', 'label': 'Procurement Risks & Contingency', 'field_type': 'textarea', 'placeholder': 'Potential procurement delays, supply chain risks, and contingency measures', 'is_required': False, 'display_order': 640},

    # 7. Issue & Recommendation
    {'field_key': 'sec_issue', 'label': 'Issue & Recommendation', 'field_type': 'section_header', 'start_new_page': True, 'is_required': False, 'display_order': 700},
    {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea', 'placeholder': 'Statement of the issue for Commission consideration regarding the department\'s business plan and proposed resource requirements', 'is_required': True, 'display_order': 710},
    {'field_key': 'sec_discussion', 'label': 'Discussion', 'field_type': 'section_header', 'is_required': False, 'display_order': 750},
    {'field_key': 'discussion', 'label': 'Discussion', 'field_type': 'textarea', 'placeholder': 'Analyze the business plan: NSDP alignment, realism of objectives and timelines, adequacy of resources (human and financial), organizational capacity, risk management, and overall feasibility of implementation', 'is_required': True, 'display_order': 760},
    {'field_key': 'sec_recommendation', 'label': 'Recommendation', 'field_type': 'section_header', 'is_required': False, 'display_order': 800},
    {'field_key': 'recommendation', 'label': 'Recommendation', 'field_type': 'textarea', 'placeholder': 'It is recommended that the Public Service Commission note/approve the Business Plan for [department] for [planning period] and confirm/allocate the requested budget/resource allocation of VT [amount].', 'is_required': True, 'display_order': 810},
]

# ════════════════════════════════════════════════════════════════════════════════
# CORPORATE PLAN (PSC 2-6) FORM FIELDS
# ════════════════════════════════════════════════════════════════════════════════
CORPORATE_PLAN_FIELDS = [
    # 1. Ministry Details & Strategic Framework
    {'field_key': 'sec_ministry', 'label': 'Ministry Details', 'field_type': 'section_header', 'is_required': False, 'display_order': 100},
    {'field_key': 'ministry_name', 'label': 'Ministry Name', 'field_type': 'text', 'placeholder': 'Full official name of the ministry', 'is_required': True, 'display_order': 110},
    {'field_key': 'minister_name', 'label': 'Minister / Portfolio Head', 'field_type': 'text', 'placeholder': 'Name and portfolio', 'is_required': True, 'display_order': 120},
    {'field_key': 'ps_name', 'label': 'Permanent Secretary / Principal Secretary', 'field_type': 'text', 'placeholder': 'Name and title', 'is_required': True, 'display_order': 130},
    {'field_key': 'sec_period', 'label': 'Planning Period', 'field_type': 'section_header', 'is_required': False, 'display_order': 140},
    {'field_key': 'plan_duration', 'label': 'Plan Duration', 'field_type': 'text', 'placeholder': 'e.g. 5 years, 3 years', 'is_required': True, 'display_order': 150},
    {'field_key': 'period_start_date', 'label': 'Planning Period Start Date', 'field_type': 'date', 'is_required': True, 'display_order': 160},
    {'field_key': 'period_end_date', 'label': 'Planning Period End Date', 'field_type': 'date', 'is_required': True, 'display_order': 170},

    # 2. Strategic Framework
    {'field_key': 'sec_strategic', 'label': '1. STRATEGIC FRAMEWORK', 'field_type': 'section_header', 'is_required': False, 'display_order': 200},
    {'field_key': 'vision_statement', 'label': 'Vision Statement', 'field_type': 'textarea', 'placeholder': 'Aspirational vision of the ministry\'s future state and impact', 'is_required': True, 'display_order': 210},
    {'field_key': 'mission_statement', 'label': 'Mission Statement', 'field_type': 'textarea', 'placeholder': 'Core mission describing the ministry\'s primary purpose and role', 'is_required': True, 'display_order': 220},
    {'field_key': 'core_values', 'label': 'Core Values', 'field_type': 'textarea', 'placeholder': 'Guiding principles and values that define organizational culture', 'is_required': False, 'display_order': 230},
    {'field_key': 'nsdp_alignment', 'label': 'NSDP Alignment & Government Priorities', 'field_type': 'textarea', 'placeholder': 'How the ministry\'s strategic direction aligns with National Sustainable Development Plan pillars and government\'s development priorities', 'is_required': True, 'display_order': 240},

    # 3. Program Structure & Strategic Priorities
    {'field_key': 'sec_programs', 'label': '2. PROGRAM STRUCTURE & STRATEGIC PRIORITIES', 'field_type': 'section_header', 'is_required': False, 'display_order': 300},
    {'field_key': 'strategic_programs', 'label': 'Strategic Priority Programs (2-6 major programs)', 'field_type': 'textarea', 'placeholder': 'List of major strategic programs/pillars for the planning period. For each program: a) Program name b) Goal/objective c) Expected outcomes d) Key activities and deliverables e) Responsible unit/department', 'is_required': True, 'display_order': 310},
    {'field_key': 'program_activity_matrix', 'label': 'Program-Activity Alignment Matrix', 'field_type': 'textarea', 'placeholder': 'Program | Sub-programs | Activities | Targets | Unit | Timeline', 'is_required': True, 'display_order': 320},
    {'field_key': 'strategic_priorities', 'label': 'Strategic Priorities & Focus Areas', 'field_type': 'textarea', 'placeholder': 'Top 5-7 overarching strategic priorities covering the planning period', 'is_required': True, 'display_order': 330},
    {'field_key': 'kpis_by_program', 'label': 'Key Performance Indicators by Program', 'field_type': 'textarea', 'placeholder': 'SMART indicators for each program with annual targets', 'is_required': True, 'display_order': 340},

    # 4. Organizational Structure & Capacity
    {'field_key': 'sec_org', 'label': '3. ORGANIZATIONAL STRUCTURE & CAPACITY', 'field_type': 'section_header', 'is_required': False, 'display_order': 400},
    {'field_key': 'org_structure', 'label': 'Organizational Structure Overview', 'field_type': 'textarea', 'placeholder': 'Description of ministry structure: main departments/divisions, reporting lines, organizational hierarchy. Reference to attached organizational chart showing all units and positions.', 'is_required': True, 'display_order': 410},
    {'field_key': 'org_chart_reference', 'label': 'Organizational Chart Reference', 'field_type': 'text', 'placeholder': 'Reference to attached organizational chart as of [year]', 'is_required': True, 'display_order': 420},
    {'field_key': 'staffing_structure', 'label': 'Staffing Structure & Allocation', 'field_type': 'textarea', 'placeholder': 'PSC-approved staffing by grade. Authorized vs. filled vs. vacant (disaggregated)', 'is_required': True, 'display_order': 430},
    {'field_key': 'staffing_allocation', 'label': 'Total Approved Staffing Allocation', 'field_type': 'text', 'placeholder': 'Total number of approved positions', 'is_required': True, 'display_order': 440},
    {'field_key': 'capability_gaps', 'label': 'Critical Capability Gaps', 'field_type': 'textarea', 'placeholder': 'Identified skills gaps, critical expertise shortages, and implications for program delivery', 'is_required': False, 'display_order': 450},

    # 5. Resource Planning & Budget
    {'field_key': 'sec_resources', 'label': '4. FINANCIAL & RESOURCE PLANNING', 'field_type': 'section_header', 'is_required': False, 'display_order': 500},
    {'field_key': 'budget_allocation', 'label': 'Total Budget Allocation (VT) by Program', 'field_type': 'textarea', 'placeholder': 'Breakdown of proposed budget by strategic program: Program | Recurring Cost | Capital Investment | Total | % of Budget. Include justification for allocations.', 'is_required': True, 'display_order': 510},
    {'field_key': 'payroll_costs', 'label': 'Payroll & Personnel Costs', 'field_type': 'textarea', 'placeholder': 'Total annual payroll including all staffing categories, anticipated salary adjustments, benefits, and allowances', 'is_required': False, 'display_order': 520},
    {'field_key': 'operational_expenses', 'label': 'Operational Expenses & Overheads', 'field_type': 'textarea', 'placeholder': 'Recurrent operational costs: utilities, supplies, communications, travel, maintenance, insurance, etc.', 'is_required': False, 'display_order': 530},
    {'field_key': 'capital_investment', 'label': 'Capital Investment Program', 'field_type': 'textarea', 'placeholder': 'Capital projects and investments: infrastructure, equipment, technology systems. Include cost estimates, timeline, and expected impact.', 'is_required': False, 'display_order': 540},
    {'field_key': 'resource_gaps', 'label': 'Resource Gaps & Constraints', 'field_type': 'textarea', 'placeholder': 'Identified gaps between required and available resources (financial, human, technical), and proposed mitigation strategies', 'is_required': False, 'display_order': 550},

    # 6. Capacity Building & Development
    {'field_key': 'sec_capacity', 'label': '5. CAPACITY BUILDING & DEVELOPMENT PLAN', 'field_type': 'section_header', 'is_required': False, 'display_order': 600},
    {'field_key': 'training_programs', 'label': 'Staff Training & Development Programs', 'field_type': 'textarea', 'placeholder': 'Planned training by area (leadership, technical, compliance): program name, target participants (disaggregated by gender/language group), delivery method, cost, expected outcomes', 'is_required': False, 'display_order': 610},
    {'field_key': 'succession_planning', 'label': 'Professional Development & Succession Planning', 'field_type': 'textarea', 'placeholder': 'Strategies for developing high-potential staff, leadership pipeline, and succession planning for critical positions', 'is_required': False, 'display_order': 620},
    {'field_key': 'technology_upgrades', 'label': 'Technology & Systems Upgrades', 'field_type': 'textarea', 'placeholder': 'Planned investments in IT systems, digital transformation initiatives, automation, and related training requirements', 'is_required': False, 'display_order': 630},
    {'field_key': 'institutional_strengthening', 'label': 'Institutional Strengthening Initiatives', 'field_type': 'textarea', 'placeholder': 'Plans to strengthen organizational systems, processes, governance structures, and compliance frameworks', 'is_required': False, 'display_order': 640},

    # 7. Risk Management & Compliance
    {'field_key': 'sec_risk', 'label': '6. RISK MANAGEMENT & COMPLIANCE', 'field_type': 'section_header', 'is_required': False, 'display_order': 700},
    {'field_key': 'major_risks', 'label': 'Major Risks & Challenges', 'field_type': 'textarea', 'placeholder': 'Identified strategic, operational, financial, and external risks that could impact plan implementation. Include probability, impact, and mitigation strategies.', 'is_required': False, 'display_order': 710},
    {'field_key': 'risk_mitigation', 'label': 'Risk Mitigation Strategies', 'field_type': 'textarea', 'placeholder': 'Contingency measures and risk response plans for each major risk category', 'is_required': False, 'display_order': 720},
    {'field_key': 'compliance_requirements', 'label': 'Compliance & Legislative Requirements', 'field_type': 'textarea', 'placeholder': 'Key legislative requirements, regulatory compliance obligations, and governance frameworks that will guide implementation', 'is_required': False, 'display_order': 730},
    {'field_key': 'me_framework', 'label': 'Monitoring & Evaluation Framework', 'field_type': 'textarea', 'placeholder': 'Approach to monitoring and evaluating plan implementation: reporting mechanisms, performance tracking, review schedule, and accountability measures', 'is_required': False, 'display_order': 740},

    # 8. Issue & Recommendation
    {'field_key': 'sec_issue', 'label': '7. ISSUE & RECOMMENDATION', 'field_type': 'section_header', 'start_new_page': True, 'is_required': False, 'display_order': 800},
    {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea', 'placeholder': 'Statement of the issue for Commission consideration regarding the ministry\'s corporate plan and strategic direction, resource needs, and implementation implications', 'is_required': True, 'display_order': 810},
    {'field_key': 'sec_discussion', 'label': 'Discussion', 'field_type': 'section_header', 'is_required': False, 'display_order': 850},
    {'field_key': 'discussion', 'label': 'Discussion', 'field_type': 'textarea', 'placeholder': 'Analysis: NSDP alignment, objectives, resources, capacity, risks, feasibility', 'is_required': True, 'display_order': 860},
    {'field_key': 'sec_recommendation', 'label': 'Recommendation', 'field_type': 'section_header', 'is_required': False, 'display_order': 900},
    {'field_key': 'recommendation', 'label': 'Recommendation', 'field_type': 'textarea', 'placeholder': 'It is recommended that the Public Service Commission approve/note the [Duration]-year Corporate Plan for the [Ministry Name] and confirm allocation of the requested budget of VT [amount] for implementation of the strategic programs outlined therein.', 'is_required': True, 'display_order': 910},
]

# ════════════════════════════════════════════════════════════════════════════════
# ANNUAL REPORT (PSC 2-7) FORM FIELDS
# ════════════════════════════════════════════════════════════════════════════════
ANNUAL_REPORT_FIELDS = [
    # 1. Leadership Statements
    {'field_key': 'sec_minister_statement', 'label': '1. MINISTER\'S STATEMENT', 'field_type': 'section_header', 'is_required': False, 'display_order': 100},
    {'field_key': 'minister_statement', 'label': 'Minister\'s Statement', 'field_type': 'textarea', 'placeholder': 'Statement by the Minister confirming the report was prepared under PS Act subsection 20(1)(h) and includes Statement of Responsibility for financial statements', 'is_required': True, 'display_order': 110},
    {'field_key': 'sec_dg_statement', 'label': '2. DIRECTOR GENERAL\'S STATEMENT', 'field_type': 'section_header', 'is_required': False, 'display_order': 120},
    {'field_key': 'dg_statement', 'label': 'Director General\'s Statement', 'field_type': 'textarea', 'placeholder': 'Statement by the DG confirming report preparation and including overview of issues, progress, and ways forward', 'is_required': True, 'display_order': 130},
    {'field_key': 'dg_issues_table', 'label': 'Issues Overview Table', 'field_type': 'textarea', 'placeholder': 'Tabular format: Issue | Progress Made | Way Forward', 'is_required': False, 'display_order': 140},

    # 2. Corporate Structure & Overview
    {'field_key': 'sec_structure', 'label': '3. CORPORATE STRUCTURE', 'field_type': 'section_header', 'is_required': False, 'display_order': 200},
    {'field_key': 'org_chart_reference', 'label': 'Organization Chart (attached as document)', 'field_type': 'text', 'placeholder': 'Reference to attached organizational chart as of [year-end]', 'is_required': True, 'display_order': 210},
    {'field_key': 'structural_changes', 'label': 'Significant Structural Changes During Year', 'field_type': 'textarea', 'placeholder': 'Description of any major reorganizations, department mergers, or structural modifications', 'is_required': False, 'display_order': 220},
    {'field_key': 'sec_overview', 'label': '4. CORPORATE OVERVIEW', 'field_type': 'section_header', 'is_required': False, 'display_order': 230},
    {'field_key': 'ministry_functions', 'label': 'Ministry Functions', 'field_type': 'textarea', 'placeholder': 'Statement of core functions and mandate', 'is_required': True, 'display_order': 240},
    {'field_key': 'vision_statement', 'label': 'Vision Statement', 'field_type': 'textarea', 'is_required': True, 'display_order': 250},
    {'field_key': 'mission_statement', 'label': 'Mission Statement', 'field_type': 'textarea', 'is_required': True, 'display_order': 260},
    {'field_key': 'core_values', 'label': 'Core Values', 'field_type': 'textarea', 'is_required': False, 'display_order': 270},

    # 3. Performance Reporting
    {'field_key': 'sec_corporate_plan_perf', 'label': '5. PERFORMANCE AGAINST CORPORATE PLAN OBJECTIVES', 'field_type': 'section_header', 'is_required': False, 'display_order': 300},
    {'field_key': 'objectives_performance', 'label': 'Objective-by-Objective Performance Report', 'field_type': 'textarea', 'placeholder': 'Objective | Achievements | Difficulties | Solutions (tabular format)', 'is_required': True, 'display_order': 310},
    {'field_key': 'main_activities', 'label': 'Main Activities & Services Provided', 'field_type': 'textarea', 'placeholder': 'Summary of key programs/services, including disaster recovery initiatives and service impact data', 'is_required': True, 'display_order': 320},
    {'field_key': 'service_delivery', 'label': 'Service Delivery Improvements', 'field_type': 'textarea', 'placeholder': 'Highlight increased access to services (especially provinces), performance improvements, and metrics', 'is_required': False, 'display_order': 330},
    {'field_key': 'sec_adr_targets', 'label': '6. PERFORMANCE AGAINST ADR TARGETS (NSDP)', 'field_type': 'section_header', 'is_required': False, 'display_order': 340},
    {'field_key': 'adr_targets', 'label': 'Annual Development Report (ADR) Achievement', 'field_type': 'textarea', 'placeholder': 'Agency performance against ADR targets prescribed in the NSDP. Include target vs. actual metrics.', 'is_required': True, 'display_order': 350},
    {'field_key': 'sec_budget_narrative', 'label': '7. PERFORMANCE AGAINST BUDGET NARRATIVE', 'field_type': 'section_header', 'is_required': False, 'display_order': 360},
    {'field_key': 'budget_performance', 'label': 'Budget Narrative Performance Measures', 'field_type': 'textarea', 'placeholder': 'Progress achieved against each performance measure listed in the Ministry Budget Narrative. Reference specific measures and targets.', 'is_required': True, 'display_order': 370},

    # 4. Policy & Legislative
    {'field_key': 'sec_policy', 'label': '8. POLICY DEVELOPMENT', 'field_type': 'section_header', 'is_required': False, 'display_order': 400},
    {'field_key': 'policy_summary', 'label': 'New/Reviewed/Retired Policies', 'field_type': 'textarea', 'placeholder': 'Tabular form: Policy Name | Status (New/Reviewed/Retired) | Implementation Plan | Partner Agencies', 'is_required': False, 'display_order': 410},
    {'field_key': 'sec_legislation', 'label': '9. PORTFOLIO LEGISLATIVE FRAMEWORK', 'field_type': 'section_header', 'is_required': False, 'display_order': 420},
    {'field_key': 'legislation_changes', 'label': 'New Legislation & Transfers', 'field_type': 'textarea', 'placeholder': 'List new legislation passed/amended by Parliament during the year. Specify any transfers of responsibility for existing legislation.', 'is_required': False, 'display_order': 430},
    {'field_key': 'sec_conventions', 'label': '10. INTERNATIONAL CONVENTIONS', 'field_type': 'section_header', 'is_required': False, 'display_order': 440},
    {'field_key': 'conventions', 'label': 'New Conventions & Ratification Status', 'field_type': 'textarea', 'placeholder': 'Tabular form: Convention | Ratification Status | Implementation Progress. Include both new conventions and updates on existing ones.', 'is_required': False, 'display_order': 450},

    # 5. Human Resources
    {'field_key': 'sec_hr', 'label': '11. HUMAN RESOURCES SUMMARY', 'field_type': 'section_header', 'is_required': False, 'display_order': 500},
    {'field_key': 'staffing_data', 'label': 'Staffing Summary (disaggregated data)', 'field_type': 'textarea', 'placeholder': 'Total permanent, probationary, contract, daily-rated (by gender, language)', 'is_required': True, 'display_order': 510},
    {'field_key': 'cessation_data', 'label': 'Cessation of Employment', 'field_type': 'textarea', 'placeholder': 'Retirements, redundancies, terminations during the year. Include leave accrual and severance paid.', 'is_required': False, 'display_order': 520},
    {'field_key': 'compliance_report', 'label': 'Discipline & Compliance', 'field_type': 'textarea', 'placeholder': 'Summary of discipline cases, compliance issues, and outcomes during the year', 'is_required': False, 'display_order': 530},
    {'field_key': 'training_delivered', 'label': 'Training Delivered', 'field_type': 'textarea', 'placeholder': 'Description of training programs: area of study, subject, delivery agency, staff participation disaggregated by gender and language group', 'is_required': False, 'display_order': 540},
    {'field_key': 'scholarships', 'label': 'Scholarships', 'field_type': 'textarea', 'placeholder': 'Officers on scholarship during year: name, area of study, subject level, disaggregated by gender and language group', 'is_required': False, 'display_order': 550},
    {'field_key': 'equity_initiatives', 'label': 'Equity & Inclusivity Initiatives', 'field_type': 'textarea', 'placeholder': 'Summary of initiatives undertaken to improve equity and inclusivity in the Ministry', 'is_required': False, 'display_order': 560},

    # 6. Financial & Operational
    {'field_key': 'sec_risks', 'label': '12. RISKS & CHALLENGES', 'field_type': 'section_header', 'is_required': False, 'display_order': 600},
    {'field_key': 'major_risks', 'label': 'Major Emerging Issues & Challenges', 'field_type': 'textarea', 'placeholder': 'Economic, environmental, disaster-related, or operational challenges that affected the Ministry\'s work during the year', 'is_required': False, 'display_order': 610},
    {'field_key': 'sec_dev_projects', 'label': '13. DEVELOPMENT PROJECTS', 'field_type': 'section_header', 'is_required': False, 'display_order': 620},
    {'field_key': 'dev_projects', 'label': 'Technical Assistance & Major Projects', 'field_type': 'textarea', 'placeholder': 'Tabular format recommended: Project Name | Description | Status | Technical Assistance Agency (if applicable). Include major development projects and TA initiatives.', 'is_required': False, 'display_order': 630},
    {'field_key': 'sec_authorities', 'label': '14. STATUTORY AUTHORITIES & NON-STATUTORY BODIES', 'field_type': 'section_header', 'is_required': False, 'display_order': 640},
    {'field_key': 'statutory_authorities', 'label': 'Statutory Authorities', 'field_type': 'textarea', 'placeholder': 'List of statutory authorities/offices with indication of whether they produce their own Annual Reports', 'is_required': False, 'display_order': 650},
    {'field_key': 'non_statutory_bodies', 'label': 'Non-Statutory Bodies', 'field_type': 'textarea', 'placeholder': 'List of non-statutory bodies, government-owned companies for which the Ministry is parent body', 'is_required': False, 'display_order': 660},

    # 7. External Reviews & Accountability
    {'field_key': 'sec_auditor_general', 'label': '15. AUDITOR GENERAL REPORTS', 'field_type': 'section_header', 'is_required': False, 'display_order': 700},
    {'field_key': 'auditor_general_reports', 'label': 'Auditor General Reports Tabled', 'field_type': 'textarea', 'placeholder': 'List titles and tabling dates of reports by Auditor General during the year referring to the Ministry. Include summary of remedial actions taken.', 'is_required': False, 'display_order': 710},
    {'field_key': 'sec_ombudsman', 'label': '16. OMBUDSMAN REPORTS & RESPONSES', 'field_type': 'section_header', 'is_required': False, 'display_order': 720},
    {'field_key': 'ombudsman_response', 'label': 'Ombudsman Reports & Actions', 'field_type': 'textarea', 'placeholder': 'Tabular form: Report | Brief Description | Ministry Action Taken. Include all reports received during the year.', 'is_required': False, 'display_order': 730},
    {'field_key': 'sec_rti', 'label': '17. RIGHT TO INFORMATION REQUESTS', 'field_type': 'section_header', 'is_required': False, 'display_order': 740},
    {'field_key': 'rti_requests', 'label': 'RTI Requests Received', 'field_type': 'textarea', 'placeholder': 'Tabular form: Number of requests | Subject matter | Outcome | Response time. Summary of RTI Act compliance.', 'is_required': False, 'display_order': 750},
    {'field_key': 'sec_court_decisions', 'label': '18. COURT DECISIONS & LEGAL MATTERS', 'field_type': 'section_header', 'is_required': False, 'display_order': 760},
    {'field_key': 'court_decisions', 'label': 'Court Decisions & Legal Actions', 'field_type': 'textarea', 'placeholder': 'Summary of any court decisions, legal actions, or legal matters affecting the Ministry during the year', 'is_required': False, 'display_order': 770},
    {'field_key': 'sec_complaints', 'label': '19. COMPLAINTS & FEEDBACK MECHANISMS', 'field_type': 'section_header', 'is_required': False, 'display_order': 780},
    {'field_key': 'complaints_summary', 'label': 'Complaints Mechanism Summary', 'field_type': 'textarea', 'placeholder': 'Summary of complaints received, feedback mechanisms in place, and outcomes/resolutions', 'is_required': False, 'display_order': 790},
    {'field_key': 'sec_financial', 'label': '20. FINANCIAL STATEMENTS (to be attached)', 'field_type': 'section_header', 'is_required': False, 'display_order': 800},
    {'field_key': 'financial_note', 'label': 'Financial Statements Reference', 'field_type': 'textarea', 'placeholder': 'Note: The following financial statements are attached (generated from FMIS): Statement of Representation, Statement of Appropriation, Expense Summary Report, Statement of Commitments & Contingencies', 'is_required': True, 'display_order': 810},
]

# ════════════════════════════════════════════════════════════════════════════════
# MIGRATION FUNCTIONS
# ════════════════════════════════════════════════════════════════════════════════

def seed_odu_form_fields(apps, schema_editor):
    """Create PSCFormField records for Business Plan, Corporate Plan, and Annual Report."""
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_configs = [
        ('BUSINESS-PLAN', BUSINESS_PLAN_FIELDS, 'Business Plan'),
        ('CORPORATE-PLAN', CORPORATE_PLAN_FIELDS, 'Corporate Plan'),
        ('ANNUAL-REPORT', ANNUAL_REPORT_FIELDS, 'Annual Report'),
    ]

    for code, fields_list, name in form_configs:
        form_type = PSCFormType.objects.filter(code=code).first()
        if not form_type:
            print(f"✗ PSCFormType '{code}' not found — skipping field creation")
            continue

        for field_data in fields_list:
            # Defensively truncate to fit DB column limits:
            #   label/placeholder = varchar(255), help_text = varchar(500)
            defaults = {
                'label': field_data.get('label', '')[:255],
                'field_type': field_data.get('field_type', 'text'),
                'placeholder': field_data.get('placeholder', '')[:255],
                'help_text': field_data.get('help_text', '')[:500],
                'choices': field_data.get('choices', ''),
                'is_required': field_data.get('is_required', False),
                'display_order': field_data.get('display_order', 0),
                'start_new_page': field_data.get('start_new_page', False),
            }

            PSCFormField.objects.get_or_create(
                form_type=form_type,
                field_key=field_data['field_key'][:64],
                defaults=defaults
            )

        print(f"✓ Created {len(fields_list)} form fields for {name} ({code})")


def reverse_seed(apps, schema_editor):
    """Delete form fields for the 3 ODU submission types."""
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    codes = ['BUSINESS-PLAN', 'CORPORATE-PLAN', 'ANNUAL-REPORT']
    for code in codes:
        form_type = PSCFormType.objects.filter(code=code).first()
        if form_type:
            form_type.fields.all().delete()
            print(f"✓ Removed form fields for {code}")


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0159_seed_odu_submissions_business_corporate_annual'),
    ]

    operations = [
        migrations.RunPython(seed_odu_form_fields, reverse_seed),
    ]
