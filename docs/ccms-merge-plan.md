# Compliance Merge into SCDMS — Single-System Implementation Plan

> **STATUS: DELIVERED (Phases 0–6).** Compliance Case Management now runs entirely
> inside SCDMS — native case creation, statutory SLA timelines, complaint lodgement &
> triage, the ministry-visibility firewall, and the full case UI. The standalone CCMS
> bridge (webhooks, `cms_*` fields, `CMS_*` settings) has been removed. Legacy live
> cases can be imported with `manage.py import_legacy_ccms`.

**End state:** there is **one system — SCDMS**. Compliance is not a separate app, not
a bridged module, and not a synced service. A compliance matter **is a Submission**
that flows through the **existing** SCDMS workflow, carrying compliance-specific data.
The standalone CCMS repo is a **porting source only**, then archived. No runtime
relationship between two systems ever exists.

**Source reviewed:** `github.com/Innovation-and-Policy-Development-Unit/cms`
(Django 6 / React 19 / Postgres 16 — same stack as SCDMS).

---

## The architectural decision

| Two-system design (today, being removed) | Single-system design (target) |
|---|---|
| Compliance case lives in a separate CCMS DB | Compliance data extends `Submission` (one-to-one) |
| Manager approval → REST push/pull to SCDMS | Manager approval → ordinary workflow transition |
| `register_submission_from_cms()` webhook | Direct creation by compliance staff in SCDMS |
| SCDMS **blocks** compliance staff from creating (`CMS_ORIGIN_MESSAGE`) | Compliance staff create compliance submissions directly |
| `cms_register` / `cms_close` / `cms_bridge` / `views_webhooks` / `CMS_CALLBACK_SECRET` | **All deleted** |

The compliance submission rides the workflow SCDMS already has:

```
DRAFT → PENDING_MANAGER_APPROVAL → SUBMITTED → SECRETARY_REVIEW
      → FORWARDED_TO_COMMISSION → COMMISSION_SITTING → APPROVED/REJECTED
      → DECISION_ENTERED_ASSIGNED → UNDER_IMPLEMENTATION → IMPLEMENTATION_REPORT
```

- Compliance Senior/Principal creates → `DRAFT`; needs manager sign-off →
  `PENDING_MANAGER_APPROVAL`. Manager-created skips it.
- Manager approves → `SUBMITTED` → `SECRETARY_REVIEW` (existing internal graph).
- Commission path, decision, and minutes/implementation are the **same** stages every
  other submission uses.
- After the decision, the compliance **Manager** picks it up at
  `DECISION_ENTERED_ASSIGNED` and assigns a Principal/Senior via the existing
  `SubmissionCoAssignment` — the "back to compliance" loop you described.

---

## Menu architecture

Three surfaces, one system:

1. **Ministry-facing — "Lodge a Complaint" (write-only)** · roles: `head_of_agency`,
   `ministry_hr`. A ministry lodges a complaint form into SCDMS; it drops into the
   compliance intray. A **"My Complaints"** list shows the ministry only its own
   lodged complaints and a coarse status (`received → under review → closed`) — never
   the resulting compliance case, stages, decision, or litigation.
2. **Compliance-only — "Compliance" menu group** · roles: `compliance_*` + admin.
   `Complaints Register` (triage intray), `My Cases / Case List`, `Approval Queue`
   (manager sign-off), `Litigation & Costs`, `Compliance Reports`.
3. **Shared — existing "Submissions" menu** · reused. Once a complaint is worked up
   into a compliance submission it becomes an ordinary `Submission` and appears in the
   standard Submissions list/detail, flowing through the same workflow. Ministry users
   never see the compliance submissions (already `is_internal=True`).

**Flow:** Ministry lodges **Complaint** → Compliance triages in **Complaints Register**
→ accept spawns a **ComplianceCase** (+ `Submission`) → worked up and managed via the
**Submissions** menu → Secretary → Commission → decision → back to compliance manager.

## Already in place (reused as-is)

- Roles `compliance_manager` / `compliance_senior` / `compliance_principal`.
- `COMP-*` form types (`compliance_forms.py`), `COMPLIANCE` routed unit,
  `discipline_compliance` agenda category.
- Internal-submission workflow **with the manager-approval chain**
  (`PENDING_MANAGER_APPROVAL` / `PENDING_SECOND_APPROVAL`) and `is_internal` flag.
- Documents, audit (`AuditLog` + `WorkflowEvent`), notifications, SLA/holiday
  calendar, dashboards, subway map — all reused; **CCMS `documents`/`notifications`/
  `audit` apps are NOT ported.**

## Genuinely additive (ported from CCMS, re-homed onto Submission)

- **Complaint intake** → new `Complaint` model (ministry-lodged, write-only): lodged_by,
  subject info, ministry, description, attachments, status, optional link to the
  `ComplianceCase` it becomes. *(Not in CCMS — new, per the ministry-lodgement
  decision.)*
