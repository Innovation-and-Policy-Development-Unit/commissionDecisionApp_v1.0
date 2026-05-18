# SCDMS — Public Service Commission Decision Management System

A full-stack web application for the Public Service Commission of Vanuatu that manages the complete lifecycle of personnel decisions: from ministry submission through PSC assessment, commission sitting, formal minutes, and post-decision implementation tracking.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [User Roles](#user-roles)
5. [Workflow Stages](#workflow-stages)
6. [API Reference](#api-reference)
7. [Dynamic Form Builder](#dynamic-form-builder)
8. [Authentication & Security](#authentication--security)
9. [Environment Variables](#environment-variables)
10. [Running with Docker](#running-with-docker)
11. [Development Setup](#development-setup)
12. [Database Migrations](#database-migrations)
13. [Frontend Routes](#frontend-routes)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 5.0 + Django REST Framework |
| Frontend framework | React 18.2 + Vite |
| Database | PostgreSQL 16 |
| Cache / broker | Redis 7 |
| Task queue | Celery 5.3 + Celery Beat |
| Container runtime | Docker + Docker Compose |
| Authentication | JWT (djangorestframework-simplejwt) + TOTP 2FA |
| Styling | TailwindCSS |
| Charts | Recharts |
| Calendar | FullCalendar |
| Document annotation | Fabric.js + PDF.js |
| PDF generation | WeasyPrint |
| AI analysis | Google Gemini API |
| API schema | drf-spectacular (OpenAPI 3) |
| Brute-force protection | django-axes |

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

---

## Project Structure

### Backend (`backend/`)

```
backend/
├── config/
│   ├── settings.py          # Django settings (12-factor, env-driven)
│   ├── urls.py              # Root URL conf — mounts /api/ and /admin/
│   ├── celery.py            # Celery app init and task autodiscovery
│   ├── wsgi.py
│   └── asgi.py
├── tracker/                 # Main application
│   ├── models.py            # All 40+ models
│   ├── serializers.py       # DRF serializers
│   ├── views.py             # All ViewSets and function-based views
│   ├── urls.py              # Router registrations and manual URL patterns
│   ├── transitions.py       # Workflow state-machine: allowed transitions per role
│   ├── rbac.py              # Role-Based Access Control helper functions
│   ├── auth.py              # Custom token views, TOTP, PIN verification
│   ├── tasks.py             # Celery async tasks (backup, AI analysis, notifications)
│   ├── scheduler.py         # Celery Beat schedule registration
│   ├── audit.py             # Audit log helpers
│   ├── totp.py              # TOTP secret generation and verification
│   ├── email_backend.py     # Dynamic SMTP backend (reads config from DB at runtime)
│   ├── throttles.py         # Custom DRF throttle classes
│   ├── validators.py        # Field-level validators
│   ├── signals.py           # Post-save / post-delete signal handlers
│   ├── admin.py             # Django admin registrations
│   ├── apps.py
│   ├── management/
│   │   └── commands/
│   │       ├── seed_tracker.py       # Seeds roles, ministries, form categories
│   │       ├── backup_db.py          # Manual DB backup command
│   │       └── purge_expired_data.py # GDPR/retention cleanup
│   ├── migrations/          # 40+ ordered migrations
│   └── templates/           # HTML email templates
├── manage.py
├── requirements.txt
└── Dockerfile
```

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── api/
│   │   └── client.js        # Axios instance with JWT interceptor + response normaliser
│   ├── context/
│   │   ├── AuthContext.jsx   # Current user, login/logout helpers
│   │   ├── ToastContext.jsx  # Global toast notifications
│   │   └── ConfirmContext.jsx# Reusable confirmation dialog
│   ├── router/
│   │   └── index.jsx        # All protected and public routes
│   ├── components/
│   │   ├── auth/
│   │   │   └── RequireAuth.jsx
│   │   ├── layout/
│   │   │   └── Layout.jsx   # Sidebar + topbar shell
│   │   └── shared/
│   │       ├── DynamicFormRenderer.jsx    # Read-only dynamic form display
│   │       ├── MultiPageFormRenderer.jsx  # Multi-step form with stepper UI
│   │       └── PageHeader.jsx
│   ├── pages/
│   │   ├── auth/            # Login, 2FA, TOTP setup, password reset
│   │   ├── psc/             # Dashboard, submission log, submission detail/form, reports
│   │   ├── secretariat/     # Meetings, minutes editor, agenda, decisions, tasks, notifications
│   │   └── admin/           # Users, form builder, form types, ministries, system config
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Date formatters, file helpers, etc.
│   ├── constants/           # Static lookup tables
│   ├── i18n/                # i18next translation files
│   └── App.jsx
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.js
└── Dockerfile               # Builds React dist, serves via Nginx
```

---

## User Roles

Roles are defined in `tracker/models.py` as `Role(TextChoices)` and assigned via the `Profile` model.

### PSC Internal Roles

| Role key | Display name | Typical access |
|---|---|---|
| `psc_admin` | PSC Administrator | Full system access, form builder, user management |
| `psc_officer` | PSC Officer | Submission intake, registration, routing |
| `psc_secretary` | PSC Secretary | Minutes, agenda, commission sittings |
| `senior_admin_officer` | Senior Administration Officer | Reports, admin support |
| `psc_commissioner` | PSC Commissioner | Commission sitting participation |
| `chairperson` | Chairperson, PSC | Commission sitting chairperson |

### Post-Decision Execution Roles

| Role key | Display name |
|---|---|
| `psc_manager` | OPSC Manager |
| `principal_officer` | Principal Officer |
| `senior_officer` | Senior Officer |

### Ministry-Side Roles

| Role key | Display name |
|---|---|
| `head_of_agency` | Head of Agency (DG/Director) |
| `ministry_hr` | Ministry HR Officer |
| `dept_admin` | Department Admin Officer |

### OPSC Unit Manager Roles (Checklist review gate)

| Role key | Unit |
|---|---|
| `vipam_manager` | VIPAM |
| `hr_unit_manager` | HR Unit |
| `odu_manager` | ODU |
| `compliance_manager` | Compliance |

### OPSC Unit Principal Roles (Assigned assessment work)

| Role key | Unit |
|---|---|
| `vipam_principal` | VIPAM |
| `hr_unit_principal` | HR Unit |
| `odu_principal` | ODU |
| `compliance_principal` | Compliance |

---

## Workflow Stages

Stage transitions are validated in `tracker/transitions.py`. Each role can only advance to permitted next stages; the engine also enforces unit routing so submissions go to the correct unit's manager.

```
Ministry side
─────────────
  draft
    └─► submitted
          └─► received_by_psc
                ├─► returned_for_clarification ──► resubmitted
                └─► registered_routed
                      └─► manager_checklist_review   ← Unit Manager
                            └─► under_assessment      ← Unit Principal / Manager
                                  ├─► deferred
                                  ├─► tabled
                                  ├─► awaiting_legal_advice
                                  ├─► awaiting_cabinet_decision
                                  └─► forwarded_to_commission
                                        └─► commission_sitting
                                              ├─► matters_arising
                                              ├─► approved ──► minutes_drafted_signed
                                              │                    └─► decision_entered_assigned
                                              │                          └─► under_implementation
                                              │                                └─► implementation_report
                                              ├─► rejected
                                              ├─► returned
                                              └─► deferred_back_to_hr
```

---

## API Reference

All endpoints are prefixed with `/api/`. Authentication is required via `Authorization: Bearer <access_token>` unless noted.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/token/` | Obtain JWT pair (login) |
| POST | `/auth/token/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET | `/me/` | Current user + profile |
| POST | `/me/change-password/` | Change own password |
| GET | `/auth/password-policy/` | Password requirements |
| POST | `/auth/password-reset/request/` | Email password reset link |
| POST | `/auth/password-reset/confirm/` | Confirm reset with token |

### Two-Factor Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/totp/setup/` | Generate TOTP secret + QR code |
| POST | `/auth/totp/verify-setup/` | Confirm TOTP setup |
| POST | `/auth/totp/verify/` | Verify TOTP code at login |
| POST | `/auth/totp/disable/` | Disable 2FA for own account |
| POST | `/auth/session-pin/setup/` | Set session re-auth PIN |
| POST | `/auth/session-pin/verify/` | Verify PIN for re-auth |
| POST | `/auth/verify-pin/` | Quick PIN check |

### Submissions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/submissions/` | List (filtered by role/unit) |
| POST | `/submissions/` | Create new submission |
| GET | `/submissions/{id}/` | Detail |
| PATCH | `/submissions/{id}/` | Update |
| POST | `/submissions/{id}/transition/` | Advance workflow stage |
| POST | `/submissions/{id}/assign/` | Assign to a unit principal |
| GET | `/submissions/{id}/events/` | Workflow event audit trail |
| GET/POST | `/submissions/{id}/documents/` | File attachments |
| GET/POST | `/submissions/{id}/dynamic-form-response/` | Dynamic form answers |

### Form Builder

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/form-categories/` | Form category CRUD |
| GET/POST | `/form-types/` | Form type registry |
| GET/PATCH/DELETE | `/form-types/{id}/` | Form type detail |
| GET/POST | `/form-fields/` | Field definitions (filter: `?form_type=`) |
| GET/PATCH/DELETE | `/form-fields/{id}/` | Field detail |

### Meetings & Minutes

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/meetings/` | Commission sittings |
| GET/POST | `/agenda-items/` | Agenda items |
| GET/POST | `/minutes/` | Minutes documents |
| GET/POST | `/transcripts/` | AI-processed transcripts |

### Commission Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/commission-tasks/` | Post-decision tasks |
| GET/POST | `/commission-tasks/{id}/subtasks/` | Sub-tasks |
| GET/POST | `/commission-tasks/{id}/status-updates/` | Status log entries |

### Document Signing & Annotation

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/doc-annotations/` | Fabric.js annotation objects |
| GET/POST | `/doc-signatures/` | Placed signatures |
| GET/POST | `/my-signature/` | User's own signature image |

### System Administration

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/users/` | User and profile management |
| GET/POST | `/permissions/` | System permissions |
| GET/POST | `/role-defs/` | Role definitions |
| GET/POST | `/api-keys/` | API key management |
| GET/POST | `/settings/` | Runtime system configuration |
| GET/POST | `/backup/` | Database backup/restore |
| GET/POST | `/audit-logs/` | Full audit trail |
| GET/POST | `/incidents/` | Security incidents |
| GET/POST | `/security-scans/` | SAST + dependency scan results |
| GET/POST | `/security-notices/` | Broadcast notices |
| GET | `/auth/security-audit/` | Security audit report |
| GET | `/auth/api-inventory/` | API endpoint inventory |

### Feedback & Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/feedback/` | User feedback reports |
| GET/POST | `/feedback-comments/` | Comments on feedback |
| GET | `/auth/feedback-status/` | Feedback stats summary |
| GET/POST | `/notifications/` | In-app notifications |

### Dashboard & Search

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/` | KPI statistics for dashboard |
| GET | `/reports/stats/` | Reporting data |
| GET | `/search/` | Global full-text search |

---

## Dynamic Form Builder

The system includes a no-code form designer for digitizing PSC forms.

### How it works

1. **Form Types** (`PSCFormType`) — each corresponds to a PSC form (e.g. *PSC Form 5-1*). A form type can be marked `is_digitized` and given a `digitized_form_key`.
2. **Form Fields** (`PSCFormField`) — ordered field definitions attached to a form type. Supported field types:

   | Type | Description |
   |---|---|
   | `section_header` | Visual section divider; can set `start_new_page=true` to create a new form page |
   | `text` | Single-line text input |
   | `textarea` | Multi-line paragraph |
   | `number` | Numeric input |
   | `date` | Date picker |
   | `datetime` | Date + time picker |
   | `select` | Dropdown (choices: one per line) |
   | `radio` | Radio button group |
   | `checkbox` | Boolean yes/no toggle |

3. **Multi-page rendering** — `MultiPageFormRenderer` splits a form into pages wherever a `section_header` with `start_new_page=true` appears. All other section headers render as inline subheadings within the current page.

4. **Import** — the Form Builder accepts `.xml` or `.json` imports for bulk field definition (useful for designing forms externally):

   **XML format:**
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

   **JSON format:**
   ```json
   {
     "fields": [
       {
         "label": "Full Name",
         "field_key": "full_name",
         "field_type": "text",
         "is_required": true,
         "display_order": 10
       }
     ]
   }
   ```

5. **Responses** (`PSCFormResponse`) — user answers stored as a JSON blob keyed by `field_key`, linked to the submission.

---

## Authentication & Security

### JWT

- Access token TTL: `JWT_ACCESS_MINUTES` (default 30 min)
- Refresh token TTL: `JWT_REFRESH_DAYS` (default 7 days)
- Tokens are blacklisted on logout

### TOTP Two-Factor Authentication

- Secrets stored per-profile (`Profile.totp_secret`)
- Compatible with Microsoft Authenticator, Google Authenticator, and Authy
- Globally required when `TWO_FACTOR_REQUIRED=true`

### Session PIN

- Optional 4–6 digit PIN for trusted-device re-authentication
- `TrustedSession` model records verified sessions with IP + user-agent fingerprint
- Trust window expires at `min(SESSION_TRUST_HOURS, 17:00 Pacific/Efate)`

### Brute-Force Protection

- Powered by `django-axes`
- Default: 5 failures → 1-hour lockout (configurable via `AXES_FAILURE_LIMIT` / `AXES_COOLOFF_HOURS`)

### Audit Logging

- Every significant action (login, create, update, delete, download, transition) is appended to `AuditLog`
- Logs are tamper-evident and append-only from the application layer

### RBAC

- `SystemPermission` records named capabilities (e.g. `view_submissions`, `manage_roles`)
- `RoleDefinition` maps roles to permitted capabilities
- `HasProfilePermission` DRF permission class gates API access per endpoint

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before starting the stack.

```env
# ── Django ────────────────────────────────────────────────────────────────────
DJANGO_SECRET_KEY=change-me-to-a-long-random-string
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,web

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

# ── Email (SMTP) ──────────────────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=change-me
SMTP_TLS=true

# ── Celery / Redis ────────────────────────────────────────────────────────────
CELERY_BROKER_URL=redis://redis:6379/0

# ── AI Feedback Analysis ──────────────────────────────────────────────────────
GEMINI_API_KEY=

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

This starts six services: `db`, `redis`, `backend`, `celery_worker`, `celery_beat`, `web`.

The application is available at **http://localhost:8080** (or the port set by `WEB_PORT`).

### First run — apply migrations and seed data

```bash
# Apply all migrations
docker compose exec backend python manage.py migrate

# Seed initial roles, permissions, form categories, and ministries
docker compose exec backend python manage.py seed_tracker

# Create the first admin user
docker compose exec backend python manage.py createsuperuser
```

### Common management commands

```bash
# Create a new migration after model changes
docker compose exec backend python manage.py makemigrations tracker --name "describe_change"

# Apply migrations
docker compose exec backend python manage.py migrate tracker

# Open a Django shell
docker compose exec backend python manage.py shell

# Run the test suite
docker compose exec backend python manage.py test tracker

# Trigger a manual database backup
docker compose exec backend python manage.py backup_db
```

### Rebuilding after code changes

```bash
# Backend code changed
docker compose build backend && docker compose up -d backend

# Frontend code changed
docker compose build web && docker compose up -d web

# Both changed
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

# You still need a running PostgreSQL and Redis instance.
# Point POSTGRES_HOST and CELERY_BROKER_URL in your .env to them.

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

The Vite dev server proxies `/api/*` to the Django backend — configure the target in `vite.config.js` if your backend runs on a non-default port.

---

## Database Migrations

Migrations live in `backend/tracker/migrations/` and are numbered sequentially. Key milestones:

| Migration | What it adds |
|---|---|
| `0001_initial` | Core models (Submission, Meeting, Profile, Ministry, Department) |
| `0003_roles_permissions` | RBAC system (SystemPermission, RoleDefinition) |
| `0008_security*` | SecurityIncident, SecurityScan, AuditLog |
| `0014_workflow_stage_expansion` | Extended WorkflowStage enum |
| `0016_feedback_workflow_notification` | Feedback reports, notifications |
| `0020_add_matters_arising_stage` | Matters Arising stage |
| `0025_sop_updates_and_flying_minutes` | Flying Minutes meeting type |
| `0026_required_document_checklist` | Per-category document checklists |
| `0034_psc_form_type` | PSCFormType model |
| `0036_psc_form_builder` | PSCFormField and PSCFormResponse |
| `0038_seed_psc_form_types_full` | Seeds all PSC form types |
| `0039_reset_form_categories` | Resets to canonical 8 categories (OEM, REC, TCE, MET, MSD, MGRH, MGF, PM) |
| `0040_add_unit_principals_and_submission_assignment` | Unit principal roles + submission assignment fields |

### Migration conventions

- Idempotent SQL changes use `RunSQL("ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...")` paired with `SeparateDatabaseAndState` to keep Django's migration state in sync without failing on re-runs.
- Seed migrations use `RunPython` with an explicit `reverse_code=migrations.RunPython.noop`.

---

## Frontend Routes

All routes except the auth group require an authenticated session (`RequireAuth`).

### Public

| Path | Page |
|---|---|
| `/auth/login` | Login |
| `/auth/reset-password` | Password reset request |
| `/auth/reset-password/confirm` | Password reset confirmation |
| `/auth/2fa` | TOTP verification step |
| `/auth/totp-setup` | Authenticator app setup wizard |

### Protected

| Path | Page |
|---|---|
| `/` | PSC Dashboard |
| `/submissions` | Submission log |
| `/submissions/new` | New submission form |
| `/submissions/:id` | Submission detail + workflow |
| `/reports` | Reports and analytics |
| `/meetings/capture` | Meeting capture |
| `/secretariat/meetings` | Commission sittings calendar |
| `/secretariat/meetings/:meetingId/minutes` | Minutes editor |
| `/secretariat/agenda` | Agenda management |
| `/secretariat/decisions` | Decision tracking |
| `/secretariat/tasks` | Commission task allocation |
| `/secretariat/notifications` | Notification centre |
| `/admin/roles-permissions` | Users + roles management |
| `/admin/ministries-departments` | Organisation structure |
| `/admin/form-types` | PSC form type registry |
| `/admin/form-types/:formTypeId/builder` | Dynamic form builder |
| `/admin/api-keys` | API key management |
| `/admin/system-config` | System configuration |
| `/admin/security` | Security settings and notices |
| `/admin/feedback` | User feedback management |
| `/admin/backup-restore` | Backup and restore |
| `/pages/account` | User account settings |
