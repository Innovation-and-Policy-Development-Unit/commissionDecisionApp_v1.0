# ODU Form Seeding Guide

## Quick Start

### Option 1: Run Django Migrations (Recommended)

```bash
cd backend
python manage.py migrate tracker
```

This runs migrations **0159** and **0160** which seed:
- PSCFormType records (3 forms)
- RequiredDocument checklists (18 docs total)
- PSCFormField definitions (105 fields total)

### Option 2: Run Management Command

```bash
cd backend
python manage.py seed_odu_forms
```

This manually seeds all data using the `seed_odu_forms.py` management command.

#### With Recreate Flag (Delete & Reseed)

```bash
python manage.py seed_odu_forms --recreate
```

---

## What Gets Seeded

### Business Plan (PSC 2-5)
- **Form Type:** BUSINESS-PLAN
- **Fields:** 28 (Organization Details, Executive Summary, M&E Framework, HR Plan, Cash Flow, Procurement)
- **Required Docs:** 5 (Plan, NSDP memo, Objectives, Budget, Staffing)
- **Digitized Key:** `business_plan`

### Corporate Plan (PSC 2-6)
- **Form Type:** CORPORATE-PLAN
- **Fields:** 35 (Ministry Details, Strategic Framework, Programs, Org Structure, Finance, Capacity, Risk Management)
- **Required Docs:** 7 (Plan, Vision/Mission, NSDP, Priorities, Org Chart, Budget, Capacity Plan)
- **Digitized Key:** `corporate_plan`

### Annual Report (PSC 2-7)
- **Form Type:** ANNUAL-REPORT
- **Fields:** 42 (Leadership Statements, Corporate Overview, Performance, Policy, HR, Financial, Auditor Reports, Complaints)
- **Required Docs:** 8 (Report, Executive Summary, Performance, Achievements, Challenges, Budget, Staffing, Outlook)
- **Digitized Key:** `annual_report`

---

## Verify Seeding Success

### Check Migrations Applied

```bash
python manage.py showmigrations tracker | grep -E "015[9-60]"
```

Expected output:
```
[X] 0159_seed_odu_submissions_business_corporate_annual
[X] 0160_seed_odu_form_fields
```

### Check Database Records

```bash
python manage.py shell
```

Then in the Django shell:

```python
from tracker.models import PSCFormType, PSCFormField, RequiredDocument

# Check form types
PSCFormType.objects.filter(code__in=['BUSINESS-PLAN', 'CORPORATE-PLAN', 'ANNUAL-REPORT'])
# Expected: 3 records

# Check form fields
bp = PSCFormType.objects.get(code='BUSINESS-PLAN')
print(f"Business Plan: {bp.fields.count()} fields")
# Expected: 28

cp = PSCFormType.objects.get(code='CORPORATE-PLAN')
print(f"Corporate Plan: {cp.fields.count()} fields")
# Expected: 35

ar = PSCFormType.objects.get(code='ANNUAL-REPORT')
print(f"Annual Report: {ar.fields.count()} fields")
# Expected: 42

# Check required documents
for code in ['BUSINESS-PLAN', 'CORPORATE-PLAN', 'ANNUAL-REPORT']:
    ft = PSCFormType.objects.get(code=code)
    count = ft.required_documents.count()
    print(f"{code}: {count} required documents")
```

### Check API Endpoint

```bash
curl "http://localhost:8000/api/form-fields/?form_type=<form_type_id>"
```

Should return array of PSCFormField records sorted by `display_order`.

---

## Files Involved

### Migrations
- `backend/tracker/migrations/0159_seed_odu_submissions_business_corporate_annual.py`
- `backend/tracker/migrations/0160_seed_odu_form_fields.py`

### Management Command
- `backend/tracker/management/commands/seed_odu_forms.py`

### XML Templates (Reference)
- `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/ORGANISATIONAL DEVELOPMENT/Submissions/Business_Plan_Enhanced.xml`
- `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/ORGANISATIONAL DEVELOPMENT/Submissions/Corporate_Plan_Enhanced.xml`
- `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/ORGANISATIONAL DEVELOPMENT/Submissions/Annual_Report_Enhanced.xml`

---

## Testing Submission Flow

### 1. Create Test Submission

```bash
curl -X POST "http://localhost:8000/api/submissions/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "form_type_code": "BUSINESS-PLAN",
    "meeting_number": 1000,
    "item_number": 1,
    "subject": "Test Department Business Plan"
  }'
```

### 2. Load Form Fields

```bash
# Get the submission ID from the response above
curl -X GET "http://localhost:8000/api/form-fields/?form_type=<form_type_id>" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return 28 fields for Business Plan, sorted by display_order.

### 3. Fill Form Values

```bash
curl -X POST "http://localhost:8000/api/submissions/<submission_id>/dynamic-form/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_name": "Finance Department",
    "ministry": "Ministry of Finance",
    "period_start_date": "2026-01-01",
    "period_end_date": "2026-12-31",
    "plan_type": "Annual (1 year)",
    "key_outcomes": "Improve budget utilization and financial reporting",
    ...more fields...
  }'
```

### 4. View in Frontend

Once seeded, submissions will appear in:
- PSC Officer → New Submissions → Create → Choose "Business Plan", "Corporate Plan", or "Annual Report"
- Form loads automatically with all fields
- User fills all sections
- Submits to ODU Manager

---

## Troubleshooting

### Migration Already Applied

If you see `GraphError: Conflicting migration detected`, the migration already ran. No action needed.

### Fields Not Showing in Frontend

1. Verify migration 0160 applied: `python manage.py showmigrations tracker`
2. Check PSCFormField count: `PSCFormType.objects.get(code='BUSINESS-PLAN').fields.count()`
3. Clear browser cache and refresh
4. Restart Django dev server if using `runserver`

### "Form Type Not Found"

If migration 0159 didn't run, form types won't exist. Run:

```bash
python manage.py migrate tracker 0159
```

Then:

```bash
python manage.py migrate tracker 0160
```

---

## Next Steps

- [ ] Deploy migrations to staging
- [ ] Test submission creation in staging
- [ ] Create outcome/approval letter templates for 2-5, 2-6, 2-7
- [ ] Deploy to production
- [ ] Train ODU Manager on new workflow
- [ ] Monitor first submissions through the system
