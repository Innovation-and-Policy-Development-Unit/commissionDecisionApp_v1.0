# Smart Reports → Enterprise Reporting Engine — Implementation Spec

> **Status:** P1 IMPLEMENTED (pending `migrate`, image rebuild, and test run in a
> Python/Quarto environment). Submissions domain; catalog + ad-hoc; Highcharts-in-Quarto
> with graceful static-table fallback until the proprietary Highcharts bundle is dropped
> into `tracker/reports/templates/vendor/highcharts.bundle.js`.
> **Scope of first build:** Submissions domain only. Catalog + ad-hoc NL authoring.
> Charts: **Highcharts** embedded in a **Python-executed Quarto HTML** document.
> **Decision on file:** Highcharts license confirmed by product owner for production use.

---

## 1. Goal

Turn the current Smart Reports widget (a synchronous Claude→JSON→single Recharts chart
view) into an enterprise reporting tool that produces **self-contained Quarto HTML
reports** generated inside SCDMS, with a report **catalog** of parameterized standard
reports plus an **ad-hoc natural-language** path, a **Report Library** (history, status,
re-run, download), and interactive **Highcharts** visualizations.

This reuses the **proven async Quarto pipeline** already shipped for the Decision
Register (`reports/decision_register.py` + `DecisionRegisterReport` + Celery + Quarto
1.6.42 already installed in `backend/Dockerfile`). We generalize that pipeline; we do not
build a new one.

---

## 2. What exists today (baseline)

| Piece | Location | Reuse |
|---|---|---|
| Sync NL widget (to be replaced) | `views.ai_smart_report_view` ([views.py:4146](../backend/tracker/views.py)) | Repointed to async engine; kept as fallback during transition |
| Submission RBAC queryset | `_submission_queryset_for` ([views.py:232](../backend/tracker/views.py)) | **Reused as-is** for the resolver |
| Submission stats snapshot | `_reports_snapshot_for_user` | Basis for aggregates + AI grounding |
| Async report model | `DecisionRegisterReport` ([models.py:2083](../backend/tracker/models.py)) | Generalized into `SmartReport` |
| Quarto render + Celery flow | `reports/decision_register.py` `run_report_generation` | Generalized into `run_smart_report` |
| AI prompt→spec | `ai/decision_register_report.interpret_report_request` | Generalized for the submissions domain |
| qmd template | `reports/templates/decision_register_report.qmd.j2` | New base template `smart_report.qmd.j2` |
| Report API pattern | `CommissionTaskViewSet` register-report actions ([views.py:3524](../backend/tracker/views.py)) | Mirrored as `SmartReportViewSet` |

---

## 3. Architecture

```
SmartReports page
  ├─ "New report" tab
  │    ├─ Catalog cards → parameter form (date range, ministry, category, stage…)
  │    └─ Ad-hoc prompt box
  │
  └─ POST /api/smart-reports/                → SmartReport row (status=pending) → 202
        │
        └─ Celery: run_smart_report(report_id)
             1. [ad-hoc] Sonnet interpret(prompt, snapshot) → spec JSON
                [catalog] spec built directly from report_type + params (no AI)
             2. domain resolver (submissions): RBAC-scoped queryset
                → rows + aggregates → write data.json into work_dir
             3. Jinja2 renders smart_report.qmd.j2 (jupyter: python3) into work_dir
             4. quarto render report.qmd --to html  (Python cells read data.json,
                build pandas tables + Highcharts configs; Highcharts JS bundled local)
             5. store report.html → SmartReport.html_file; status=ready
        │
  Frontend polls GET /api/smart-reports/{id}/ until ready
  → renders inline <iframe srcdoc/src> + Download HTML / (later) PDF + Re-run
```

**Database isolation:** the Quarto subprocess never connects to Postgres. Django resolves
the scoped dataset and writes `data.json`; the `.qmd` Python cells only read that file.
RBAC is enforced once, in Django.

**Injection safety:** the AI returns a **JSON spec only** (report_type, params, section
toggles, chart list, narrative markdown). It never returns Python or HTML/JS. The Python
in the `.qmd` is fully templated by us; Highcharts configs are built in Python from
validated spec + data. There is no path for AI/user text to execute as code.

---

## 4. Data model — `SmartReport`

New model in `models.py` (generalized from `DecisionRegisterReport`, which stays for the
existing register feature):

