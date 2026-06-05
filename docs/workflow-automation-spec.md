# SCDMS Workflow Automation — Implementation Spec

> **Status:** Proposed (awaiting build approval).
> **Decisions on file:** Visual node canvas builder (**React Flow / `@xyflow/react`**).
> Scope covers **all major entities** — Submissions, Compliance Cases, Meetings,
> Commission Tasks. A *no-code automation layer* on top of SCDMS's existing hard-coded
> workflow engine. Same format as the Reports / Intelligence specs.

---

## 1. Goal

A no-code **Workflow Automation** module: *"when an event happens to a record, if
conditions match, run a sequence of actions"* — authored in a visual node canvas
(Trigger → Condition → Action), toggled on/off, and producing a per-run **history log**
(Success / Not-Pass), mirroring the Perfex builder in the reference screenshots.

SCDMS already encodes its statutory workflow in code (`WorkflowStage` state machine,
`SubmissionViewSet.transition`, RBAC, and Celery automations like
`escalate_overdue_assessments`, `auto_schedule_to_meeting`, `notify_*`). This module makes
that automation **configurable by admins without code**, and *reuses* those services as
actions rather than re-implementing them.

---

## 2. Concept mapping (Perfex → SCDMS)

| Perfex | SCDMS |
|---|---|
| Data Type | `submissions` · `compliance_cases` · `meetings` · `commission_tasks` |
| Trigger / Start When | `created` · `stage_changed` · `updated` · `deadline_approaching` · `decision_recorded` · `assigned` |
| Condition (field op value) | record fields (stage, ministry, category, classification, routed_unit, overdue, outcome, …) |
| Action | transition stage · assign principal · create commission task · add note/comment · send notification · send email · set assessment deadline · escalate · webhook |
| History Logs (Success/Not-Pass) | `AutomationRun` rows surfaced on the detail page |

---

## 3. Architecture

```
SCDMS lifecycle event (create / transition / deadline scan)
   → engine.dispatch(data_type, event, instance, actor)
       1. find enabled AutomationWorkflows matching {data_type, event}
       2. for each: walk the graph from Flow Start
            Condition node → evaluate(record) → pass / not-pass (branch)
            Action node    → execute(record, params)  (RBAC-checked)
       3. write an AutomationRun + per-node log rows (Success / Not Pass / Failed)
   (runs async via Celery; time-based triggers via a Celery-beat scan)
```

**Emission points (where `dispatch` is called) — all already centralised:**
- **Created**: `tracker/signals.py` `post_save` handlers (Submission, ComplianceCase already
  there; add Meeting, CommissionTask) → `dispatch(..., "created")` on `transaction.on_commit`.
- **Stage changed / decision**: `SubmissionViewSet.transition` ([views.py:1086](../backend/tracker/views.py)),
  right after `WorkflowEvent.objects.create(...)` → `dispatch(..., "stage_changed", extra={prev,new})`.
- **Assigned**: the assignment endpoints → `dispatch(..., "assigned")`.
- **Deadline approaching**: a Celery-beat task scans records with deadlines in a window →
  `dispatch(..., "deadline_approaching")` (mirrors `escalate_overdue_assessments`).

Engine never bypasses RBAC: actions run as the workflow's **owner** (or a system service
account) and go through the same querysets/permission checks as manual operations.

---

## 4. Data model

