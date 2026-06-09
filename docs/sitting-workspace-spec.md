# Sitting Workspace (Meeting-as-Project) — Implementation Spec

> **Status:** Built — P1 (read-only board) + P2 (drag-to-schedule, reorder, move
> between sections). Page: `frontend/src/pages/secretariat/SittingWorkspace.jsx`
> at `/secretariat/meetings/:meetingId/workspace`. Endpoint:
> `GET /api/meetings/{id}/workspace/` (`MeetingViewSet.workspace`); drag moves use
> the section-aware `POST /api/agenda-items/reorder/`. Tests:
> `backend/tracker/tests/test_sitting_workspace.py`.
> P3 (by-stage Kanban toggle, inline AI blurb, one-click approve) and P4
> (implementation-phase CommissionTasks board) remain.
> **Track:** Enterprise UX / new feature. A Perfex-style "Projects & Tasks" board where a
> **Commission sitting is the project** and the **queued submissions are the tasks**.
> Mostly a new view over existing data — minimal new backend.

---

## 1. Concept mapping (Perfex → SCDMS)

| Perfex Projects & Tasks | SCDMS |
|---|---|
| Project | An upcoming **Meeting** (sitting) |
| Project deadline | `Meeting.date` (and `submission_cutoff` for intake close) |
| Project status | `Meeting.agenda_status` (draft → with chairman → approved → circulated) |
| Project capacity | `Meeting.max_items` |
| Task | A **submission on the agenda** (`AgendaItem` = meeting ↔ submission) |
| Task groups / milestones | **Agenda sections** (`AgendaItem.category` / AgendaSection) |
| Task order | `AgendaItem.sequence` |
| Backlog / inbox | Submissions **Forwarded to Commission** not yet placed on an agenda |
| Kanban columns | Workflow stage *or* agenda section |

So a sitting genuinely is a deadline-bound project; the agenda is its task board.

---

## 2. Current state (verified — most of this already exists)

- **`Meeting`** — `date`, `time`, `submission_cutoff`, `max_items`, `agenda_status`, `agenda_approved_by/at`.
- **`AgendaItem`** — `meeting`, `submission`, `sequence`, `category` (section code), `agenda_blurb`, `matters_arising_*`; `unique_together(meeting, submission)`; ordered by `(category, sequence, added_at)`.
- **`AgendaItemViewSet`** — full CRUD already (add/remove/reorder agenda items).
- **`Submission.scheduled_meeting`** — which sitting a submission is queued for, **auto-assigned** by `submission_cutoff` when it reaches PSC / is forwarded (`_assign_scheduled_meeting`).
- **Existing pages** — `Agenda` (secretariat agenda builder), `CommissionSittings`, `AgendaSittingPack` (read-only sitting pack with AI briefs).
- **Stages** — `forwarded_to_commission`, `commission_sitting` mark the commission-ready pool.

**What's missing:** a single **project-style board** that unifies *backlog → agenda (grouped by section, reorderable) → readiness/capacity → status* for one sitting, with drag-to-schedule.

---

## 3. Architecture

```
Sitting Workspace  (/secretariat/meetings/:id/workspace)
  ├─ Header (the "project")
  │     date = deadline · countdown · agenda_status · capacity bar (placed / max_items)
  │     readiness chip (enough to sit?) · cutoff date · "Approve agenda" action
  ├─ Left column — BACKLOG (unscheduled tasks)
  │     submissions Forwarded-to-Commission with no AgendaItem for this meeting
  │     (scheduled to this meeting first, then other ready items) → drag onto agenda
  └─ Right — AGENDA BOARD (the tasks), grouped by Agenda Section (milestones)
        each section = a column/lane of AgendaItem cards, reorderable (sequence)
        card: ref, title, ministry, stage badge, AI blurb, remove
```

- **Drag backlog → section** = `POST /agenda-items/ {meeting, submission, category}` (+ set `scheduled_meeting`).
- **Reorder / move between sections** = `PATCH /agenda-items/{id}/ {category, sequence}` (or a bulk reorder).
- **Remove** = `DELETE /agenda-items/{id}/` (item returns to backlog).
- Everything RBAC-scoped to secretariat roles; read-only for others.

---

