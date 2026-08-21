# UX / Service Design & Workflow Report

---

## As-is service blueprint: submission → decision → implementation

| Stage | Front-stage (user sees) | Back-stage (system does) | Hand-off |
|---|---|---|---|
| Draft | HR officer fills a digitized form | `Submission` row created (`views.py:1151,1198-1242`) | Ministry → itself (DG next) |
| DG endorsement | DG reviews and endorses | `Submission` stage advances, `WorkflowEvent` logged, notification queued (`views.py:2271-2351`) | Ministry HR → PSC |
| **PSC intake/routing** | **Nothing — no human action** | `_auto_advance_submitted_to_checklist_review` (`views.py:3019-3088`) routes by `form_type_code` automatically; a system `WorkflowEvent` is logged with `actor=None, actor_label="System"` | Automatic |
| Checklist review | Unit manager reviews a checklist | `SubmissionChecklistResponse` rows written | Unit manager → unit principal |
| Assessment | Unit principal assesses, may hand back | `submit_to_manager` (`views.py:2751-2850+`), assignment-gated | Unit → Secretary |
| Forward to Commission | Secretary forwards | `_auto_place_on_agenda` runs inline | Secretariat → Commission |
| Sitting | Commission decides | Decision recorded, `content_hash`/`proof_payload` created (decision-proof hash) | Commission → Secretariat |
| Minutes | Multi-stage approval chain (see below) | — | Secretariat ↔ Secretary ↔ Chairman ↔ Commissioners |
| Task allocation | Unit manager receives a task | `CommissionTask` created, decided submissions advanced | Secretariat → implementing unit |

**Where the system already knows something the user is asked to re-derive:** the `returned_for_clarification` loop (see below) is the clearest instance — the system has the exact document/field context at the moment of return, but doesn't structure or surface it.

**Where a user must leave and re-enter context:** the redundant `allowed_transitions` round-trip on `SubmissionDetail` (P2-14) isn't a navigation break, but the lack of deep-linking on minutes-related notifications (P2-09) genuinely is — a Commissioner clicking a "minutes circulated" notification lands on the generic minutes list and must relocate the specific record themselves, every time, across the entire minutes lifecycle.

---

## The `returned_for_clarification` loop — the highest-cost path

Traced through the actual code (`views.py:1587`, `transitions.py:229,242,250,269,716-723`):

- **Reason is free text only.** `TransitionSerializer.remarks` (`serializers.py:1478-1488`) is a plain `CharField`, stored on `WorkflowEvent.remarks`/`remarks_html` (`models.py:2980-2986`). There is no structured `flagged_field` or `flagged_document` concept anywhere in the 90-model schema.
- **The ministry cannot see exactly what triggered the return** beyond whatever the reviewer chose to type. `DocumentAnnotation` (page-level Fabric.js markup with a free-text note) exists in the system but is a generic annotation feature used elsewhere — it is **not wired into the return-for-clarification path at all**.
- **No diff on resubmission.** `DocumentVersion` preserves prior file snapshots (evidence preservation, not comparison) — no `difflib`/diff logic exists anywhere in the codebase. A ministry officer resubmitting must manually open both versions and spot the difference themselves.
- The system does queue an AI bilingual rewrite of the free-text remarks (`queue_clarification_bilingual`) — a genuinely nice touch for a multilingual user base, but it improves the *wording* of an unstructured reason, not the underlying structure problem.

**Redesign proposal:** when returning for clarification, let the reviewer tag the specific form field(s) and/or document(s) at fault (a lightweight `WorkflowEvent`-linked structure, not a new subsystem). On resubmission, highlight exactly those fields/documents and show old-vs-new for any changed one. This is the single highest-leverage UX investment in the whole review given how described this path is as costly.

---

## Deadline / SLA visibility

Real, computed SLA fields exist for **checklist review** and **assessment** (`Submission.assessment_deadline_at`, `checklist_review_deadline_at`, both working-day-aware, holiday-calendar-aware) and for **post-decision implementation** (`implementation_due_date`). `Minutes` has its own SLA fields for the Secretary/Chairman review window and the Commissioner circulation window (both built this session).

**The gap:** the entire Commission-sitting pipeline once a submission reaches `forwarded_to_commission` — including `commission_sitting`, all the deferral/hold stages, and the compliance-review path — has **no deadline concept at all**, even though `WorkflowEvent` already logs every stage transition with a timestamp, meaning the raw data to build a full stage-ageing report already exists; it's just never aggregated across the stages that lack an explicit field. The Commission currently cannot report on its own turnaround for its own sittings.

---

## Role model usability cost

24-33 distinct roles (the exact count depends on whether the 5 unseeded FR-05/Traveller roles are counted — see the architecture deliverable) is a real permission-matrix maintenance burden for a small admin team, and the tooling provided doesn't fully help:
- **No role inheritance, no permission-preset/template system, no "effective permissions" preview, and no "why can't user X see Y" diagnostic exist anywhere.**
- Worse: the admin **Role Definitions** screen (`RoleDefinitionViewSet`) looks like exactly this kind of configurability tool, is fully wired to an audit log as if changes take effect, and **has no actual effect on the hardcoded role checks that govern the core submission workflow** (findings P1-09/P1-10 in the register). An administrator using this screen would reasonably form an incorrect mental model of what they can control.