```python
class SmartReport(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    class Domain(models.TextChoices):
        SUBMISSIONS = "submissions", "Submissions"
        # decisions, compliance, meetings, travel → later phases

    requested_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=CASCADE,
                                       related_name="smart_reports")
    domain         = models.CharField(max_length=24, choices=Domain.choices,
                                      default=Domain.SUBMISSIONS)
    report_type    = models.CharField(max_length=64, default="adhoc")  # catalog key or "adhoc"
    prompt         = models.TextField(blank=True)                      # ad-hoc text
    params         = models.JSONField(default=dict, blank=True)        # catalog params / filters
    spec           = models.JSONField(default=dict, blank=True)        # resolved render spec
    title          = models.CharField(max_length=200, blank=True)
    subtitle       = models.CharField(max_length=300, blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices,
                                      default=Status.PENDING)
    error_message  = models.TextField(blank=True)
    row_count      = models.PositiveIntegerField(default=0)
    html_file      = models.FileField(upload_to="smart_reports/%Y/%m/", blank=True)
    pdf_file       = models.FileField(upload_to="smart_reports/%Y/%m/", blank=True)  # later
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    completed_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["requested_by", "-created_at"]),
                   models.Index(fields=["status"])]
```

One migration: `00NN_smart_report.py` (additive; no change to existing tables).

---

## 5. Domain resolver contract

`reports/domains/base.py`:

```python
@dataclass
class ResolvedDataset:
    rows: list[dict]            # detail rows (for tables / export)
    aggregates: dict            # named aggregates for charts/KPIs
    meta: dict                  # row_count, date range, applied filters, scope label

class DomainResolver(Protocol):
    key: str
    def param_schema(self) -> dict: ...                 # for catalog forms + validation
    def resolve(self, *, user, params: dict) -> ResolvedDataset: ...
```

`reports/domains/submissions.py` — first implementation:
- `queryset = _submission_queryset_for(user)` (RBAC scoping reused verbatim).
- Applies params: `date_from`, `date_to`, `ministry_id`, `form_category_id`, `stage`,
  `overdue_only`.
- `aggregates`: `by_stage`, `by_ministry`, `by_category`, `by_month` (created),
  `turnaround` (avg/median days submitted→decided), `overdue_assessments`, totals —
  computed with the same patterns as `_reports_snapshot_for_user`.
- `rows`: per-submission record (ref, title, ministry, category, stage, created,
  decided, turnaround days, status).

A `DOMAIN_RESOLVERS = {"submissions": SubmissionsResolver()}` registry; later domains
register here.

---

## 6. Report catalog (Submissions)

`reports/catalog.py` — declarative definitions consumed by both the API (to list cards
+ param forms) and the engine (to build a spec without AI):

```python
CATALOG = {
  "submissions_volume_turnaround": {
    "domain": "submissions",
    "title": "Submission Volume & Turnaround",
    "params": [
      {"key":"date_from","type":"date","label":"From"},
      {"key":"date_to","type":"date","label":"To"},
      {"key":"ministry_id","type":"ministry","label":"Ministry","optional":True},
    ],
    "sections": ["kpis","volume_trend","turnaround","by_ministry","table"],
    "charts": [
      {"id":"volume_trend","type":"line","title":"Submissions per month","source":"by_month"},
      {"id":"by_ministry","type":"bar","title":"By ministry","source":"by_ministry"},
      {"id":"turnaround","type":"column","title":"Avg turnaround (days)","source":"turnaround"},
    ],
  },
  "submissions_by_ministry": { ... "By Ministry" ... },
  "submissions_stage_pipeline": { ... "Stage Pipeline & Aging" ... },
}
```

- **Catalog path:** `report_type` ∈ CATALOG → spec built directly from definition + params.
  No AI call. Deterministic, auditable.
- **Ad-hoc path:** `report_type = "adhoc"` → Sonnet maps the prompt to the **same spec
  shape**, constrained to `domain="submissions"` and the allowed chart/section/param
  vocabulary. AI output is schema-validated; on validation failure → `FAILED` with a clear
  message (mirrors `interpret_report_request` error handling).

**Spec shape (single source of truth for the renderer):**
```jsonc
{
  "domain": "submissions",
  "title": "…", "subtitle": "…",
  "params": { "date_from": "...", "ministry_id": 4 },
  "sections": ["kpis","volume_trend","by_ministry","table"],
  "kpis": [{"label":"Total","source":"total"}, ...],
  "charts": [{"id":"by_ministry","type":"bar","title":"…","source":"by_ministry"}],
  "table": {"columns": ["reference_number","ministry","stage","turnaround_days"]},
  "narrative_markdown": "…"   // ad-hoc only; catalog leaves blank or templated
}
```

---

## 7. Quarto template (`reports/templates/smart_report.qmd.j2`)

