# SCDMS — Submission & Commission Decision Management System

A full-stack web application for the **Public Service Commission (PSC) of Vanuatu** that manages the complete lifecycle of personnel and organisational decisions: ministry submission → PSC intake and assessment → OPSC unit checklist review → Commission sitting → formal minutes and Commission decision → post-decision task allocation and implementation tracking. It also runs the Commission's agenda/minutes process end-to-end, an organisational-restructure (ODU) and Task Force (IPDU) board-paper pipeline, travel and compliance forms, and a full BI/reporting layer.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Feature Tour](#feature-tour)
5. [User Roles](#user-roles)
6. [Submission Workflow Stages](#submission-workflow-stages)
7. [Commission Agenda & Minutes Workflow](#commission-agenda--minutes-workflow)
8. [Authentication & Security](#authentication--security)
9. [Data Model](#data-model)
10. [API Reference](#api-reference)
11. [Dynamic Form Builder](#dynamic-form-builder)
12. [Environment Variables](#environment-variables)
13. [Running with Docker](#running-with-docker)
14. [Development Setup](#development-setup)
15. [Database Migrations](#database-migrations)
16. [Frontend Routes](#frontend-routes)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django `>=5.0,<7` (currently resolves to 6.0) + Django REST Framework `>=3.14` |
| Frontend framework | React 18.2 + Vite 5 |
| Database | PostgreSQL 16 |
| Cache / broker | Redis 7 (Celery broker/result backend on db 0, Django cache on db 1) |
| Task queue | Celery `>=5.3,<6` + django-celery-beat (DB-backed schedule) |
| Container runtime | Docker + Docker Compose |
| Authentication | JWT (djangorestframework-simplejwt) + TOTP 2FA (pyotp) + session PIN + brute-force lockout (django-axes) |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Calendar | FullCalendar |
| Document annotation / signing | Fabric.js + PDF.js + react-cropper |
| Rich text | Tiptap |
| PDF generation | WeasyPrint + Jinja2, jsPDF for client-side exports |
| AI features | Google Gemini (`google-genai`), with an OpenAI-compatible fallback path |
| Report/notebook generation | pandas, Jupyter/nbclient, Quarto, Typst |
| OCR / PDF processing | PyMuPDF, pypdf, pytesseract |
| Transactional email | Resend API (prod) / Mailpit (dev SMTP catcher) |
| Web push | pywebpush |
| API schema | drf-spectacular (OpenAPI 3) |
| Security tooling | bandit, pip-audit, nh3 (HTML sanitization) |
| i18n | i18next / react-i18next (English, French, Bislama) |
| Monitoring | Sentry (optional) |

---

## Architecture Overview

```
                        ┌─────────────────────────────────┐
                        │           Browser / Client       │
                        │   React 18  ·  Vite  ·  Tailwind │
                        └────────────────┬────────────────┘
                                         │ HTTPS
                        ┌────────────────▼────────────────┐
                        │         Nginx (web service)      │
                        │   Serves React build + proxies   │
                        │   /api/* → Django backend        │
                        └────────────────┬────────────────┘
                                         │ HTTP (internal)
                ┌────────────────────────▼─────────────────────────┐
                │                Django / DRF (backend)             │
                │  JWT auth · RBAC · Workflow engine · REST API     │
                └──────┬─────────────────────┬──────────────────────┘
                       │                     │
          ┌────────────▼────────┐   ┌────────▼──────────┐
          │   PostgreSQL 16     │   │     Redis 7        │
          │   Primary data store│   │  Celery broker +   │
          └─────────────────────┘   │  result backend    │
                                    └────────┬───────────┘
                               ┌─────────────▼──────────────┐
                               │  Celery Worker + Beat       │
                               │  Background jobs, scheduled │
                               │  tasks, AI feedback, backup │
                               └────────────────────────────┘
```

**Network segmentation** (`docker-compose.yml`): two isolated bridge networks. `internal` carries `db` and `redis` and is marked `internal: true` — **no outbound internet access at all**, even if a container on it were compromised. `app` carries `web` ↔ `backend` and gives `celery_worker` its only outbound path (needed for Gemini API calls). Only `web` is published to the host.

**Production overlay** (`docker-compose.prod.yml`, `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`): adds TLS termination on `web` (certificates renewed on the host via `certbot` + DNS-01, mounted read-only) and a `cloudflared` sidecar — an outbound-only Cloudflare Tunnel connector, so the server needs no inbound firewall rule or public port-forward to be reachable at its public hostname.

---

## Project Structure

### Backend (`backend/`)

```
backend/
├── config/
│   ├── settings.py          # Django settings (12-factor, env-driven)
│   ├── urls.py              # Root URL conf — mounts /api/ and /admin/
│   ├── celery.py            # Celery app init and task autodiscovery
│   ├── wsgi.py / asgi.py
├── tracker/                 # Main application — 90 models, ~4,700 lines in models.py alone
│   ├── models.py            # All models + shared workflow enums
│   ├── serializers.py       # DRF serializers
│   ├── views.py             # ViewSets and function-based views (the largest file — 13k+ lines)
│   ├── urls.py               # Router registrations and manual URL patterns
│   ├── transitions.py       # Submission workflow state-machine: allowed transitions per role
│   ├── rbac.py               # Role-Based Access Control helper functions
│   ├── auth.py                # Custom authentication classes, PIN handling
│   ├── decision_allocation.py # Post-signing: advance submission stages, allocate CommissionTasks
│   ├── agenda_carryover.py    # Auto-routes late-ready submissions to the next eligible sitting
│   ├── agenda_sections.py     # 15 numbered agenda categories
│   ├── minute_intake.py       # Per-agenda-item minute drafting, seeded from live discussion notes
│   ├── minutes_access.py      # Server-side redaction of minutes content by OPSC unit
│   ├── subway_map.py          # Collapses 34 granular stages into 5 ministry-facing "stations"
│   ├── integrity_sweep.py     # Daily rule-based sweep flagging structurally invalid submissions
│   ├── mentions.py            # @mention parsing + RBAC-aware notification fan-out
│   ├── opsc_access.py         # Ministry-side vs. OPSC-internal visibility rules
│   ├── odu_checklist_rules.py / odu_checklist_prefill.py   # ODU restructure checklist logic
│   ├── ipdu_rules.py          # IPDU Task Force / Allowance board-paper routing
│   ├── travel_forms.py / travel_letter.py / travel_signatures.py  # PSC 4.4/4.5/4.6 travel forms
│   ├── compliance_forms.py    # OPSC-internal COMP-* compliance submission types
│   ├── intelligence_views.py / smart_report_views.py / report_template_views.py  # BI/reporting layer
│   ├── automation_views.py / rules_views.py   # "Act" automation engine + "Watch" flag engine
│   ├── knowledge_guides.py    # Seeded role-based user guides
│   ├── letters/                # Templated official letters (recruitment, cessation, secondment, allowances, leave payout)
│   ├── decision_service.py / decision_proof.py  # Tamper-evident, hashed Commission decision snapshots
│   ├── email_notify.py / email_backend.py / email_templates.py  # In-app + email notification dispatch
│   ├── tasks.py                # Celery async tasks
│   ├── logout_scheduler.py     # Celery Beat: session-cap force-logout (5pm/8h trust window)
│   ├── audit.py                # Audit log helpers
│   ├── admin.py / apps.py
│   ├── management/commands/    # seed_tracker, backup_db, purge_expired_data, seed_odu_forms, …
│   ├── migrations/              # 258 ordered migrations
│   └── templates/               # HTML email + PDF templates
├── manage.py / requirements.txt / Dockerfile
```

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── api/client.js         # Axios instance: JWT attach, refresh-and-retry on 401, pagination unwrap
│   ├── context/
│   │   ├── AuthContext.jsx    # Session state, login/logout, inactivity-lock timer
│   │   ├── ToastContext.jsx / ConfirmContext.jsx / ThemeContext.jsx
│   ├── router/index.jsx       # All ~60 routes, public + protected
│   ├── components/
│   │   ├── auth/RequireAuth.jsx   # Gates: authenticated → not locked → password set → PIN set → in
│   │   ├── layout/Layout.jsx, Header.jsx, Sidebar.jsx
│   │   └── shared/                 # DynamicFormRenderer, MultiPageFormRenderer, PageHeader, …
│   ├── pages/
│   │   ├── auth/       # Login, 2FA, TOTP setup, PIN setup, lock screen, password reset
│   │   ├── psc/         # Submissions, dashboards, reports, intelligence, knowledge base
│   │   ├── secretariat/ # Meetings, agenda, minutes, decisions, tasks, notifications
│   │   ├── admin/       # Users/roles, form builder, system config, security, knowledge base admin
│   │   ├── odu/         # ODU restructure checklist + board paper
│   │   ├── ipdu/        # IPDU board paper
│   │   ├── meeting/     # Meeting room hub
│   │   ├── feedback/    # Feedback checklist
│   │   └── public/      # Unauthenticated submission tracking
│   ├── hooks/ / utils/ / constants/ / i18n/
│   └── App.jsx
├── public/ / index.html / vite.config.js / tailwind.config.js / Dockerfile
```

> A handful of files under `pages/pages/`, `pages/dashboard/`, `pages/forms/`, `pages/analytics/`, and `pages/ministry/` are unused leftovers from the original admin-template starter kit (not imported by the router). Safe to ignore or clean up — they are not part of the live application.

---

## Feature Tour

### Submissions (ministry ↔ PSC ↔ Commission)

The core pipeline: a ministry HR officer drafts a submission against a digitized PSC form, routes it through DG endorsement, submits to PSC, PSC registers and routes it to the correct OPSC unit, a unit manager runs a checklist review, a unit principal/senior officer assesses it, and it's forwarded to the Commission for a decision. See [Submission Workflow Stages](#submission-workflow-stages) for the full 34-stage state machine, and `subway_map.py` for the simplified 5-station view ministries actually see.

### Commission Agenda, Sittings & Minutes

Full sitting lifecycle: schedule a `Meeting`, auto-place forwarded submissions onto the correct agenda section (`agenda_carryover.py`, cutoff-aware), Secretary/Chairman review and endorse the agenda (auto-circulates to Commission members on endorsement), a live Sitting Pack/Sitting Workspace for running the meeting, AI-assisted minute drafting from a transcript or plain-English notes (`minute_intake.py`), and a full multi-stage minutes approval chain through to signature — see [Commission Agenda & Minutes Workflow](#commission-agenda--minutes-workflow) below for the complete detail. Commissioners get a consolidated "My Notes" page listing every item across a sitting's agenda with their private prep notes inline.

### Decisions & Post-Decision Implementation

Once minutes are signed, `decision_allocation.py` advances each decided submission to its outcome stage and auto-creates a `CommissionTask` for the responsible unit manager — idempotently, so re-signing a corrected minutes document doesn't duplicate tasks. Tasks support sub-tasks and status-update logging (`CommissionTaskUpdate`, `CommissionSubTask`). Outcome letters are generated from the `letters/` template package by HR action type (recruitment, cessation, secondment, allowances, leave payout). Decisions are recorded as tamper-evident, SHA-256-hashed snapshots (`decision_proof.py`) that ministries must acknowledge receipt of in-system.

### ODU Restructure Workflow

Organisational restructure / establishment-variation submissions (`ORG-3.1`, `PSC 2-1`). Rather than making a ministry re-answer a duplicate checklist, ODU's 20-item verification checklist is **auto-derived** from the ministry's own digitized form data and attached required documents (`odu_checklist_prefill.py`); ODU staff review and finalize it, then prepare a board paper (`ODURestructureBoardPaper`) for the Commission.

### IPDU Board Papers

Task Force governance and Allowance Payment submissions. No separate checklist stage — the Manager IPDU authors the board paper directly and sends it straight to the Secretary.

### Travel Forms

PSC Form 4.4 (domestic travel allowance) and 4.5/4.6 (overseas travel). Routing depends on who initiates it (department staff, ministry CSU staff, department director/DG) but always funnels through ODU → Secretary, and generates an official travel approval letter on completion.

### Compliance Module

OPSC-internal `COMP-*` submission types, initiated by the Compliance unit itself (not ministry HR) and routed through the internal Secretary-review path rather than the ministry checklist pipeline.

### Intelligence, Analytics & Reporting

A BI/data-explorer layer: custom `Dashboard`s with tiles, native filters, tabs and tags; a query/exploration engine with saved explorations; a "Smart Report" enterprise report engine; admin-managed `ReportTemplate`s with parameter validation; and dedicated dashboard surfaces — Executive Dashboard, Workload Dashboard, Ministry Performance, Pending Decisions, Implementation Dashboard, Annual Report.

### Automations, Alert Rules & Flag Monitor

Two related rule engines: **Watch** (`SubmissionRule` / `SubmissionFlag`) monitors submissions and other entities and raises flags surfaced on the Flag Monitor page; **Act** (`Automation` / `AutomationRun`) triggers automated actions on match. Both are multi-entity (not submission-only).

### Knowledge Base

Seeded role-based user guides (HR manager, unit manager, secretary) plus a general wiki-style article system with an admin editor.

### Commission Calendar

A FullCalendar-powered view of sittings and deadlines.

### Audit Trail & Integrity Sweep

A browsable, filterable UI over the full `AuditLog` (every login, create, update, delete, download, and stage transition is logged). Separately, a daily rule-based (non-AI) integrity sweep flags submissions sitting in structurally invalid states for admin review.

### Feedback System

In-app bug/feedback reporting with severity/status/type classification and async AI-assisted analysis on comments, plus a periodic feedback-checklist rating flow shown to end users.

### Notifications

Multi-channel: in-app (`Notification`), email, and browser web-push (`pywebpush` + `WebPushSubscription`).

### Public Submission Tracking

An unauthenticated status lookup by reference number at `/track` — deliberately minimal, returns only unit + role title and current stage, never applicant name, documents, comments, or staff identity.

---

## User Roles

Roles are defined in `tracker/models.py` as `Role(TextChoices)` (28 total) and assigned via the `Profile` model.

### PSC Internal

| Role key | Display name |
|---|---|
| `psc_admin` | PSC Administrator |
| `receptionist` | Receptionist |
| `psc_officer` | PSC Officer |
| `psc_secretary` | PSC Secretary |
| `senior_admin_officer` | Senior Administration Officer |
| `psc_commissioner` | PSC Commissioner |
| `chairperson` | Chairperson, PSC |

### Post-Decision Execution

| Role key | Display name |
|---|---|
| `psc_manager` | OPSC Manager |
| `principal_officer` | Principal Officer |
| `senior_officer` | Senior Officer |

### Ministry-Side

| Role key | Display name |
|---|---|
| `head_of_agency` | Head of Agency (DG/Director) |
| `ministry_hr` | Ministry HR Officer |
| `dept_admin` | Department Admin Officer |
| `traveller` | Public Servant (Travel) |

### OPSC Unit Manager (checklist review gate)

| Role key | Unit |
|---|---|
| `vipam_manager` | VIPAM |
| `hr_unit_manager` | HR Unit |
| `odu_manager` | ODU |
| `compliance_manager` | Compliance |
| `compliance_senior` | Compliance (senior tier) |
| `csu_manager` | CSU |
| `ipdu_manager` | IPDU |

### OPSC Unit Principal (assigned assessment work)

| Role key | Unit |
|---|---|
| `vipam_principal` | VIPAM |
| `hr_unit_principal` | HR Unit |
| `odu_principal` | ODU |
| `compliance_principal` | Compliance |

### OPSC Unit Senior (same standing as a unit's Principal in every workflow)

| Role key | Unit |
|---|---|
| `vipam_senior` | VIPAM |
| `hr_unit_senior` | HR Unit |
| `odu_senior` | ODU |
| `csu_senior` | CSU |

### Additional Compliance-Adjacent Roles

| Role key | Display name |
|---|---|
| `secretary_opsc` | Secretary, OPSC |
| `dg_director` | DG / Director (Ministry) |
| `commission_member` | Commission Member |
| `panel_member` | Investigation Panel Member |

---

## Submission Workflow Stages

Stage transitions are validated in `tracker/transitions.py`. Each role can only advance to permitted next stages; the engine also enforces unit routing so submissions go to the correct unit's manager. There are 34 stages in `WorkflowStage`; `subway_map.py` collapses these into 5 simplified "stations" for the ministry-facing progress UI.

```
Ministry side
─────────────
  draft
    ├─► pending_dg_endorsement ──► dg_approved
    ├─► pending_manager_approval
    ├─► pending_second_approval
    └─► submitted
          └─► received_by_psc
                ├─► returned_for_clarification ──► resubmitted
                └─► registered_routed
                      └─► manager_checklist_review        ← Unit Manager
                            └─► under_assessment            ← Unit Principal / Senior / Manager
                                  ├─► pending_secretary_approval
                                  ├─► compliance_under_review   (CMS routing)
                                  ├─► deferred / tabled
                                  ├─► awaiting_legal_advice
                                  ├─► awaiting_cabinet_decision
                                  ├─► secretary_review            (internal/OPSC-only submissions)
                                  └─► forwarded_to_commission
                                        └─► commission_sitting
                                              ├─► matters_arising
                                              ├─► approved ──► minutes_drafted_signed
                                              │                    └─► decision_entered_assigned
                                              │                          └─► under_implementation
                                              │                                └─► implementation_report
                                              ├─► noted
                                              ├─► not_approved
                                              ├─► rejected
                                              ├─► returned
                                              ├─► deferred_back_to_hr
                                              └─► deferred_back_to_unit
```

A submission can also be `recalled` by the originating ministry before a final decision.

---

## Commission Agenda & Minutes Workflow

The minutes process mirrors the Commission's real paper-era sign-off procedure, not just "draft → signed." `Minutes.status` (`MinutesStatus`) moves through:

```
draft
  └─► pending_secretariat_review   (Secretary + Chairman review, 1 working-day SLA)
        └─► reviewed                (both have independently approved)
              └─► circulated_to_commissioners   (2 working-day SLA)
                    └─► returned                 (Commissioner review window closed)
                          └─► awaiting_signature  (printed for wet-ink signature)
                                └─► signed
```

1. **Draft** — the minute-taker (Senior Admin Officer) drafts minutes, seeded from `MinuteAgendaIntake` per-item notes (optionally AI-formatted from a transcript or plain-English input), then **submits for review**.
2. **Secretary & Chairman review** — both must **independently approve**; each has a 1 working-day SLA (`add_working_days`, Vanuatu public holiday–aware). Status advances to `reviewed` only once both have signed off.
3. **Circulated to Commissioners** — the Secretary circulates the reviewed minutes to every Commissioner for comment (2 working-day SLA). Commissioners post visible, collaborative comments (`MinutesComment` — distinct from the private per-item `SubmissionPrivateNote` used for sitting prep) and then **return** the minutes to the Secretariat once done.
4. **Awaiting signature** — the minute-taker sends the returned minutes for signature; this is the interim manual (wet-ink) process pending a Vanuatu digital-signature law. Commissioners physically sign the printed copy.
5. **Signed** — the Senior Admin Officer uploads the scanned signed copy (`upload-signed`). An in-app PIN-confirmed digital `sign` action also exists, ready to become the primary path once digital signatures are legally recognised.
6. **Task allocation** — a **separate, explicit** Secretary action (`allocate-tasks`), deliberately decoupled from the signing step so a bad scan upload can be caught before unit managers are notified of their decision tasks. This runs `decision_allocation.py`: advances each decided submission to its outcome stage and creates `CommissionTask` rows.

Each transition fires an in-app notification to the relevant party (minute-taker, Secretary + Chairman, all Commissioners) via `email_notify.py`.

**Agenda side**: `AgendaStatus` is intentionally just three states — `draft → with_chairman → circulated` — endorsement by the Chairman now auto-circulates to Commission members in one step (two intermediate states were deliberately removed). Late-ready submissions are automatically routed onto the next eligible sitting's agenda via `agenda_carryover.py`, cutoff- and category-aware.

---

## Authentication & Security

### JWT

- Access token TTL: `JWT_ACCESS_MINUTES` (default 30 min) — a rolling per-token duration, not tied to activity.
- Refresh token TTL: `JWT_REFRESH_DAYS` (default 7 days); rotated and blacklisted after use (`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`).
- The frontend (`api/client.js`) transparently refreshes an expired access token on a 401 and retries the original request once; if refresh itself fails, it clears stored tokens and hard-redirects to `/auth/login` rather than leaving a page stuck on a stale error.
- `APIKeyAuthentication.authenticate_header()` is implemented specifically so DRF returns a real 401 (not a silently-downgraded 403) for expired/invalid Bearer tokens — DRF picks its `WWW-Authenticate` header from the *first* configured authenticator, and without this override every auth failure across the API was being misreported as 403.

### Session PIN (mandatory) + Lock Screen

- Every authenticated user is required to set a 4–6 digit session PIN (`SessionPinSetupView`) — `RequireAuth` redirects anyone without one to a dedicated `/auth/set-pin` page, on first login and on every login until they do.
- After a period of inactivity (per-user configurable, default 15 minutes, in Account settings), the app auto-locks to a dedicated `/auth/lock` page — not a modal — where re-entering the PIN resumes the session without a full password re-login. A manual lock icon in the topbar locks on demand.
- **Trusted-device shortcut**: if a valid `TrustedSession` exists for the account/device/IP, the login endpoint returns `pin_required: true` instead of issuing tokens, and the frontend routes straight to the PIN-entry lock screen instead of asking for the password again.
- `TrustedSession.compute_expiry()` caps trust at `min(now + SESSION_TRUST_HOURS, 17:00 Pacific/Efate same day)` — a Celery Beat task (`logout_scheduler.py`, every 15 min) force-blacklists any session past that cutoff (non-admin accounts only).

### TOTP Two-Factor Authentication

- Secrets stored per-profile (`Profile.totp_secret`); compatible with Microsoft/Google Authenticator and Authy.
- Globally toggleable via the Settings > Security master switch — when off, previously-enrolled users are simply not prompted (their secret is left intact, not revoked).

### Brute-Force Protection

- `django-axes`: default 5 failures → 1-hour lockout (`AXES_FAILURE_LIMIT` / `AXES_COOLOFF_HOURS`), plus an application-level two-tier temp/hard lockout counter on `Profile`.

### Audit Logging & Integrity

- Every significant action (login, create, update, delete, download, stage transition) is appended to `AuditLog`, browsable via the Audit Trail Explorer.
- `integrity_sweep.py` runs a daily non-AI rule sweep flagging submissions in structurally invalid states onto the Integrity Flags admin page.
- Commission decisions are recorded as tamper-evident, SHA-256-hashed canonical snapshots (`decision_proof.py` / `decision_service.py`), independent of the audit log.

### RBAC

- `SystemPermission` records named capabilities; `RoleDefinition` maps roles to permitted capabilities.
- `HasProfilePermission` (DRF permission class) gates API access per endpoint; `minutes_access.py` additionally redacts minutes content by OPSC unit at the serializer layer.

---

## Data Model

`backend/tracker/models.py` defines **90 models** across roughly these areas (see the file directly for full field-level detail):

| Area | Representative models |
|---|---|
| Org structure | `Ministry`, `Department`, `Unit` |
| Forms / agenda config | `AgendaSection`, `FormCategory`, `PSCFormType`, `PSCFormField`, `PSCFormResponse`, `RequiredDocument`, `PublicHoliday` |
| Meetings / Agenda / Minutes | `Meeting`, `AgendaItem`, `MeetingOtherMatter`, `AgendaDeferral`, `SittingPackSession`, `SubmissionPresence`, `SubmissionPrivateNote`, `Minutes`, `MinutesComment`, `MinuteAgendaIntake`, `MeetingTranscript`, `MeetingBriefingPack` |
| Security / Auth | `Profile`, `TrustedSession`, `FlyingMinuteSignature`, `PasswordResetToken`, `APIKey`, `PasswordHistory`, `AuditLog`, `AIGenerationLog`, `IntegrityFlag`, `SecurityIncident`, `SecurityScan`, `SecurityNotice`, `SystemPermission`, `RoleDefinition` |
| Submissions (core) | `Submission`, `SubmissionStageEvent`, `SubmissionCoAssignment`, `SubmissionDocument`, `DocumentSignature`, `DocumentAnnotation`, `SubmissionChecklistItem`/`Response` |
| Tasks / Decisions / Implementation | `CommissionTask`, `CommissionTaskUpdate`, `CommissionSubTask`, `DecisionRegisterReport`, `ImplementationDashboardReport`, `AnnualReport`, `ReportTemplate`, `SmartReport`, `DecisionService`, `DecisionLetter`, `WorkflowEvent` |
| ODU / IPDU / Travel | `RestructureSubmissionData`, `ODURestructureChecklist`, `ODURestructureBoardPaper`, `IPDUBoardPaper`, `TravelApprovalLetter`, `FormSectionSignature` |
| Intelligence / Reporting | `Dashboard`, `IntelligenceFavorite`, `IntelligenceReport`, `SavedExploration`, `SubmissionRule`, `SubmissionFlag`, `Automation`, `AutomationRun` |
| Knowledge Base | `KnowledgeCategory`, `KnowledgeArticle` |
| Feedback | `FeedbackReport`, `FeedbackComment`, `FeedbackChecklistResponse` |
| Notifications / Comments | `Notification`, `Comment`, `Mention`, `WebPushSubscription`, `DeadlineReminderDraft` |
| AI / Chat | `StaffChatSession`, `StaffChatMessage` |
| Misc infra | `UiTranslation`, `DocumentVersion`, `SystemSetting`, `EmailTemplate`, `LetterTemplate`, `ReferenceCounter` |

---

## API Reference

All endpoints are prefixed with `/api/`. Authentication is required via `Authorization: Bearer <access_token>` unless noted. This is a representative index by module, not an exhaustive endpoint list — browse the live OpenAPI schema (drf-spectacular) or `tracker/urls.py` for the complete set spanning several hundred routes.

### Auth & Session

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/token/` | Obtain JWT pair (login) — may instead return `two_factor_required`, `pin_required`, or `must_change_password` |
| POST | `/auth/token/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET | `/me/` | Current user + profile |
| POST | `/me/change-password/` | Change own password |
| GET | `/auth/password-policy/` | Password requirements |
| POST | `/auth/password-reset/request/` \| `/confirm/` | Password reset flow |
| POST | `/auth/totp/setup/` \| `/verify-setup/` \| `/verify/` \| `/disable/` | TOTP 2FA lifecycle |
| POST | `/auth/session-pin/setup/` | Set/change session PIN |
| POST | `/auth/session-pin/verify/` | Verify PIN → tokens (trusted-device / unlock) |

### Submissions

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/submissions/` | List (filtered by role/unit) / create |
| GET/PATCH | `/submissions/{id}/` | Detail / update |
| POST | `/submissions/{id}/transition/` | Advance workflow stage |
| POST | `/submissions/{id}/assign/` | Assign to a unit principal |
| GET | `/submissions/{id}/events/` | Workflow event audit trail |
| GET/POST | `/submissions/{id}/documents/`, `/dynamic-form-response/`, `/comments/`, `/private-notes/` | Attachments, form answers, comments, private notes |

### Meetings, Agenda & Minutes

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/meetings/` | Commission sittings |
| POST | `/meetings/{id}/approve-agenda/`, `/submit-to-chairman/`, `/admit-reserve/` | Agenda lifecycle actions |
| GET | `/meetings/{id}/my-notes/` | Commissioner's consolidated agenda + private notes |
| GET/POST | `/agenda-items/` | Agenda items |
| GET/POST | `/minutes/` | Minutes documents |
| POST | `/minutes/{id}/submit-for-review/`, `/secretariat-approve/`, `/circulate-to-commissioners/`, `/return-to-secretariat/`, `/mark-for-signature/`, `/upload-signed/`, `/sign/`, `/allocate-tasks/` | Full minutes approval chain (see [above](#commission-agenda--minutes-workflow)) |
| GET/POST | `/minutes/{id}/comments/` | Commissioner comments on circulated minutes |
| GET/POST | `/transcripts/` | AI-processed sitting transcripts |

### Commission Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/commission-tasks/` | Post-decision tasks |
| GET/POST | `/commission-tasks/{id}/subtasks/`, `/status-updates/` | Sub-tasks, status log |

### Document Signing & Annotation

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/doc-annotations/` | Fabric.js annotation objects |
| GET/POST | `/doc-signatures/` | Placed signatures |
| GET/POST | `/my-signature/` | User's own signature image |

### Intelligence, Reporting & Automation

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/dashboards/`, `/intelligence/query/`, `/intelligence/datasets/` | BI dashboards + query engine |
| GET/POST | `/smart-reports/`, `/report-templates/` | Reporting engine |
| GET/POST | `/rules/`, `/flags/` | Watch engine (monitoring + flags) |
| GET/POST | `/automations/`, `/automation-runs/` | Act engine |

### System Administration

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/users/` | User and profile management |
| GET/POST | `/permissions/`, `/role-defs/` | RBAC configuration |
| GET/POST | `/api-keys/` | API key management |
| GET/POST | `/settings/` | Runtime system configuration |
| GET/POST | `/backup/` | Database backup/restore |
| GET/POST | `/audit-logs/`, `/incidents/`, `/security-scans/`, `/security-notices/` | Security administration |
| GET | `/auth/security-audit/`, `/auth/api-inventory/` | Security reporting |
| GET/POST | `/knowledge-base/categories/`, `/articles/` | Knowledge Base admin |

### Feedback & Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/feedback/`, `/feedback-comments/` | User feedback reports |
| GET | `/auth/feedback-status/` | Feedback stats summary |
| GET/POST | `/notifications/` | In-app notifications |

### Dashboard, Search & Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/`, `/reports/stats/` | KPI + reporting data |
| GET | `/search/` | Global full-text search |
| GET | `/track/` | Public unauthenticated submission status lookup |

---

## Dynamic Form Builder

The system includes a no-code form designer for digitizing PSC forms.

### How it works

1. **Form Types** (`PSCFormType`) — each corresponds to a PSC form (e.g. *PSC Form 5-1*). A form type can be marked `is_digitized` and given a `digitized_form_key`.
2. **Form Fields** (`PSCFormField`) — ordered field definitions attached to a form type. Supported field types:

   | Type | Description |
   |---|---|
   | `section_header` | Visual section divider; `start_new_page=true` starts a new form page |
   | `text` | Single-line text input |
   | `textarea` | Multi-line paragraph |
   | `number` | Numeric input |
   | `date` | Date picker |
   | `datetime` | Date + time picker |
   | `select` | Dropdown (choices: one per line) |
   | `radio` | Radio button group |
   | `checkbox` | Boolean yes/no toggle |

3. **Multi-page rendering** — `MultiPageFormRenderer` splits a form into pages wherever a `section_header` with `start_new_page=true` appears; other section headers render as inline subheadings.

4. **Import** — the Form Builder accepts `.xml` or `.json` bulk field-definition imports:

   **XML:**
   ```xml
   <fields>
     <field>
       <label>Full Name</label>
       <field_key>full_name</field_key>
       <field_type>text</field_type>
       <is_required>true</is_required>
       <display_order>10</display_order>
     </field>
   </fields>
   ```

   **JSON:**
   ```json
   { "fields": [ { "label": "Full Name", "field_key": "full_name", "field_type": "text", "is_required": true, "display_order": 10 } ] }
   ```

5. **Responses** (`PSCFormResponse`) — user answers stored as a JSON blob keyed by `field_key`, linked to the submission.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before starting the stack.

```env
# ── Django ────────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=change-me-to-a-long-random-string
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,web
SECURE_SSL_REDIRECT=true

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_DB=commission_decision
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
POSTGRES_HOST=db
POSTGRES_PORT=5432

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:8080

# ── Auth ─────────────────────────────────────────────────────────────────────
ALLOW_OPEN_REGISTRATION=false
TWO_FACTOR_REQUIRED=false
JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=7
SESSION_TRUST_HOURS=8

# ── Brute-force protection ────────────────────────────────────────────────────
AXES_FAILURE_LIMIT=5
AXES_COOLOFF_HOURS=1

# ── Email (SMTP) — development uses Mailpit (see Local SMTP below) ───────────
EMAIL_BACKEND=tracker.email_backend.DynamicEmailBackend
DEFAULT_FROM_EMAIL=PSC Tracker Dev <dev@localhost>
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_TLS=false
SMTP_SSL=false
SMTP_USER=
SMTP_PASSWORD=
RESEND_API_KEY=

# ── Celery / Redis ────────────────────────────────────────────────────────────
REDIS_PASSWORD=<strong-redis-password>
CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
CELERY_RESULT_BACKEND=redis://:${REDIS_PASSWORD}@redis:6379/0

# ── Google Gemini (AI features) ────────────────────────────────────────────
GEMINI_API_KEY=
GEMINI_MODEL_HAIKU=gemini-flash-lite-latest
GEMINI_MODEL_SONNET=gemini-flash-latest

# ── Monitoring (optional) ─────────────────────────────────────────────────────
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# ── Web ───────────────────────────────────────────────────────────────────────
WEB_PORT=8080
```

---

## Running with Docker

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Compose plugin (Linux)
- A populated `.env` file (see above)

### Start the full stack

```bash
docker compose up -d
```

This starts seven services: `db`, `redis`, `mailpit`, `backend`, `celery_worker`, `celery_beat`, `web`.

The application is available at **http://localhost:8080** (or the port set by `WEB_PORT`).

### Production (TLS + public exposure)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Adds TLS on `web` (host-managed `certbot` certificates, DNS-01) and a `cloudflared` Cloudflare Tunnel sidecar for outbound-only public exposure — no inbound firewall rule needed. See **[docs/deployment-tls.md](docs/deployment-tls.md)**.

For **Render.com** (managed Postgres, Redis, Gunicorn API, static frontend), see **[docs/deployment-render.md](docs/deployment-render.md)** and the root **`render.yaml`** blueprint.

### Local SMTP (development)

[Mailpit](https://github.com/axllent/mailpit) captures all outgoing mail so nothing is sent to real addresses.

| Service | URL |
|---------|-----|
| Web inbox | **http://localhost:8025** |
| SMTP (from your machine) | `localhost:1025` |
| SMTP (from Docker backend) | `mailpit:1025` |

Test: use **Forgot password** on the login page with a seeded user email, then open http://localhost:8025. Environment variables take priority over SMTP settings stored in the database (`SystemSetting`).

**Console-only (no SMTP):** set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`.

### First run — apply migrations and seed data

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_tracker
docker compose exec backend python manage.py createsuperuser
```

### Common management commands

```bash
docker compose exec backend python manage.py makemigrations tracker --name "describe_change"
docker compose exec backend python manage.py migrate tracker
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py test tracker
docker compose exec backend python manage.py backup_db
```

### Rebuilding after code changes

```bash
docker compose build backend && docker compose up -d backend
docker compose build web && docker compose up -d web
docker compose build && docker compose up -d
```

### Viewing logs

```bash
docker compose logs -f backend
docker compose logs -f celery_worker
docker compose logs -f web
```

---

## Development Setup

### Backend (local, without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Point POSTGRES_HOST and CELERY_BROKER_URL in .env to a running Postgres/Redis instance.
docker compose up -d mailpit     # optional: local mail capture

python manage.py migrate
python manage.py seed_tracker
python manage.py runserver
```

### Frontend (local)

```bash
cd frontend
npm install
npm run dev       # Vite dev server at http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8000` (see `vite.config.js`).

---

## Database Migrations

Migrations live in `backend/tracker/migrations/` — **258 migrations** as of this writing (`0001` through `0247`). Early milestones:

| Migration | What it adds |
|---|---|
| `0001_initial` | Core models (Submission, Meeting, Profile, Ministry, Department) |
| `0003_roles_permissions` | RBAC system |
| `0008_security*` | SecurityIncident, SecurityScan, AuditLog |
| `0014_workflow_stage_expansion` | Extended WorkflowStage enum |
| `0025_sop_updates_and_flying_minutes` | Flying Minutes meeting type |
| `0034–0038_psc_form_*` | Dynamic form builder (PSCFormType/Field/Response) |
| `0040_unit_principals_and_submission_assignment` | Unit principal roles |

Recent milestones (`0204`–`0247`):

| Range | What it adds |
|---|---|
| `0204–0230` | ODU restructure workflow, then Business Plan, Corporate Plan, Annual Report, and Special Skills Allowance submission types onboarded end-to-end (routing, required documents, reminders, field pagination) |
| `0232` | Role model expansion (FR-05 roles) |
| `0233` | Compliance case-management feature removed/simplified |
| `0234` | Session PIN disabled system-wide (later re-enabled at the application layer) |
| `0238` | `AIGenerationLog` — AI reliability/audit tracking |
| `0239` | `IntegrityFlag` |
| `0240–0242` | IPDU unit + Board Paper workflow built out |
| `0244–0245` | Agenda status simplified to draft/with_chairman/circulated; agenda sections renumbered |
| `0246` | `SubmissionPrivateNote` — Commissioner private prep notes |
| `0247` | Chairman-review timestamp fields on Minutes — the Secretary/Chairman/Commissioner minutes approval chain |

### Conventions

- Idempotent SQL uses `RunSQL("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")` paired with `SeparateDatabaseAndState` to keep migration state in sync without failing on re-runs.
- Seed migrations use `RunPython` with an explicit `reverse_code=migrations.RunPython.noop`.

---

## Frontend Routes

All routes except the auth group require an authenticated session (`RequireAuth` — which also gates on: not locked → password not force-expired → session PIN set).

### Public

| Path | Page |
|---|---|
| `/auth/login` | Login |
| `/auth/reset-password`, `/auth/reset-password/confirm` | Password reset |
| `/auth/2fa` | TOTP verification step |
| `/auth/totp-setup` | Authenticator app setup wizard |
| `/auth/set-pin` | Mandatory session PIN setup |
| `/auth/lock` | Session lock / PIN unlock screen |
| `/track` | Public submission status lookup |

### Protected — Submissions & Dashboards

| Path | Page |
|---|---|
| `/` | PSC Dashboard |
| `/submissions`, `/submissions/new`, `/submissions/:id` | Submission log, create, detail |
| `/reports`, `/reports/templates` | Reports |
| `/intelligence`, `/intelligence/dashboards[/:id]`, `/intelligence/reports`, `/intelligence/flags`, `/intelligence/rules`, `/intelligence/automations` | BI / Intelligence suite |
| `/analytics`, `/executive-dashboard`, `/workload`, `/pending-decisions`, `/ministry-performance`, `/implementation`, `/annual-report` | Dashboard surfaces |
| `/calendar` | Commission Calendar |
| `/audit-trail` | Audit Trail Explorer |
| `/wiki`, `/wiki/:slug` | Knowledge Base |
| `/feedback/checklist` | Feedback checklist |

### Protected — Commission Secretariat

| Path | Page |
|---|---|
| `/secretariat/meeting-room` | Meeting Room Hub |
| `/secretariat/meetings`, `/secretariat/meetings/:meetingId/minutes`, `/secretariat/meetings/:meetingId/workspace` | Sittings, Minutes editor, Sitting Workspace |
| `/secretariat/agenda`, `/secretariat/agenda/my-notes`, `/secretariat/agenda/sitting-pack` | Agenda management, My Notes, Sitting Pack |
| `/secretariat/minutes` | Minutes index |
| `/secretariat/minute-intake[/:meetingId]` | Minute intake |
| `/secretariat/decisions` | Decision tracking |
| `/secretariat/deferred-agenda` | Deferred agenda items |
| `/secretariat/tasks` | Commission task allocation |
| `/secretariat/notifications` | Notification centre |

### Protected — Admin

| Path | Page |
|---|---|
| `/admin/roles-permissions` | Users + roles management |
| `/admin/ministries-departments` | Organisation structure |
| `/admin/form-types`, `/admin/form-types/:formTypeId/builder` | Form type registry + Dynamic form builder |
| `/admin/agenda-sections` | Agenda section configuration |
| `/admin/api-keys` | API key management |
| `/admin/system-config` | System configuration |
| `/admin/email-templates`, `/admin/letter-templates` | Templated communications |
| `/admin/daily-brief` | Daily brief configuration |
| `/admin/ui-translations` | UI translation management |
| `/admin/security` | Security settings and notices |
| `/admin/feedback` | Feedback management |
| `/admin/knowledge-base`, `/admin/knowledge-base/new`, `/admin/knowledge-base/edit/:slug` | Knowledge Base admin |
| `/admin/backup-restore` | Backup and restore |
| `/admin/trash` | Soft-delete recovery |
| `/ai-reliability`, `/integrity-flags` | AI reliability + integrity flag review |

### Protected — Account & Misc

| Path | Page |
|---|---|
| `/pages/account` | Account settings (PIN, 2FA, inactivity-lock preference, signature) |
| `/404` | Not found |

---
