# SCDMS Intelligence — Interactive Explorer Spec

> **Status:** Proposed (awaiting build approval).
> **Decision on file:** Bespoke in-house explorer (no Apache Superset service). A
> Superset-*like* UX built on SCDMS's existing RBAC-scoped data, rendered with Highcharts.
> **Renames:** the current "Smart Reports" page becomes **SCDMS Intelligence**; route
> `/reports` → `/intelligence` (redirect kept). Template-driven document reports move to a
> separate **Reports** product — see `docs/reports-templates-spec.md`.

---

## 1. Goal

Turn the "Ask SCDMS Intelligence" box into the entry point of an **interactive data
explorer** resembling Apache Superset's Explore view: a dataset/columns panel, a query
builder (x-axis, metrics, dimensions, filters, chart type, sort, row limit), a live
interactive chart, and a results grid. The natural-language prompt **seeds** the
explorer (pre-fills the query controls) and the user can then pivot/tweak freely.

This is **ad-hoc exploration** — live charts, not saved documents. Governed, document-style
reporting lives in the separate Reports product (which reuses the Quarto engine).

---

## 2. Scope

- **P1 dataset:** Submissions (reuse the resolver/scoping already built).
- **Chart types:** table, big-number (KPI), line, bar, column, area, pie, scatter.
- **NL seeding:** prompt → explorer state via the existing AI interpreter (extended).
- Later phases add datasets (decisions, compliance, meetings, travel), saved explorations,
  and "pin to dashboard".

---

## 3. Architecture

```
SCDMS Intelligence page (/intelligence)
  ├─ Left:  Dataset picker + searchable Metrics & Columns (from semantic layer)
  ├─ Mid:   Query builder — x-axis (+time grain), metrics [{column, agg}],
  │         dimensions (group by), filters, chart type, row limit, sort
  ├─ Right: Live Highcharts chart + Results grid + row count / timing / cache badge
  └─ Top:   "Ask SCDMS Intelligence" NL box → seeds the query builder

POST /api/intelligence/query   { dataset, query_spec }
   → semantic layer validates spec against the dataset (whitelist)
   → builds an aggregated ORM query over the RBAC-scoped queryset
   → returns { columns, rows, chart_data, meta(row_count, cached, ms) }

POST /api/intelligence/interpret  { dataset, prompt }
   → Claude maps prompt → a query_spec (validated) → returned for the UI to load & run
```

Everything runs through Django ORM on the **existing scoped querysets** — no raw SQL, no
second service — so the ministry firewall and all RBAC apply automatically.

---

## 4. Semantic layer (the key new abstraction)

A **dataset** declares the dimensions and metrics the explorer may use. This is what
populates the Metrics/Columns panel and what the query validator enforces (so a user — or
the AI — can never query an unlisted column or an unsafe aggregation).

`intelligence/datasets/base.py`:

```python
@dataclass
class Dimension:
    key: str            # ORM field path, e.g. "ministry__name"
    label: str
    kind: str           # "category" | "time" | "number"

@dataclass
class Metric:
    key: str            # e.g. "count", "avg_turnaround"
    label: str
    agg: str            # "count" | "sum" | "avg" | "min" | "max"
    column: str | None  # ORM field for sum/avg/min/max; None for count

class Dataset(Protocol):
    key: str
    label: str
    def queryset(self, user): ...            # RBAC-scoped base queryset
    def dimensions(self) -> list[Dimension]: ...
    def metrics(self) -> list[Metric]: ...
    def time_dimensions(self) -> list[Dimension]: ...
```

`intelligence/datasets/submissions.py` — first dataset:
- `queryset(user)` → `_submission_queryset_for(user)` (reused; firewall intact).
- dimensions: ministry, department, form category, stage, classification, agenda category…
- time dimensions: created_at, received_at, registered_at, assessment_deadline_at.
- metrics: count; avg/median turnaround; overdue count; etc.

A `DATASETS = {"submissions": SubmissionsDataset()}` registry (mirrors the report
resolver registry).

---

## 5. Query spec + execution

**Query spec (validated against the dataset):**
```jsonc
{
  "x": {"dimension": "created_at", "time_grain": "month"},   // or a category dim, or null
  "metrics": [{"key": "count"}],                              // one or more
  "dimensions": ["ministry__name"],                          // series / group-by
  "filters": [{"col": "current_stage", "op": "in", "val": ["approved","rejected"]}],
  "chart_type": "line",
  "row_limit": 1000,
  "sort": {"by": "count", "dir": "desc"}
}
```

**Executor** (`intelligence/query.py`): translate the validated spec into
`queryset.values(...).annotate(...)` using only whitelisted dimensions/metrics + the
chosen time-grain (`TruncDay/Week/Month/...`). Hard caps on row_limit and group cardinality.
Returns tabular `rows` + a `chart_data` shaping suited to the chart type.

**Safety:** filter operators and columns are whitelisted; values are ORM-parameterized
(no string SQL). The AI only ever proposes a spec, which the same validator cleans before
execution — identical posture to the Reports engine.

---

## 6. NL "Ask" → explorer seeding

