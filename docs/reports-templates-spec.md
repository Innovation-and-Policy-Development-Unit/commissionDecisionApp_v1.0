# Reports — Template Management & Generation Spec

> **Status:** P1 IMPLEMENTED (pending `migrate` + test run in a Python/Quarto env).
> Global admin-managed templates, guided-builder only, reusing the SmartReport Quarto
> engine. Ad-hoc NL generation removed from Reports (retained internally for Intelligence).
> **Decisions on file:** Guided-builder templates **only** (no `.qmd` upload → no remote
> code execution). **Global, admin-managed** template catalog with role/all visibility.
> **Reuses** the SmartReport Quarto engine already shipped (see
> `docs/smart-reports-enterprise-spec.md`). Ad-hoc exploration moves to **SCDMS
> Intelligence** (`docs/scdms-intelligence-explorer-spec.md`); Reports is template-driven.

---

## 1. Goal

A dedicated **Reports** product: admins author a governed catalog of **report templates**;
any user with access opens Reports, picks a template available to them, clicks **Generate**
to pull **fresh** RBAC-scoped data, and the resulting **Quarto HTML** is saved to a library
(history, re-run, download). This is the governed counterpart to the ad-hoc SCDMS
Intelligence explorer.

The engine for generation, the `SmartReport` job/library, the resolvers, the Quarto +
Highcharts rendering, and the spec validator **already exist** — this spec turns the
hardcoded `catalog.py` into **DB-managed `ReportTemplate` records** and adds a management UI
+ a browse/generate UI + a menu.

---

## 2. What changes vs. what's reused

| Reused as-is | New / changed |
|---|---|
| `SmartReport` job model, library, viewer, download, re-run | `ReportTemplate` model (DB-managed catalog) |
| Quarto engine (`reports/smart_report.py`), resolvers, render helpers, template | Template-aware `build_spec` (load spec from a `ReportTemplate`) |
| Spec vocabulary + `validate_spec` (`reports/catalog.py`) | `catalog.py` static `CATALOG` → seeded into `ReportTemplate` rows, then retired |
| RBAC-scoped data resolution | `manage_report_templates` permission; template visibility gating |

---

## 3. Data model — `ReportTemplate`

```python
class ReportTemplate(models.Model):
    name          = models.CharField(max_length=200)
    slug          = models.SlugField(max_length=80, unique=True)
    description   = models.TextField(blank=True)
    domain        = models.CharField(max_length=24, default="submissions")  # resolver key
    # Guided-builder render spec (validated against the allowed vocabulary):
    spec          = models.JSONField(default=dict)   # {sections, kpis, charts, table, narrative?}
    # Which params the Generate form exposes (date range, ministry, stage, …):
    param_schema  = models.JSONField(default=list)   # [{key,type,label,optional}]
    default_params= models.JSONField(default=dict, blank=True)
    # Visibility: who may see & generate this template.
    visible_to_all= models.BooleanField(default=True)
    visible_roles = models.JSONField(default=list, blank=True)  # role codes when not all
    is_active     = models.BooleanField(default=True)
    version       = models.PositiveIntegerField(default=1)
    created_by    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                                      on_delete=models.SET_NULL, related_name="report_templates_created")
    updated_by    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                                      on_delete=models.SET_NULL, related_name="report_templates_updated")
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
```

`SmartReport` gains an optional FK so generated outputs trace to their template:
```python
template = models.ForeignKey(ReportTemplate, null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="generated_reports")
```
(`report_type` keeps the slug for display/back-compat.)

**Migrations:** one schema migration (`ReportTemplate` + `SmartReport.template`) and one
**data migration** that seeds the three current `catalog.py` definitions as `ReportTemplate`
rows, so nothing regresses. `catalog.py` keeps its **vocabulary constants + `validate_spec`**
(now used to validate authored template specs) and drops the static `CATALOG` dict.

---

## 4. Authoring — guided builder (safe, no code)

A template is composed, never coded:

- **Identity:** name, description, domain (Submissions in P1).
- **Parameters:** choose which filters the Generate form exposes (date range, ministry,
  category, stage, overdue-only) → stored as `param_schema`.
- **Content:** pick KPIs (from the domain's scalar sources), charts (type + series source +
  title), and table columns — all from the **fixed vocabulary** in `catalog.py`. Optional
  static narrative/intro markdown.
- **Visibility:** all staff, or a chosen set of roles.
- Saved spec is run through `validate_spec` → only known sources/types/columns persist. No
  arbitrary code, no `.qmd` upload — zero RCE surface.

The Template Manager is gated by a new **`manage_report_templates`** permission (admins by
default; grantable to OPSC report leads).

---

## 5. Generation flow (reuses the engine)

1. User opens **Reports → Browse & Generate**; sees template cards **visible to them**.
2. Picks a template → fills the exposed params (from `param_schema`) → **Generate**.
3. Backend creates a `SmartReport` (status pending, `template=…`, `report_type=slug`,
   `params=…`) and enqueues `run_smart_report` — the **existing** Celery + Quarto pipeline.
4. `build_spec` is extended: when the report references a template, the render spec is the
   template's `spec` merged with the user's params (params validated against `param_schema`).