```python
class AutomationWorkflow(models.Model):
    name          = CharField(200)
    description    = TextField(blank=True)
    category       = CharField(120, blank=True)         # free-text grouping (screenshot "Category")
    data_type      = CharField(32)                       # submissions | compliance_cases | meetings | commission_tasks
    trigger_event  = CharField(32)                       # created | stage_changed | updated | deadline_approaching | ...
    graph          = JSONField(default=dict)             # React Flow nodes + edges (the canvas)
    enabled        = BooleanField(default=False)
    owner          = FK(User, SET_NULL)                  # actions run with this identity
    created_at / updated_at

class AutomationRun(models.Model):                       # one row per node per execution (history log)
    workflow      = FK(AutomationWorkflow, CASCADE, related_name="runs")
    data_type     = CharField(32)
    object_id     = PositiveIntegerField()               # related record
    object_label  = CharField(255)                       # "PSC-2026-00042"
    node_id       = CharField(64)                         # graph node id
    node_kind     = CharField(16)                         # start | condition | action
    node_label    = CharField(120)
    condition_field / condition_op = CharField(...)       # for condition rows
    action_kind   = CharField(64, blank=True)
    output        = TextField(blank=True)
    result        = CharField(16)                         # success | not_pass | failed
    message       = TextField(blank=True)
    created_at
```
One additive migration. No change to existing tables.

---

## 5. Graph format (React Flow)

The canvas stores nodes + edges as JSON in `AutomationWorkflow.graph`:
```jsonc
{
  "nodes": [
    {"id": "start", "type": "flowStart", "data": {"data_type": "submissions", "event": "stage_changed"}},
    {"id": "c1", "type": "condition", "data": {"field": "current_stage", "op": "=", "value": "under_assessment"}},
    {"id": "a1", "type": "action", "data": {"kind": "assign_principal", "params": {"user_id": 12}}},
    {"id": "a2", "type": "action", "data": {"kind": "send_notification", "params": {"template": "..."}}}
  ],
  "edges": [
    {"source": "start", "target": "c1"},
    {"source": "c1", "target": "a1", "sourceHandle": "pass"},
    {"source": "c1", "target": "a2", "sourceHandle": "fail"}
  ]
}
```
Conditions have **pass/fail** handles (the green/red dots in the screenshots) for branching.
The server **validates and executes** the graph independently of the canvas — the canvas is
just the editor; the engine re-checks every node against the registries below.

---

## 6. Registries (the extensible core)

**Triggers** (`automation/triggers.py`): declares, per data_type, the supported events and
the field vocabulary available to conditions (reuses the Intelligence dataset dimensions
where possible). Drives the builder's Flow Start + Condition dropdowns.

**Conditions** (`automation/conditions.py`): evaluate `{field, op, value}` against a record.
Ops: `= != in contains gte lte changed_to`. Field whitelist per data_type (no arbitrary
attribute access).

**Actions** (`automation/actions.py`): a registry mapping `kind → executor(record, params,
ctx)`. Each executor is RBAC-aware and idempotent where possible. P1 set:

| kind | reuses |
|---|---|
| `transition_stage` | the existing transition service / state-machine guards |
| `assign_principal` / `assign_staff` | assignment endpoints |
| `create_commission_task` | `CommissionTask` creation |
| `add_note` / `add_comment` | submission notes / comment models |
| `send_notification` | `Notification` model |
| `send_email` | `email_notify.py` |
| `set_deadline` | assessment/closing deadline fields |
| `escalate` | existing escalation path |
| `webhook` | outbound POST (allow-listed URLs) |

New actions = one registry entry; the builder reads the registry so they appear
automatically.

---

## 7. Engine

`automation/engine.py`:
- `dispatch(data_type, event, instance, actor=None, extra=None)` — finds enabled workflows,
  enqueues `run_workflow.delay(workflow_id, object_id, event, extra)`.
- `run_workflow(workflow_id, object_id, …)` (Celery task) — loads the record, walks the
  graph from Flow Start, evaluates conditions (branching on pass/fail), executes actions,
  writes `AutomationRun` rows. Guard rails: max nodes per run, per-action try/except →
  `failed` log (one action failing doesn't abort the run), recursion/loop guard (a workflow
  action that re-triggers the same workflow is suppressed).

---

