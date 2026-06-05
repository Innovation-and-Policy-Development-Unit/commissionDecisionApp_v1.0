# Collaboration (A7) — Implementation Spec

> **Status:** Proposed (awaiting build approval).
> **Track:** Enterprise UX — A7. Comments, @mentions, presence, activity timeline,
> with subtasks & checklists folded in as collaboration surfaces.
> **Framing:** designed *for SCDMS*, not ported from Perfex. The Perfex analysis was
> the reference; this spec is grounded in the SCDMS data model and its government
> constraints (ministry firewall, RBAC scoping, tamper-evident record-keeping).

---

## 1. The headline: SCDMS already has what Perfex structurally can't

The Perfex review concluded presence is "the real gap" (no WebSocket/real-time layer)
and subtasks are "not native." **In SCDMS the opposite is true** — those are already
built. The genuine gaps here are *comments on the core object* and *@mentions*.

| Capability | Perfex | **SCDMS today** | Gap to close |
|---|---|---|---|
| **Presence** ("who's viewing") | ✗ not native | ✅ `SubmissionPresence` (heartbeat, 90 s TTL) + `submission_presence.py` + `SubmissionPresenceBar.jsx` + tests | Generalize to Meetings/Tasks; add "editing" state |
| **Subtasks** (parent/child) | ✗ not native | ✅ `CommissionSubTask` (status, due date, M2M assignees, created_by) | Status rollup to parent; comment surface |
| **Checklists** | ✅ native | ✅ `SubmissionChecklistItem` / `SubmissionChecklistResponse` + AI autofill + ODU restructure checklist | Per-item assignee/optional comment (minor) |
| **Activity timeline** | ◐ project-level only | ✅ `AuditLog` — system-wide, tamper-evident, actioned, indexed; `AuditTrailExplorer`/`VisualAuditTrail` | Per-object *human* timeline merging audit + comments + stage moves |
| **Notifications** | ◐ pull/AJAX | ✅ `Notification` (in-app/email/both, is_read) | Reuse as the mention delivery channel |
| **Comments** | ✅ native (tasks/discussions) | ◐ **fragmented** — `CommissionTaskUpdate` (task log), `FeedbackComment` (feedback only). **No thread on the Submission.** | **Build a unified comment thread on the core objects** |
| **@mentions** | ◐ in comments only | ✗ **none anywhere** | **Build mention parsing + RBAC-safe resolve + notify** |

So A7 is **two new capabilities (comments-on-core-objects, @mentions) + unification
(one activity timeline) + generalization (presence beyond submissions)** — not a
ground-up collaboration build.

---

## 2. SCDMS constraints that change the design (vs a generic CRM)

These are non-negotiable and shape every piece below:

1. **Ministry firewall (`is_internal`).** A comment or mention must never leak across
   the PSC↔ministry boundary. Internal PSC notes are invisible to ministry users; you
   cannot @mention a ministry user on an internal-only note.
2. **RBAC scoping (`_submission_queryset_for(user)`).** Mention autocomplete and
   comment visibility are bounded by who can actually access the object. You can only
   mention someone who can see the thing.
3. **Tamper-evident / official record.** Comments are part of the government record:
   **soft-delete only**, edits keep history, every comment/mention is itself written to
   `AuditLog`. No hard deletes, no silent edits.
4. **Append-only ethos already exists** (`CommissionTaskUpdate` is append-only) — the
   new comment model should respect the same evidentiary posture.

---

## 3. Architecture

```
                       ┌─────────────────────────────┐
   Submission ─────────┤                             │
   Meeting    ─────────┤   Comment (GenericFK)        ├── Mention (per @user)
   CommissionTask ─────┤   + threading (parent)       │      └─ Notification + email
   CommissionSubTask ──┤   + is_internal firewall      │
                       │   + soft-delete + edit history│
                       └──────────────┬───────────────┘
                                      │
                AuditLog ─────────────┤
                Stage transitions ────┼──►  Activity Timeline (read-model)
                Comments ─────────────┘     merged, RBAC/firewall-filtered, per object

   Presence (GenericFK, evolved from SubmissionPresence) ── avatars + "editing" badge
```