- **Subject-as-person** + case metadata → `ComplianceCase` (one-to-one with
  `Submission`, like the existing `PSCForm37Data` pattern).
- **Statutory SLA timeline** → `ComplianceCaseStage` (rows hanging off
  `ComplianceCase`): `sla_days`, `sla_working_days`, `due_date`, `statutory_ref`,
  `responsible_role`, order. These are the 3/5/21/45-day clocks tracked while the
  compliance unit builds the case (pre-Secretary).
- **Litigation/cost** → `LitigationRecord` (FR-13).
- **Compliance decision outcomes** → mapped from `CommissionDecisionOutcome`, plus a
  compliance-specific outcome set (reinstate/terminate/warn/demote/…).
- The **6 family stage templates** + working-day math from CCMS `workflow.py`.

---

## Phase 0 — Decision & groundwork  *(0.5–1 day)*

- [ ] Record the single-system decision in the Step 2 Technology Assessment Note
      (supersedes §6.1 of the Need Assessment Brief — no separate CCMS, no API).
- [ ] Confirm data model home: compliance extension models live in **`tracker`**
      (they extend `Submission`), grouped in `tracker/compliance_models.py` +
      `tracker/compliance/` helpers. (No separate Django app — that would reintroduce
      a boundary.)
- [ ] Snapshot whether the standalone CCMS holds **live cases** (drives Phase 6).

**Exit:** signed decision; empty migration scaffold.

---

## Phase 1 — Complaint + ComplianceCase data models  *(2–3 days)*

- [ ] `Complaint` (ministry-lodged intake record): `lodged_by`, `ministry`, subject
      info, `description`, attachments, `status`
      (`received/under_review/accepted/rejected/converted`), `closed_reason`, and
      `compliance_case` (nullable FK, set when triage accepts it).
- [ ] `ComplianceCase(models.OneToOneField(Submission))` with subject fields,
      `case_family`, `is_senior_executive`, status.
- [ ] `ComplianceCaseStage` (FK → ComplianceCase) for the statutory timeline.
- [ ] `LitigationRecord` (FK → ComplianceCase), `CaseNote` (FK → ComplianceCase).
- [ ] Choice enums: `CaseFamily`, `SLAStatus`, `StageStatus`, compliance
      `DecisionOutcome`, complaint `Status`.
- [ ] Migration; admin registration; unit tests for the links.

**Exit:** a complaint can be recorded; a Submission can carry a `ComplianceCase` with
subject + stages + litigation; a complaint can point to the case it became.

---

## Phase 2 — Statutory SLA timeline + 6 families  *(2–3 days)*

- [ ] Port CCMS `workflow.py` family templates → `tracker/compliance/workflows.py`.
- [ ] Rewire working-day math to SCDMS `PublicHoliday` (CCMS skips weekends only).
- [ ] On `ComplianceCase` creation, materialise `ComplianceCaseStage` rows with
      computed `due_date`s for the chosen family.
- [ ] SLA roll-up (`on_track/at_risk/overdue`) on the existing Celery beat
      (migrations 0113/0115) that already escalates assessments.
- [ ] `seed_compliance_workflows` management command (trimmed from CCMS `seed.py`).

**Exit:** each family generates correct statutory stages/dates; SLA recomputes on the
existing schedule.

---

## Phase 3 — Complaint lodgement, triage, and creation in the existing workflow  *(3–4 days)*

- [ ] **Ministry complaint lodgement (write-only):** endpoint + permission allowing
      `head_of_agency` / `ministry_hr` to create a `Complaint` and read **only their
      own** (status + closed_reason); no access to the resulting case.
- [ ] **Compliance triage:** Complaints Register actions — `accept` (spawns a
      `ComplianceCase` + `Submission`, links `Complaint.compliance_case`, sets
      `converted`) or `reject` (sets `rejected` + `closed_reason`, visible to the
      lodging ministry).
- [ ] **Remove the two-system block** at `serializers.py:1153–1156`
      (`raise PermissionDenied(CMS_ORIGIN_MESSAGE)`); allow compliance roles to create
      `COMP-*` submissions directly (from a complaint or standalone).
- [ ] Submission-create flow for compliance: create `Submission` (`is_internal=True`,
      `routed_unit=COMPLIANCE`, `DRAFT`) + its `ComplianceCase` in one transaction.
- [ ] Approval routing via the **existing** internal graph: senior/principal →
      `PENDING_MANAGER_APPROVAL`; manager approve → `SUBMITTED` → `SECRETARY_REVIEW`.
      (Mirror CCMS `initial_approval_status_for_role`; no new stages.)
- [ ] **Delete the bridge** (it only existed for two systems):
      `tracker/cms_register.py`, `tracker/cms_close.py`, `tracker/cms_bridge.py`, the
      `cms-register`/`cms-signoff` views in `views_webhooks.py` + their `urls.py`
      entries, and `CMS_CALLBACK_SECRET` / `CDP_*` / `CMS_API_URL` settings + env.