Jinja2 renders the `.qmd`; Quarto executes the Python.

```markdown
---
title: "{{ title | e }}"
{% if subtitle %}subtitle: "{{ subtitle | e }}"{% endif %}
author: "SCDMS — Public Service Commission of Vanuatu"
date: "{{ generated_at | e }}"
format:
  html:
    theme: cosmo
    toc: true
    toc-depth: 2
    embed-resources: true       # inline everything → portable single file
    page-layout: full
jupyter: python3
execute:
  echo: false
  warning: false
lang: {{ lang }}
---

```{python}
import json, pandas as pd
from pathlib import Path
data = json.loads(Path("data.json").read_text())
spec = json.loads(Path("spec.json").read_text())
agg  = data["aggregates"]; rows = data["rows"]
HIGHCHARTS_JS = Path("highcharts.bundle.js").read_text()   # bundled locally
```

## Request
> {{ user_prompt | e }}
**Prepared for:** {{ generated_by | e }} · **Records in scope:** {{ row_count }}

{% if narrative %}## Executive summary

{{ narrative }}{% endif %}

```{python}
#| output: asis
# KPI cards (HTML) from spec["kpis"] + agg
print(render_kpis(spec, agg))
```

```{python}
#| output: asis
# One Highcharts container + init per spec["charts"], config built in Python from agg.
# Highcharts JS is injected once (bundled, offline-safe); each chart gets a <div> + Highcharts.chart(...)
print(render_highcharts(spec, agg, HIGHCHARTS_JS))
```

## Detail
```{python}
#| output: asis
print(pd.DataFrame(rows)[spec["table"]["columns"]].to_html(index=False, classes="table"))
```
```

Helper functions (`render_kpis`, `render_highcharts`, `render_table`) live in a small
importable module copied/written into the work_dir (or installed as a package module the
qmd imports) so they are unit-testable in Python and not buried in the template.

**Highcharts embedding:** the library JS is bundled at
`reports/templates/vendor/highcharts.bundle.js` and read into the doc, so with
`embed-resources: true` the output HTML is fully self-contained and works offline (no
CDN dependency in a government network). Each chart = a `<div id>` + a
`<script>Highcharts.chart(id, {config})</script>` where `{config}` is `json.dumps`'d from
a Python-built dict.

---

## 8. Engine + Celery

`reports/smart_report.py` (generalized from `decision_register.py`):
- `build_spec(report) -> spec` (catalog → from CATALOG; adhoc → AI interpret + validate)
- `export_dataset(spec, user, work_dir)` → calls resolver, writes `data.json`, `spec.json`,
  copies `highcharts.bundle.js` + helper module into work_dir
- `render_quarto(work_dir) -> html_path` (reuse existing subprocess logic, timeout,
  `quarto_available()` guard, error capture)
- `run_smart_report(report_id)` Celery task: status transitions, store `html_file`,
  `row_count`, `completed_at`; clean temp dir in `finally` (mirrors current task exactly).

`tasks.py`: add `queue_smart_report(report_id)` wrapper (mirror `queue_decision_register_report`).

---

## 9. API — `SmartReportViewSet`

`smart_report_views.py` + register `router.register(r"smart-reports", SmartReportViewSet)`:

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `GET` | `/api/smart-reports/catalog/` | — | catalog definitions (cards + param schemas) |
| `POST` | `/api/smart-reports/` | `{report_type, params}` or `{report_type:"adhoc", prompt}` | `202 {id,status}` |
| `GET` | `/api/smart-reports/` | `?mine=1` | library list (own; admins all) |
| `GET` | `/api/smart-reports/{id}/` | — | status + `downloads{}` when ready (mirror register_report_status) |
| `GET` | `/api/smart-reports/{id}/download/` | `?format=html` | `FileResponse` (inline view + attachment) |
| `POST` | `/api/smart-reports/{id}/rerun/` | — | clones row, re-enqueues |

- Permission: `IsAuthenticated` + reporting permission check (reuse the existing
  `_user_can_export_*`-style gate; new `_user_can_use_smart_reports`).
- Retrieve/download are **owner-or-admin scoped** (mirror `_get_register_report_for_user`).
- `download` supports an inline mode (`as_attachment=False`) so the page can iframe it.

---

## 10. Frontend — rework `pages/psc/SmartReports.jsx`

Two tabs (Fluent `TabList`):

**New report**
- **Catalog**: cards from `GET /catalog/`; selecting one opens a param form (date range,
  ministry select, category, stage) built from the param schema → `POST` → switch to a
  generating state.