- **One polymorphic `Comment`** attached via `contenttypes` GenericForeignKey to any
  collaboratable object (Submission, Meeting, CommissionTask, CommissionSubTask).
  Reuse — don't duplicate — for every object type.
- **`Mention`** rows are derived from the comment body on save (stored, not re-parsed),
  so notifications and rendering are reliable and auditable.
- **Activity Timeline is a read-model**, not new storage: it merges existing `AuditLog`
  rows + `Comment`s + workflow stage changes for one object into a single chronological,
  firewall-filtered feed.
- **Presence** evolves the proven `SubmissionPresence` heartbeat into a generic
  `Presence` (GFK) so Meetings and the Sitting/Task boards get it for free — same
  pull-based heartbeat, no new infra (Redis already present if we later want push).

---

## 4. Data model

### 4.1 `Comment` (new, polymorphic)
```python
class Comment(models.Model):
    content_type = FK(ContentType)          # Submission | Meeting | CommissionTask | CommissionSubTask
    object_id    = CharField/PositiveInt
    target       = GenericForeignKey()
    author       = FK(User, PROTECT)
    body         = TextField()              # stores @[Name](user:ID) tokens inline
    parent       = FK("self", null, related_name="replies")   # one-level threading
    is_internal  = BooleanField(default=False)   # PSC-only; enforced against firewall
    # evidentiary
    edited_at    = DateTimeField(null)
    edit_count   = PositiveInt(default=0)
    is_deleted   = BooleanField(default=False)   # soft delete (record retained)
    deleted_by/at
    created_at, updated_at
    indexes: (content_type, object_id, created_at)
```
Optional `CommentAttachment` (FK comment, file) — mirrors Perfex's attach-on-comment;
reuse existing attachment/storage patterns + virus-scan if present.

### 4.2 `Mention` (new)
```python
class Mention(models.Model):
    comment        = FK(Comment, related_name="mentions")
    mentioned_user = FK(User, related_name="mentions_received")
    notified       = BooleanField(default=False)
    created_at
    unique_together = (comment, mentioned_user)
```
Parsed from `body` on `Comment` save; each row fans out one `Notification`
(in-app + email) — **only if** the mentioned user passes the RBAC/firewall check for
the target object. Mentions that fail the check are dropped silently (no leak).

### 4.3 `Presence` (evolve existing)
Generalize `SubmissionPresence` → `Presence(content_type, object_id, user, last_seen_at,
state)` where `state ∈ {viewing, editing}`. Migrate existing submission presence data;
keep the 90 s TTL and the existing heartbeat service. `SubmissionPresenceBar` becomes a
generic `PresenceBar` taking `(objectType, objectId)`.

### 4.4 Reuse as-is
- `AuditLog` — timeline source; **also** write a row for every comment/mention/delete.
- `Notification` — mention + reply delivery.
- `CommissionSubTask`, `SubmissionChecklistItem` — become commentable targets via the GFK.

---

## 5. @mention behaviour (the careful part)

1. **Autocomplete** `GET /api/mentions/suggest/?target=submission:123&q=jo` →
   returns only users who pass `_submission_queryset_for`-equivalent access for that
   object **and** the firewall (no ministry users on internal notes). Never a global
   user list.
2. **Storage format**: body holds `@[Jo Bloggs](user:42)`; frontend renders a chip,
   plaintext/email degrades to `@Jo Bloggs`.
3. **On save**: extract `user:ID` tokens → create `Mention` rows → for each, re-check
   access → enqueue `Notification` (Celery, reuse existing notify task) → mark notified.
4. **Self-mention / duplicate** suppressed. Editing a comment diffs mentions (new ones
   notified, removed ones left as record).
5. Every mention is audited (`AuditLog` action e.g. `MENTION`).

---

## 6. Activity Timeline (unified, per object)

`GET /api/activity/?target=submission:123` returns a merged, paginated, **firewall- and
RBAC-filtered** feed of:
- `AuditLog` events for that resource (created, updated, decision, download…),
- `Comment`s (+ replies, respecting `is_internal`),
- workflow **stage transitions** (from the existing stage history / subway-map source).