## 8. API — `AutomationWorkflowViewSet`

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/automations/` | CRUD (list w/ category + date filter) |
| POST | `/api/automations/{id}/toggle/` | enable/disable |
| GET | `/api/automations/registry/` | triggers + condition fields + actions (drives the builder) |
| GET | `/api/automations/{id}/runs/` | history logs (paginated, searchable, exportable) |
| POST | `/api/automations/{id}/test/` | dry-run against a chosen record (no side effects) |

Gated by a new **`manage_automations`** permission (admins by default; grantable). The
`test` dry-run executes conditions + simulates actions, returning the would-be log.

---

## 9. Frontend

- **List page** (`/automations`): create, category/date filter, **Enabled** toggle, edit/delete,
  matching the Workflow list screenshot.
- **Builder** (`/automations/:id`): **React Flow** canvas with a left node palette (Flow Start,
  Condition, Action), draggable nodes, pass/fail edges, and a right-hand **config panel** per
  selected node (dropdowns sourced from `/registry/`). Save persists the graph JSON.
- **Detail + History Logs**: tabs — the workflow (read-only canvas) and a logs table
  (Time, Node, Relation, Related To, Condition, Action, Output, Result) with export, matching
  the History Logs screenshot.
- New dep: `@xyflow/react` (React Flow, MIT). Components under `components/automation/`;
  `api/automations.js`; routes; menu entry **Automations** (gated); i18n `automation.*`.

---

## 10. RBAC & safety
- **Authoring** gated by `manage_automations`.
- **Execution** runs as the workflow owner; every action re-checks permissions/state-machine
  guards (e.g. a `transition_stage` action can't make an illegal transition).
- **No code execution**: conditions/actions are a fixed whitelist; values are
  ORM-parameterised; `webhook` URLs are allow-listed.
- **Loop protection**: a run carries an origin marker; automation-caused events don't
  recursively fire the same workflow.
- **Audit**: every run is logged; optionally mirrored into the existing Audit Trail.

---

## 11. File-by-file

**Backend (new)**
- `tracker/models.py` — `AutomationWorkflow`, `AutomationRun`
- `tracker/migrations/00NN_automation.py`
- `tracker/automation/__init__.py`, `triggers.py`, `conditions.py`, `actions.py`, `engine.py`
- `tracker/automation_views.py` (+ serializers)
- `tracker/tests/test_automation.py`

**Backend (edited)**
- `tracker/signals.py` — created-event dispatch (Submission/Compliance/Meeting/CommissionTask)
- `tracker/views.py` — `transition` emits `stage_changed`; assignment emits `assigned`
- `tracker/tasks.py` — `run_workflow` task + a deadline-scan beat task
- `tracker/urls.py` — register the viewset; permission seed (`manage_automations`)

**Frontend**
- `pages/automation/AutomationList.jsx`, `AutomationBuilder.jsx`, `AutomationDetail.jsx`
- `components/automation/*` (nodes, palette, config panel, logs table)
- `api/automations.js`; router `/automations` (+ `/automations/:id`); `data/menuItems.js`; i18n

---

## 12. Phasing
1. **P1a — engine core:** models, registries (Submissions: created + stage_changed; conditions;
   actions transition/assign/note/notify), engine + Celery, dispatch from signals + transition,
   API, tests. *(No UI yet — proven via API/tests.)*
2. **P1b — builder UI:** React Flow canvas, list page, config panels, save/toggle.
3. **P1c — history logs + dry-run test**, then the remaining data types (compliance, meetings,
   commission tasks) and actions (email, set_deadline, escalate, webhook, create task).
4. **P2:** scheduled/time triggers polish, templates/duplication, import/export of workflows.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Infinite trigger loops | Origin marker on automation-caused events; per-record run de-dup; max nodes/run. |
| An action breaking the workflow | Per-action try/except → `failed` log; run continues; transition guards enforced. |
| Privilege escalation via actions | Run as owner; actions re-check RBAC + state-machine; webhook allow-list. |
| Builder ↔ engine drift | Server re-validates graph against registries on save and at run; canvas is editor-only. |
| Performance under bursty events | Async Celery execution; enabled-workflow lookup indexed by `{data_type, trigger_event, enabled}`. |
| Scope creep (full BPM) | Fixed trigger/condition/action vocabulary per phase; linear+branch graph only (no loops). |
```