## 4. Backend (small additions; reuse AgendaItemViewSet)

1. **Workspace endpoint** `GET /api/meetings/{id}/workspace/` → one payload:
   ```jsonc
   {
     "meeting": { id, reference_number, date, time, submission_cutoff, max_items, agenda_status, ... },
     "sections": [ { code, label } ],            // AgendaSection ordering
     "agenda": [ { id, submission, ref, title, ministry, stage, category, sequence, agenda_blurb } ],
     "backlog": [ { submission_id, ref, title, ministry, stage, scheduled_here } ],
     "readiness": { "placed": N, "capacity": max_items, "backlog_ready": M, "is_ready": bool }
   }
   ```
   `backlog` = `forwarded_to_commission` submissions (RBAC-scoped) without an `AgendaItem` on this meeting; `scheduled_here` flags those whose `scheduled_meeting == this`.
2. **Bulk reorder** `POST /api/agenda-items/reorder/ {meeting, items:[{id, category, sequence}]}` — one round-trip after a drag (or reuse per-item PATCH).
3. **Place item** — on `AgendaItem` create, also set `submission.scheduled_meeting = meeting` if unset.
4. **Readiness threshold** — reuse a System Config setting (e.g. `agenda_min_items`, default e.g. 8) so `is_ready` = `placed >= min` or `backlog_ready >= min`. This is the same signal as the **Chairman agenda-readiness** idea (B8) — surfaced here and on the dashboard.

No new model needed (AgendaItem + Meeting + scheduled_meeting suffice). Optional later: `Meeting.min_items` field instead of a global setting.

---

## 5. Frontend

- **New page** `SittingWorkspace.jsx` at `/secretariat/meetings/:id/workspace` (link from CommissionSittings + Agenda).
- **Board** built with the libraries already in the app:
  - drag-and-drop via the same native HTML5 DnD used in SCDMS Intelligence/QueryBuilder, or `@xyflow`-free simple DnD; backlog list ↔ section lanes.
  - cards reuse submission card styling + stage `BaseBadge`.
- **Header**: countdown to `date`, capacity bar (`placed / max_items`), readiness chip, `agenda_status` stepper, "Approve agenda" (existing transition).
- **Toggle**: group agenda by **Section** (default, = milestones) or by **Stage** (Kanban) — reuse `SubmissionKanbanBoard` patterns.
- All in `components/shared` (Tailwind) — post-A1, no Fluent.

---

## 6. RBAC & rules
- Edit (drag/schedule/approve) = secretariat roles (`psc_secretary`, `senior_admin_officer`, `psc_admin`, `psc_manager`); others read-only.
- Respect `submission_cutoff` (warn when placing late items) and `max_items` (warn/block over capacity).
- Backlog honours the standard submission queryset (firewall intact).
- Placing an item is an audited action (reuse the audit log).

---

## 7. Phasing
1. **P1** — workspace endpoint + read-only board (header, capacity/readiness, agenda grouped by section, backlog list).
2. **P2** — drag-to-schedule (create/delete AgendaItem) + reorder + cutoff/capacity warnings.
3. **P3** — "by stage" Kanban toggle; AI blurb generation inline; one-click "Approve agenda".
4. **P4** — the implementation-phase companion board (CommissionTasks as tasks) to complete the two-phase story (sitting → decision → implementation).

---

## 8. Risks
| Risk | Mitigation |
|---|---|
| Overlap with existing Agenda page | Build the workspace as the richer board and redirect/retire the old agenda builder, or embed the board in it. Decide in P1. |
| Drag reorder race conditions | Bulk reorder endpoint with explicit sequence; optimistic UI + refetch. |
| Capacity/cutoff confusion | Clear warnings, not hard blocks (Secretary can override). |
| Double scheduling | `unique_together(meeting, submission)` already prevents duplicate agenda items. |

---

## 9. Why this one first
- Reuses ~80% existing data/APIs (`AgendaItem`, `scheduled_meeting`, `max_items`, `agenda_status`).
- Directly delivers the **Chairman "enough agenda to call a sitting?"** signal (readiness meter).
- Gives the Secretariat a single, modern prep surface; sets up the post-decision **CommissionTasks** board to complete the Perfex-style two-phase Projects & Tasks model.