5. Resolver pulls **fresh** RBAC-scoped data → Quarto renders HTML → saved to `html_file`.
6. The generated report appears in the **library** (the existing viewer/list/download/re-run).

> Ad-hoc NL report generation is **removed from Reports** (it now lives in SCDMS
> Intelligence). The engine's internal `adhoc` path is retained but no longer surfaced here.

---

## 6. API

**Template management** — `ReportTemplateViewSet` (`router.register(r"report-templates", …)`):

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/report-templates/` | any with `view_reports` | templates **visible to me** (active only) |
| GET | `/api/report-templates/{slug}/` | visibility-checked | one template (incl. `param_schema`) |
| POST/PATCH/DELETE | `/api/report-templates/…` | `manage_report_templates` | CRUD |
| GET | `/api/report-templates/vocabulary/` | manager | allowed KPI/chart/column vocabulary for the builder UI |

**Generation** — extend the existing `SmartReportViewSet.create` to accept
`{template: "<slug>", params: {…}}` (validates the user may see the template, and that
params conform to its `param_schema`). List/status/download/re-run are unchanged.

---

## 7. Frontend

**New "Reports" menu group** (replacing the single Intelligence link's report role):
- **Browse & Generate** (`/reports`) — template cards visible to the user → param form →
  Generate → poll → inline viewer + download; plus **My generated reports** (the existing
  `SmartReportLibrary`).
- **Template Manager** (`/reports/templates`, gated by `manage_report_templates`) — list,
  create, edit (guided builder form), activate/deactivate, delete, set visibility.

Reuse existing components: `SmartReportViewer`, `SmartReportLibrary`, `SmartReportParamForm`
(now driven by `template.param_schema`). New: `ReportTemplateManager`, `ReportTemplateForm`
(guided builder), `ReportBrowse`. New `api/reportTemplates.js`. i18n under `reports.*`.

---

## 8. Permissions & RBAC

- **`manage_report_templates`** (new permission code) — template CRUD. Seed onto PSC Admin;
  grantable via the existing Roles & Permissions admin.
- **Generation** — gated by `view_reports` **and** the template's visibility (`visible_to_all`
  or the user's role ∈ `visible_roles`).
- **Data scoping** — unchanged: generation runs on the requesting user's RBAC-scoped
  queryset, so two users running the same template see only their permitted data.
- **Output access** — generated `SmartReport` downloads remain owner/admin-scoped.

---

## 9. File-by-file

**Backend (new)**
- `tracker/models.py` — `ReportTemplate` + `SmartReport.template`
- `tracker/migrations/00NN_report_template.py` (schema) + `00NN_seed_report_templates.py` (data)
- `tracker/report_template_views.py` (+ serializer)
- `tracker/tests/test_report_templates.py` (CRUD perms, visibility, generate-from-template, param validation)

**Backend (edited)**
- `tracker/reports/catalog.py` — keep vocabulary + `validate_spec`; remove static `CATALOG`
- `tracker/reports/smart_report.py` — `build_spec` template path (load `ReportTemplate.spec`)
- `tracker/smart_report_views.py` — `create` accepts `template` + visibility/param checks
- `tracker/urls.py` — register `ReportTemplateViewSet`
- permission seeding (role permission sync) — add `manage_report_templates`

**Frontend**
- `pages/reports/ReportBrowse.jsx`, `pages/reports/ReportTemplateManager.jsx`,
  `components/reports/ReportTemplateForm.jsx`
- `api/reportTemplates.js`; reuse `SmartReportViewer/Library/ParamForm`
- `router/index.jsx` — `/reports`, `/reports/templates`
- `data/menuItems.js` — new **Reports** group (Browse & Generate, Template Manager)
- `i18n/locales/{en,fr,bi}.json` — `reports.*`

---

## 10. Phasing
1. **P1:** `ReportTemplate` + data-seed; Template Manager (guided builder, Submissions);
   template-driven generation reusing the engine; Browse & Generate + library; menu/routes.
2. **P2:** PDF export (engine `pdf_file`); template duplication/versioning history; per-role
   visibility presets.
3. **P3:** More domains (decisions/compliance/meetings/travel) as resolvers land in the engine.
4. **P4:** Scheduled/recurring template runs (Celery Beat) + email delivery; "Save as
   template" from a SCDMS Intelligence exploration (admin).

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Authored spec contains unsafe content | Guided builder only; `validate_spec` whitelists sources/types/columns; no `.qmd`, no code. |
| Template exposes data a viewer shouldn't see | Generation always runs on the **viewer's** scoped queryset; visibility gates *access to the template*, not data scope. |
| Losing the 3 existing catalog reports | Data migration seeds them as templates before removing `CATALOG`. |
| Permission gaps | New `manage_report_templates` seeded to admin; generation double-gated (view_reports + visibility); tests assert it. |
| Confusion between Intelligence vs Reports | Clear menu split + copy: Intelligence = explore live; Reports = generate saved documents from templates. |
| Template/param drift vs engine vocabulary | Builder reads the allowed vocabulary from `catalog.py`; `validate_spec` enforces on save and at render. |