Each entry normalized to `{ id, kind, actor, icon, summary, body?, at, is_internal }`.
Frontend `ActivityTimeline` component renders the chronological story with a
**"Discussion / Activity / All"** filter (Perfex's tabs, SCDMS-native). The
visible-to-customer cascade becomes **visible-to-ministry**: internal entries are
filtered server-side for ministry users — never sent to the client.

This replaces the scattered views with one "story of this submission/sitting/task"
surface, and it reuses the `AuditLog` spine rather than storing anything new.

---

## 7. Where it appears (surfaces)

- **Submission detail** — a **Discussion + Activity** panel (tabbed) + the existing
  presence bar; @mention teammates on a case.
- **Sitting / Agenda** (and the future Sitting Workspace) — comments per meeting; "who's
  viewing this sitting" presence.
- **CommissionTask / CommissionSubTask** — comments thread (complements the
  append-only `CommissionTaskUpdate`), mention assignees, presence on the task board.
- **Global** — mentions land in the existing notification bell + email; a "Mentions"
  filter in the notification center (ties to A2).

---

## 8. API surface (new)

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/comments/?target=<type>:<id>` | list/create comments on an object (firewall-filtered) |
| `PATCH/DELETE /api/comments/{id}/` | edit (history kept) / soft-delete (record kept) |
| `GET /api/mentions/suggest/?target=…&q=` | RBAC/firewall-safe mention autocomplete |
| `GET /api/activity/?target=<type>:<id>` | unified timeline read-model |
| `POST /api/presence/heartbeat/` + `GET /api/presence/?target=…` | generic presence (evolved) |

All scoped through the existing access helpers; all writes audited.

---

## 9. Frontend components (in `components/shared`, post-A1 Tailwind)

- `CommentThread` (list + composer), `CommentComposer` (mention autocomplete via
  Headless UI Combobox), `CommentItem` (edit/soft-delete, reply, internal badge),
  `MentionChip`, `ActivityTimeline` (+ kind filter), generic `PresenceBar`
  (refactor of `SubmissionPresenceBar`). Reuse `Avatar`, `BaseBadge`, toast, i18n.

---

## 10. Phasing
1. **P1 — Comments core.** Polymorphic `Comment` + thread/composer on **Submission**
   detail, firewall + soft-delete + audit. (Highest value: collaboration on the core object.)
2. **P2 — @mentions.** `Mention` model, RBAC-safe autocomplete, notification + email
   fan-out, mention chips, notification-center filter.
3. **P3 — Unified Activity Timeline.** Merge AuditLog + comments + stage moves into the
   per-object feed with the Discussion/Activity/All filter.
4. **P4 — Presence generalization.** `Presence` GFK + generic `PresenceBar`; extend to
   Meetings & Task boards; "editing" state.
5. **P5 — Subtask/checklist collaboration.** Comments on `CommissionSubTask`; subtask
   status rollup to parent; optional per-checklist-item assignee/note.

Each phase ships independently; P1 alone is useful.

---

## 11. Risks
| Risk | Mitigation |
|---|---|
| Firewall leak via mention/comment | Server-side filter on every read AND every mention notify; never send internal entries to ministry clients; tests for cross-boundary cases. |
| GenericForeignKey query cost | Index `(content_type, object_id, created_at)`; prefetch; the timeline endpoint paginates and caps. |
| Duplication with `CommissionTaskUpdate` | Treat task updates as a first-class comment kind or migrate them into `Comment`; decide in P5 to avoid two task logs. |
| Record-keeping (edits/deletes) | Soft-delete + edit history + audit row, by policy — comments are official record. |
| Mention notification spam | De-dupe, suppress self-mention, batch digest option (reuse notification prefs). |
| Presence migration | Data-migrate `SubmissionPresence` → `Presence`; keep endpoint back-compat during cutover. |

---

## 12. Why this is the right A7 for SCDMS
- Closes the **two real gaps** (core-object comments, @mentions) instead of rebuilding
  presence/subtasks/timeline that SCDMS already has.
- Honors the **government constraints** Perfex never had to (firewall, RBAC, tamper-evidence).
- **Reuses the audit spine** for the timeline (no parallel activity store) and the
  notification spine for mentions — minimal new infrastructure.
- Turns scattered collaboration (task updates, feedback comments, presence bar, audit
  explorer) into one coherent, record-safe collaboration layer.
```