`intelligence/interpret.py` (sibling of the report interpreter): Claude maps the prompt to
a **query_spec** for the active dataset, constrained to its dimensions/metrics vocabulary.
The UI loads the returned spec into the query builder and runs it — the user sees the chart
*and* the controls that produced it, and can adjust. (Contrast with today's one-shot static
chart.)

---

## 7. Frontend — rework `pages/psc/SmartReports.jsx` → `Intelligence.jsx`

Three-pane Explore layout (Superset-like), built in Tailwind + the `Base*` components
(no new Fluent usage):

- **Left panel:** dataset dropdown; searchable, grouped **Metrics** and **Columns** lists
  (from `GET /api/intelligence/datasets/`). Click/drag to add to the query.
- **Control panel:** X-axis (+ Time Grain when temporal), Metrics, Dimensions, Filters,
  Chart type switcher (icon row), Row limit, Sort. An **Update chart** button + the NL box.
- **Result panel:** interactive **Highcharts** chart; **Results / Samples** grid tabs;
  header chips for row count, cache state, query time.
- **NL box** at top: "Ask SCDMS Intelligence" → calls `interpret`, loads spec, runs query.

New components under `components/intelligence/`: `DatasetPanel`, `QueryBuilder`,
`ChartTypePicker`, `ExplorerChart` (Highcharts), `ResultsGrid`, `AskBox`. New
`api/intelligence.js`. i18n under `intelligence.*` (en/fr/bi).

---

## 8. API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/intelligence/datasets/` | — | datasets + their dimensions/metrics (for the panels) |
| POST | `/api/intelligence/query/` | `{dataset, query_spec}` | `{columns, rows, chart_data, meta}` |
| POST | `/api/intelligence/interpret/` | `{dataset, prompt}` | `{query_spec}` (validated) |

Permission: `IsAuthenticated` + `view_reports` (or a new `use_intelligence`). All queries
run on the requesting user's scoped queryset. Optional Redis result cache (reuse
`api_cache`) keyed by (user-scope, dataset, spec) with a short TTL — drives the "Cached"
badge.

---

## 9. Charts (Highcharts, client-side)

The explorer renders **interactively in the browser** with Highcharts (the same licensed
library bundled for Reports). The API returns chart-ready JSON; the client builds the
Highcharts config per chart type. (No Quarto here — Quarto is only for document Reports.)
Until a licensed Highcharts bundle is present on the frontend, the explorer falls back to
the existing Recharts components so it still works.

---

## 10. RBAC, security, performance

- **Scoping:** every query uses the dataset's RBAC-scoped queryset; the ministry firewall
  and role visibility are inherited, not re-implemented.
- **Whitelist:** only declared dimensions/metrics/filter-ops are accepted; AI output is
  validated before execution; no raw SQL.
- **Caps:** row_limit ceiling, max group cardinality, query timeout; results grid paginated.
- **Caching:** optional short-TTL Redis cache per scoped spec.

---

## 11. File-by-file

**Backend (new)**
- `tracker/intelligence/__init__.py`
- `tracker/intelligence/datasets/base.py`, `datasets/submissions.py`
- `tracker/intelligence/query.py` (validator + executor)
- `tracker/intelligence/interpret.py` (NL → query_spec)
- `tracker/intelligence_views.py` (+ serializers) — `datasets`, `query`, `interpret`
- `tracker/tests/test_intelligence.py` (scoping, whitelist, executor, API)

**Backend (edited)**
- `tracker/urls.py` — intelligence routes

**Frontend**
- `pages/psc/Intelligence.jsx` (renamed/rewritten from SmartReports.jsx)
- `components/intelligence/*`, `api/intelligence.js`
- `router/index.jsx` — `/intelligence` (+ `/reports`→`/intelligence` redirect or repurpose)
- `data/menuItems.js` — "Smart Report (AI)" → "SCDMS Intelligence"
- `i18n/locales/{en,fr,bi}.json` — `intelligence.*`

---

## 12. Phasing
1. **P1:** Submissions dataset; query API + validator/executor; explorer UI; NL seeding;
   core chart types; Highcharts (Recharts fallback).
2. **P2:** Decisions + compliance + meetings datasets; saved explorations; CSV/PNG export.
3. **P3:** "Pin to dashboard" + a dashboard composer; cross-dataset blends.
4. **P4 (optional):** revisit embedded Apache Superset for power users if the bespoke
   explorer hits its ceiling.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Scope creep toward a full Superset clone | Fixed dataset/metric vocabulary + capped chart types per phase. |
| Unsafe/unbounded queries | Whitelisted dims/metrics/ops, row & cardinality caps, timeouts, parameterized ORM only. |
| Data leakage across roles | Single scoped queryset per dataset; tests assert ministry-firewall scoping. |
| Highcharts licensing | Shared with Reports; bundled, no CDN; Recharts fallback if absent. |
| AI proposes invalid spec | Same validate-before-run posture as Reports; clear UI error, spec is editable. |
| Performance on large data | Server-side aggregation, caps, Redis result cache, paginated grid. |