- **Ad-hoc**: the existing prompt box (kept) → `POST {report_type:"adhoc", prompt}`.
- **Generating state**: poll `GET /{id}/` (2–3s) with a progress card; on `ready` show the
  report inline via `<iframe>` of the inline download URL + **Download HTML** and **Re-run**;
  on `failed` show `error_message`.

**Report Library**
- Table from `GET /?mine=1`: title, type, status badge, created, row count, actions
  (View / Download / Re-run). Empty state for first use.

New API client methods in `api/`. New components: `SmartReportCatalog`, `SmartReportParamForm`,
`SmartReportViewer` (iframe + toolbar), `SmartReportLibrary`. i18n keys added to en/fr/bi
under `smart_reports.*`.

The old `/reports/ai-smart-query/` endpoint stays until the new flow is verified, then is
removed.

---

## 11. Image / dependency changes

`backend/requirements.txt` — add:
- `pandas` (table building / aggregates in the qmd)
- `jupyter` + `nbclient` (Quarto Python execution engine)

`backend/Dockerfile` — Quarto already present; add a build step to verify the Python
kernel is discoverable (`quarto check jupyter`) and vendor `highcharts.bundle.js` into the
image (committed in repo at `reports/templates/vendor/`). No base-image change.

> Trade-off: the Jupyter kernel grows the image and adds ~2–5s to the first render
> (kernel start). Acceptable for an async, library-backed report. Subsequent renders reuse
> the warm image layer.

---

## 12. RBAC, security, audit

- **Scoping:** resolver uses `_submission_queryset_for(user)` — identical visibility to the
  rest of the app. No new data exposure. (Future compliance domain must additionally honor
  the ministry-visibility firewall — out of first-build scope.)
- **Permission gate** on create/list/download.
- **AI = spec only**, schema-validated; no code/HTML from the model reaches the renderer.
- **Audit:** log report creation + completion (reuse existing `scdms.app` logger lines like
  `REGISTER_REPORT_OK`); optionally an `AuditLog` entry so the Audit Trail shows who ran
  what report over what scope.
- **Temp hygiene:** work dirs removed in `finally` (as today).

---

## 13. File-by-file change list

**Backend (new)**
- `tracker/models.py` — `SmartReport` model
- `tracker/migrations/00NN_smart_report.py`
- `tracker/reports/domains/base.py`, `tracker/reports/domains/submissions.py`
- `tracker/reports/catalog.py`
- `tracker/reports/smart_report.py` (engine), `tracker/reports/render_helpers.py`
- `tracker/reports/templates/smart_report.qmd.j2`
- `tracker/reports/templates/vendor/highcharts.bundle.js`
- `tracker/ai/smart_report_interpret.py` (ad-hoc spec, generalized from decision_register one)
- `tracker/smart_report_views.py` (+ serializer)
- `tracker/tests/test_smart_reports.py` (resolver scoping, spec validation, catalog, API)

**Backend (edited)**
- `tracker/urls.py` — register `SmartReportViewSet`
- `tracker/tasks.py` — `queue_smart_report` + task
- `backend/requirements.txt` — pandas, jupyter, nbclient
- `backend/Dockerfile` — vendor highcharts, `quarto check jupyter`

**Frontend (edited/new)**
- `pages/psc/SmartReports.jsx` (rework), new components under `components/reports/`
- `api/` client methods
- `i18n/locales/{en,fr,bi}.json` — `smart_reports.*`

---

## 14. Phasing

1. **P1 (this build):** model + submissions resolver + catalog (3 reports) + ad-hoc +
   Quarto/Highcharts engine + API + reworked page + Report Library. HTML output.
2. **P2:** PDF export (`pdf_file`, Quarto `--to pdf`); more submissions reports; saved
   report presets.
3. **P3:** Decisions/Tasks + Meetings domains (decisions reuses existing register logic).
4. **P4:** Compliance + Travel domains (compliance firewall), scheduled/recurring reports
   via Celery Beat (quarterly board pack), email delivery.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Highcharts licensing for gov production | Confirmed by product owner (this spec). Bundled JS, no CDN. |
| Jupyter kernel image size / first-render latency | Async job + warm image; acceptable for reporting. |
| Quarto render failures (template/data) | `quarto_available()` guard, captured stderr → `FAILED` with message; unit tests on helpers with fixture data. |
| AI spec drift / invalid output | Strict schema validation; catalog path needs no AI; clear failure surfaced in Library. |
| Large datasets in data.json | Resolver caps detail rows (e.g. 5k) + paginates table; aggregates always computed server-side. |
| Data leakage across roles | Single scoped queryset reused; download owner/admin-scoped; tests assert scoping. |