**Exit:** a compliance officer creates a case in SCDMS and it advances Secretary →
Commission with no external call anywhere.

---

## Phase 4 — Visibility scoping & RBAC  *(2–3 days)*  — **SAFETY-CRITICAL**

- [ ] Central queryset scoping: ministry roles (`ministry_hr`, `dept_admin`,
      `head_of_agency`, `traveller`) and non-compliance PSC roles get **nothing** for
      `ComplianceCase` / `ComplianceCaseStage` / `LitigationRecord` / `CaseNote`.
- [ ] **Asymmetric `Complaint` scoping:** the lodging ministry may create a complaint
      and read **only its own** (status + closed_reason) — never the linked
      `ComplianceCase`, its stages, decision, or litigation. Compliance roles see the
      full register.
- [ ] Compliance submissions are already `is_internal=True` (excluded from ministry
      lists) — add a regression test asserting it, and assert the extension models
      never serialize into any ministry-visible payload (including via
      `Complaint.compliance_case`).
- [ ] **Test matrix** before any UI ships: {ministry_hr, head_of_agency, psc_officer,
      compliance_senior, compliance_manager, psc_admin} × {complaint(own/others),
      case list, detail, stage, litigation, note, document} → allowed/denied.

**Exit:** green suite proving ministry users cannot reach compliance data via any
endpoint. **Gates Phase 5.**

---

## Phase 5 — UI: complaint surface + compliance module  *(5–7 days)*

- [ ] **Ministry-facing menu** in `frontend/src/data/menuItems.js`, gated to
      `head_of_agency` / `ministry_hr`: **"Lodge a Complaint"** (write-only form) +
      **"My Complaints"** (own complaints, coarse status only).
- [ ] **Compliance menu group**, gated to `compliance_*` + admin: **Complaints
      Register** (triage intray with accept/reject), **My Cases / Case List**,
      **Approval Queue**, **Litigation & Costs**, **Compliance Reports**.
- [ ] Port CCMS case pages to SCDMS JSX/Fluent and **into the existing SubmissionDetail
      / submission flows** where possible (a compliance submission is a submission):
      subject panel, statutory-stage timeline, litigation tab, create wizard.
- [ ] Reuse SCDMS shells (Header, BaseSelect, MultiPageFormRenderer, document
      annotator, subway map) — port pages, not infrastructure.
- [ ] i18n keys in `en/fr/bi.json`; routes in `router/index.jsx` behind the guards.

**Exit:** a ministry lodges a complaint; compliance triages and runs the case
end-to-end in SCDMS; the ministry sees only its own complaint status, nothing else.

---

## Phase 6 — Data migration + decommission CCMS  *(2–4 days; migration only if live data)*

- [ ] If the standalone CCMS holds live cases: one-off ETL importing
      `Case/CaseStage/Decision/CaseNote/LitigationRecord` into the SCDMS extension
      models, creating each linked `Submission` at the correct stage; documents →
      `SubmissionDocument`; users/roles reconciled (`COMPLIANCE_UNIT` →
      `compliance_senior`). Dry-run on a copy; verify counts/SLA/links; cutover.
- [ ] Archive the standalone CCMS repo; it has no runtime role.
- [ ] Update `docs/CMS-SCDMS-operating-model.md` → "compliance merged into SCDMS";
      update `.env.example`, deployment docs, Step 2 note.

**Exit:** one app, one DB, one deployment; the standalone system is gone.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Compliance data leaks to ministry users | Phase 4 central scoping + test matrix **before** any UI. |
| Complaint→case link leaks case data to lodging ministry | Asymmetric `Complaint` scoping (own + status only); test that `compliance_case` never serializes to ministry. |
| Removing the create-block opens COMP-* to wrong roles | Gate creation to `compliance_*` roles in the same change. |
| Big-bang breakage | Bridge deleted only after direct-create path works (Phase 3 internal order). |
| Subject-as-person modelling churn | `ComplianceCase` holds subject; `Submission` schema unchanged. |
| Live-data loss on cutover | Phase 6 dry-run + reconciliation. |
| Governance / signed brief mismatch | Phase 0 records the decision in the Step 2 note. |

## Rough effort

~3–4 weeks (one dev). Phases 0–5 are the core (~2.5–3 wk); Phase 6 migration only if
the standalone CCMS already holds live cases.

## Suggested first slice (de-risks everything)

Phases 1 → 3 → 4 for the **Employee Internal Disciplinary** family only —
Complaint + ComplianceCase + direct creation into the existing workflow + the
visibility firewall (incl. asymmetric complaint scoping) — proven end-to-end before the
UI and the other five families. (Pull `ComplianceCaseStage` from Phase 2 in if the
statutory SLA timeline is needed in the slice.)