**Recommendation:** at minimum, add a clear UI-level disclaimer on the Role Definitions screen about its actual (narrower) scope until it's either wired to real enforcement or intentionally retired in favor of documentation.

---

## Notification design

`Notification.link` deep-links inconsistently: some call sites correctly point at a specific record via a `submission=` FK fallback the frontend resolves; others (all Minutes-lifecycle notifications, plus agenda-circulated) hardcode a generic section landing page (`/secretariat/minutes`, `/secretariat/agenda`) regardless of which specific meeting or minutes record triggered them (P2-09). No per-user notification preference/digest system exists — the only user-facing toggle is a browser-permission-level desktop-push on/off, not a content-category preference. Volume is modest given PSC's small size (single-digit Commissioner fan-out, ~14-20 for ministry-HR-wide events) — the concern here is precision of the deep link, not scale.

---

## Meeting/sitting flow vs. real Commission practice

- **Flying Minutes (out-of-session decisions) are well modeled**: `FlyingMinuteSignature` captures decision, timestamp, auth method, trusted-session linkage, and IP per member, with a uniqueness constraint preventing duplicate votes — built against a documented SOP section (cited directly in the model's own comment).
- **Quorum and conflict-of-interest/recusal are structurally absent** — confirmed by exhaustive grep, not inference. Neither ordinary sittings nor Flying Minutes have any quorum check, and there is no mechanism anywhere to record a Commissioner's recusal from a specific item. For a statutory personnel-decision body, this is a due-process gap the system should close, pending PSC's confirmation of the exact quorum rule (see Open Questions) — flagged as P1-14.
- **Matters-arising carry-forward** exists via `matters_arising_meeting_ref`/`agenda_no` free-text fields and `agenda_carryover.py`'s automatic late-submission routing to the next eligible sitting — functional, though the carry-forward linkage itself is free text rather than a structured FK.

---

## Heuristic evaluation (Nielsen's 10) — summary

| Heuristic | Assessment |
|---|---|
| Visibility of system status | Mixed — good on `SubmissionLog`/`MinutesIndex` (all 4 states present); **fails** on `TaskManagement` and `CommissionCalendar`, which have no error state — a fetch failure is indistinguishable from "genuinely empty" |
| Match between system and real world | Strong — the workflow stages, role names, and agenda-section structure closely mirror how PSC actually operates, evidenced by SOP-section references directly in code comments |
| User control and freedom | Weak on the `MultiPageFormRenderer` — forward-one-step, backward-to-completed-steps-only navigation, no draft persistence (P1-11) |
| Consistency and standards | Mixed — a real design-token system exists but is bypassed extensively in the auth flow (165 inline hex colors, 143 inline `style={{}}` blocks system-wide, concentrated in `Login.jsx`/`LockScreen.jsx`); three flagship list views each hand-roll tables/badges/spinners despite shared primitives existing (P2-12) |
| Error prevention | Weak on the return-for-clarification loop (free text only, no structured pointer) |
| Recognition rather than recall | Weak on notification deep-linking (P2-09) — users must recall/relocate the specific record themselves |
| Flexibility and efficiency of use | Not assessed for keyboard power-user paths (no saved-views/bulk-action audit performed in this pass — flag as follow-up) |
| Aesthetic and minimalist design | Not a concern surfaced by this review |
| Help users recognize/diagnose/recover from errors | The restore-endpoint's raw exception leak (P3-07) is a minor instance; more broadly, error messages weren't systematically audited for "what to do next" phrasing — flag as follow-up |
| Help and documentation | A Knowledge Base module exists with seeded role-based guides — a genuine strength, underused as a UX pattern elsewhere in the app (e.g. no contextual help links found near complex forms) |

---

## Annotated redesign proposals — three highest-traffic screens

### Submission Log
Already in reasonably good shape (clean parallel network requests, all 4 states present). Two concrete improvements: (1) migrate to the shared `DataTable`/`BaseBadge` primitives to stop the visual drift already visible (an inconsistent "JD attached" pill exists nowhere else in the design token system); (2) the redundant `allowed_transitions` fetch on the detail page it links into (P2-14) should be removed.

### Submission Detail
The bootstrap-endpoint design (`/submissions/{id}/bootstrap/`) is a good pattern — one call returns submission, documents, checklist, and permitted transitions together. The gap is that a second call (`allowed_transitions`) duplicates data the bootstrap already provides and fires in parallel regardless (P2-14) — remove it. The larger opportunity here is the return-for-clarification redesign described above, since this is the screen where a ministry officer would act on it.

### Minutes Editor
Functionally the richest screen built this session (the full Secretary/Chairman/Commissioner approval chain). UX opportunity: the status badges and per-stage action buttons are already clear; the main gap is that notifications *about* this screen's state changes don't deep-link back into it (P2-09) — closing that loop would make the newly-built workflow feel considerably more responsive to the people using it, at low implementation cost (the meeting/minutes ID is already available at every notification call site, it's just not being passed).
