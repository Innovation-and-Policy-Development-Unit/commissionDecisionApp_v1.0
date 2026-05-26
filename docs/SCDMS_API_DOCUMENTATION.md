---
output:
  pdf_document: default
  html_document: default
---
# SCDMS API Documentation

**System:** Submission & Commission Decision Management System (SCDMS) / Commission Decision Portal (CDP)  
**API version:** 1.0.0  
**Document version:** 1.1 — May 2026  
**Maintainer:** IPDU, Office of the Public Service Commission of Vanuatu

---

## 1. Overview

The SCDMS REST API is **fully developed** and serves:

- The Commission Decision Portal (web UI)
- OPSC internal workflows (secretariat, units, compliance integration)
- **Machine-to-machine integration** (CMS today; **HRMIS and other partners** via agreed APIs)

**Base URL (production):** `https://<domain>/api/` *(assigned after DCDT virtual server and domain provisioning)*  

**Local / staging examples:**

| Environment | API base |
|-------------|----------|
| Docker Compose (nginx) | `http://localhost:8080/api/` |
| Django dev server | `http://localhost:8000/api/` |

**Service discovery:**

| Resource | Path |
|----------|------|
| API root (JSON) | `GET /` |
| Health check | `GET /health/` |
| OpenAPI 3 schema | `GET /api/schema/` |
| Swagger UI | `GET /api/docs/` |
| ReDoc | `GET /api/redoc/` |
| Endpoint inventory (auth) | `GET /api/auth/api-inventory/` |

All JSON request and response bodies use **`Content-Type: application/json`** unless noted (file uploads use `multipart/form-data`).

---

## 2. Security and compliance

- Built with **Django 5** and **Django REST Framework**.
- Aligned with **Vanuatu’s National Cyber Security Strategy 2030** (session limits, lockout, TLS, secure headers).
- **JWT** access tokens (short-lived) and refresh rotation with blacklist on logout.
- Optional **TOTP 2FA** for interactive users (enforced per deployment policy).
- **API keys** for server-to-server integration (`X-API-Key`), inheriting the linked user’s role permissions.
- **Role-based access control (RBAC)** on every submission and resource.
- **Audit logging** for create, update, workflow transitions, and downloads.
- **Rate limiting** on authentication and sensitive operations (see §5).

Technical Assessment Note (TAN) for DCDT hosting is in progress; production credentials and TLS are issued after server provisioning.

---

## 3. Authentication

### 3.1 JWT (interactive users and user-backed automation)

**Obtain tokens**

```http
POST /api/auth/token/
Content-Type: application/json

{
  "username": "ministry.hr",
  "password": "<password>"
}
```

**Response (200)**

```json
{
  "access": "<jwt-access>",
  "refresh": "<jwt-refresh>"
}
```

| Setting | Default |
|---------|---------|
| Access token lifetime | 30 minutes (`JWT_ACCESS_MINUTES`) |
| Refresh token lifetime | 7 days (`JWT_REFRESH_DAYS`) |
| Refresh rotation | Enabled; old refresh blacklisted on use |

**Use access token**

```http
Authorization: Bearer <access>
```

**Refresh**

```http
POST /api/auth/token/refresh/
{ "refresh": "<jwt-refresh>" }
```

**Logout (blacklist refresh)**

```http
POST /api/auth/logout/
Authorization: Bearer <access>
{ "refresh": "<jwt-refresh>" }
```

**Current user**

```http
GET /api/me/
Authorization: Bearer <access>
```

Returns username, role, `ministry_id`, `department_id`, and related profile fields used by the portal.

### 3.2 API key (recommended for HRMIS / CMS / batch jobs)

Server integrations should use a dedicated **service account** and API key created in SCDMS Admin (`/api/api-keys/`, `psc_admin` only).

```http
X-API-Key: psc_<secret>
```

The key is bound to a Django user; **all RBAC rules apply** as that user. Keys are stored hashed; the plain key is shown once at creation.

You may send **either** `Authorization: Bearer …` **or** `X-API-Key`, not both required.

### 3.3 Webhook authentication (CMS only)

Inbound webhooks do **not** use JWT. They require:

```http
X-CMS-Callback-Key: <CMS_CALLBACK_SECRET>
```

Configured in environment on both CMS and SCDMS. See §10.

---

## 4. Common conventions

### 4.1 Pagination

List endpoints use page number pagination:

```json
{
  "count": 120,
  "next": "https://host/api/submissions/?page=2",
  "previous": null,
  "results": [ ... ]
}
```

Default **page size:** 50 (`PAGE_SIZE`).

### 4.2 Errors

DRF standard shape:

```json
{
  "detail": "Human-readable message."
}
```

Validation errors:

```json
{
  "field_name": ["Error message."]
}
```

HTTP status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `429` throttled, `500` server error.

### 4.3 Timestamps

ISO 8601 with timezone (UTC in storage), e.g. `2026-05-22T04:30:00+11:00`.

### 4.4 Reference numbers

Submissions receive a unique **`reference_number`**: `PSC-YYYY-NNNNN` (assigned on create).

---

## 5. Rate limits (indicative)

| Scope | Limit |
|-------|-------|
| Anonymous | 300/min |
| Authenticated user | 600/min |
| Submission create | 10/hour per user |
| OTP / password reset | 5–10/min |

Integrations should use **backoff** on `429` and idempotent retries where safe.

---

## 6. Core resources for partner integration

### 6.1 Ministries and departments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ministries/` | List ministries (line ministries + OPSC) |
| GET | `/api/ministries/{id}/` | Ministry detail |
| GET | `/api/departments/?ministry={id}` | Departments for a ministry |

Used to populate submission routing and filters. **Not** a full establishment register — see scope document.

### 6.2 Form metadata

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/form-categories/` | PSC business categories |
| GET | `/api/form-types/?active_only=1` | Active PSC form types (`code`, `name`, `is_digitized`, category) |
| GET | `/api/form-types/{id}/` | Single form type |
| GET | `/api/form-fields/?form_type={id}` | Dynamic field definitions for a form type |

### 6.3 Submissions (primary integration object)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/submissions/` | List (scoped by caller role) |
| POST | `/api/submissions/` | Create |
| GET | `/api/submissions/{id}/` | Detail + workflow events + flags |
| PATCH | `/api/submissions/{id}/` | Update metadata (role-dependent) |
| POST | `/api/submissions/{id}/transition/` | Advance workflow stage |
| GET | `/api/submissions/{id}/events/` | Audit trail |
| GET/POST | `/api/submissions/{id}/documents/` | Attachments (`multipart` on POST) |
| GET/POST/PUT | `/api/submissions/{id}/dynamic-form/` | Digitized form answers (JSON `data` by `field_key`) |

#### Resource identifier `{id}` (path parameter)

The `{id}` segment in submission URLs is the **integer database primary key** (e.g. `901`). It is **not** the business reference number.

| Field | Type | Use |
|-------|------|-----|
| `id` (URL `{id}`) | Integer PK | All `/api/submissions/{id}/…` routes |
| `reference_number` | String (e.g. `PSC-2026-00142`) | Display, search, CMS/HRMIS payloads |
| `cdp_submission_pk` | Integer | Same as `id` in webhook responses |
| `cdp_submission_id` | String | Same as `reference_number` in webhook responses |

To resolve a submission by reference: `GET /api/submissions/?search=PSC-2026-00142` (or list filters documented in OpenAPI), then call detail routes with the returned `id`.

#### Dynamic form validation (POST/PUT)

`data` is validated server-side against the active **Form Builder** definitions for the submission’s `form_type_code` (or the `form_type` id on first save). Unknown keys and missing required fields return **400 Bad Request**:

```json
{
  "dynamic_form": [
    "Field 'salary_step_code' does not exist for Form PSC 3.6."
  ]
}
```

Integrators should load allowed keys from `GET /api/form-fields/?form_type={id}` before posting. Section-header rows (`field_type: section_header`) are layout-only and are not stored in `data`.

**List filters (query parameters):** vary by role; common filters include `current_stage`, `ministry`, `form_type_code`, search on title/reference. Use OpenAPI schema for the full list.

#### Create submission — ministry / Commission track

```http
POST /api/submissions/
Authorization: Bearer <access>
Content-Type: application/json

{
  "title": "Appointment of Director Finance",
  "form_category": 5,
  "form_type_code": "PSC 3.6",
  "ministry": 3,
  "department": 12,
  "received_at": "2026-05-22T08:00:00+11:00",
  "notes": "Optional context"
}
```

Response includes `id`, `reference_number`, `current_stage` (typically `draft`), and read-only flags.

**Server-side rules:** ministry and department may be inferred from the user profile for `ministry_hr` / `dept_admin`. `form_type_code` is normalized (e.g. `PSC4.4` → `PSC 4.4`).

#### Create submission — Secretary-only travel (4.5 / 4.6)

```http
POST /api/submissions/
{
  "title": "Overseas training — Fiji",
  "form_type_code": "PSC 4.5",
  "received_at": "2026-05-22T08:00:00+11:00",
  "travel_endorsers": {
    "director": 55,
    "dg": 7
  },
  "notes": ""
}
```

Response sets `secretary_only: true`, `requires_travel_letter` (true for 4.5 and 4.6).

**Form 4.4** — domestic travel allowance: **only `head_of_agency`** (department director or ministry DG). Staff 4.4 is **not** accepted via API. **No ministry endorser slots are captured in SCDMS for 4.4**; travel requests route **Submitted → ODU Manager review → Secretary approval**.

**Forms 4.5 / 4.6** — overseas travel: route **Submitted → ODU Manager review → Secretary approval**.

| Initiator | Endorsements before submit (in SCDMS) | Then |
|-----------|----------------------------------------|------|
| Department staff (`traveller`, `dept_admin`, or `ministry_hr` with a department) | Department Director → DG | ODU Manager → Secretary |
| Ministry CSU staff (`ministry_hr` with no department on profile or submission) | DG only | ODU Manager → Secretary |
| Director-General / department director (`head_of_agency`) | None | ODU Manager → Secretary |

If the DG is on leave, an **Officer-in-Charge** (< 5 days) or **Acting DG** (≥ 5 days) may sign the DG slot.

#### Workflow transition

```http
POST /api/submissions/{id}/transition/
{
  "new_stage": "submitted",
  "remarks": "Lodged by ministry HR.",
  "acknowledge_gaps": false
}
```

Allowed `new_stage` values depend on **current stage**, **role**, `is_internal`, and `secretary_only`. See §8.

Travel submissions in `draft` → `submitted` require any **required endorsements** signed via `/api/submissions/{id}/sign-travel-section/` (4.4: none; 4.5/4.6: DG only for ministry CSU initiators, Director + DG for department staff).

#### Key read-only fields on detail

| Field | Meaning |
|-------|---------|
| `reference_number` | Business key `PSC-YYYY-NNNNN` |
| `current_stage` | Workflow stage code |
| `form_type_code` | e.g. `PSC 3.6`, `PSC 4.5` |
| `secretary_only` | Secretary path (no Commission sitting) |
| `requires_travel_letter` | 4.5 / 4.6 letter after Secretary approval |
| `travel_endorsers` | `{ "director": 55, "dg": 7 }` user IDs (when endorsements are required) |
| `implementation_status` | Post-decision implementation |
| `cms_case_id` | Linked CMS case (compliance) |
| `subway_map` | UI workflow map (optional for integrations) |

### 6.4 Travel endorsement endpoints (secretary-only forms)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/submissions/{id}/travel-endorsements/` | Required sections + signed state |
| POST | `/api/submissions/{id}/sign-travel-section/` | Sign a section (`section_key`, optional `remarks`, `approved` for Secretary) |
| GET | `/api/submissions/{id}/travel-approval-letter/` | Generated letter PDF (when applicable) |

### 6.5 Post-decision (read / task systems)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/commission-tasks/` | Tasks after Commission decision |
| GET | `/api/reports/stats/` | Aggregated reporting (privileged roles) |

---

## 7. HRMIS integration — division of responsibility

| Layer | Owner | Status |
|-------|--------|--------|
| **SCDMS REST API** (this document) | OPSC / IPDU | **Available** — use OpenAPI + service account |
| **HRMIS APIs** (employee lookup, validation, outcome write-back) | HRMIS unit | **To be implemented** by HRMIS |

SCDMS is ready to **call** HRMIS once endpoints are agreed. Below is the **proposed contract** for HRMIS to implement.

### 7.1 Proposed HRMIS endpoints (HRMIS → called by SCDMS)

**Authentication:** mutual TLS or OAuth2 client credentials / API key — to be agreed.

#### `GET /api/v1/employees/{employee_id}`

Resolve employee for pre-fill.

**Response (example)**

```json
{
  "employee_id": "EMP-12345",
  "payroll_number": "12345",
  "full_name": "Jane Kalo",
  "ministry_code": "MFEM",
  "department_code": "FIN",
  "position_title": "Senior Accountant",
  "position_number": "POS-99",
  "employment_status": "permanent",
  "is_active": true
}
```

#### `GET /api/v1/employees/{employee_id}/validate-for-psc`

Optional composite check before submit.

**Response**

```json
{
  "valid": true,
  "errors": []
}
```

#### `POST /api/v1/psc-decision-outcomes`

Called when SCDMS marks implementation complete (event-driven).

**Request (example)**

```json
{
  "psc_reference": "PSC-2026-00142",
  "form_type_code": "PSC 3.6",
  "outcome_type": "appointment",
  "effective_date": "2026-06-01",
  "employee_id": "EMP-12345",
  "position_title": "Director Finance",
  "grade_or_level": "G10",
  "acting_end_date": null,
  "implemented_at": "2026-06-15T10:00:00+11:00"
}
```

**Response:** `202 Accepted` with HRMIS transaction id (or `200` with body if HRMIS prefers synchronous ack — to be agreed in MOU).

**Interconnection SLA (SCDMS behaviour when implemented):**

- SCDMS posts outcomes **asynchronously** (Celery queue), not inside the user’s browser request.
- SCDMS expects HRMIS to return **HTTP 202 Accepted** within **3000 ms** when the outcome is accepted for processing.
- If HRMIS is unreachable or does not respond in time, SCDMS applies **exponential backoff** (up to **5** attempts) before marking the implementation task **Failed Interconnection** in the audit trail.
- HRMIS should treat `psc_reference` as the idempotent business key; duplicate posts with the same reference should not create duplicate HR actions.

### 7.2 Deep linking (no API)

| From | URL pattern |
|------|-------------|
| HRMIS → SCDMS | `https://<scdms-host>/submissions/{id}` where `{id}` is the integer PK; or search UI/API by `PSC-2026-00142` |
| SCDMS → HRMIS | `https://<hrmis-host>/employees/{employee_id}` *(HRMIS-defined)* |

### 7.3 SCDMS endpoints HRMIS will typically call

| Use case | SCDMS call |
|----------|------------|
| Poll status by reference | `GET /api/submissions/?search=PSC-2026-00142` or detail by id |
| Read outcome / stage | `GET /api/submissions/{id}/` → `current_stage`, `implementation_status` |
| Register linked matter | Usually created in SCDMS by ministry HR; HRMIS does not duplicate create unless using service account |

---

## 8. Workflow stages (reference)

| Code | Label |
|------|--------|
| `draft` | Draft |
| `submitted` | Submitted to PSC |
| `received_by_psc` | Received by PSC |
| `returned_for_clarification` | Returned for Clarification |
| `registered_routed` | Registered and Routed |
| `manager_checklist_review` | Manager Checklist Review |
| `under_assessment` | Under Assessment |
| `compliance_under_review` | Compliance Under Review (CMS) |
| `forwarded_to_commission` | Forwarded to Commission |
| `commission_sitting` | Commission Sitting |
| `approved` / `rejected` / `returned` | Commission outcomes |
| `secretary_review` | Secretary Review (internal / travel / CMS register) |
| `minutes_drafted_signed` | Minutes Drafted and Signed |
| `decision_entered_assigned` | Decision Entered and Assigned |
| `under_implementation` | Under Implementation |
| `implementation_report` | Implementation Report |

**Secretary-only graph (travel 4.4–4.6, simplified):**  
`draft` → `submitted` → `secretary_review` → `approved` / `rejected` / `returned_for_clarification`

---

## 9. CMS integration (reference)

Already live between **Case Management System (CMS)** and SCDMS.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/webhooks/cms-register/` | `X-CMS-Callback-Key` | Register compliance case → CDP submission |
| POST | `/api/webhooks/cms-signoff/` | `X-CMS-Callback-Key` | Compliance Manager sign-off → advance stage |

**Webhook security (operations):**

- Rotate `CMS_CALLBACK_KEY` / `X-CMS-Callback-Key` via environment variables on a scheduled basis.
- Local and CI test suites should simulate production **TLS** and security headers required under the National Cyber Security Strategy 2030 (including self-signed certificates where DCDT endpoints are not yet available).
- **Planned v1.1.0:** upgrade CMS callbacks from shared secret header to **HMAC-SHA256** request signing for non-repudiation.

**Register payload (example)**

```json
{
  "cms_case_id": "CMS-2026-0042",
  "cms_case_reference": "CMS-2026-0042",
  "title": "Disciplinary matter — Smith",
  "case_family": "employee_disciplinary",
  "form_type_code": "COMP-SMDR",
  "notes": "",
  "registered_by": "compliance.manager"
}
```

**Register response (201)**

```json
{
  "cdp_submission_id": "PSC-2026-00142",
  "cdp_submission_pk": 901,
  "cdp_callback_url": "https://<host>/api/webhooks/cms-signoff/",
  "current_stage": "secretary_review",
  "cms_case_id": "CMS-2026-0042"
}
```

---

## 10. AI and async operations (optional)

Several endpoints queue **Celery** jobs (brief generation, duplicate detection, document OCR). Pattern:

```http
POST /api/submissions/{id}/generate-brief/
GET  /api/submissions/{id}/   → poll ai_brief_processed, ai_brief_summary
```

Requires workers and API keys for Anthropic/OpenAI in deployment. Not required for HRMIS v1 integration.

---

## 11. Full endpoint catalogue

The authoritative machine-readable catalogue is:

1. **OpenAPI 3:** `GET /api/schema/`  
2. **Swagger UI:** `/api/docs/`  
3. **Authenticated inventory:** `GET /api/auth/api-inventory/`

The README in the repository root contains a **summary table** of major route groups; OpenAPI supersedes it where they differ.

---

## 12. IPDU team — direct action items

| Action | Owner | Notes |
|--------|--------|-------|
| DCDT server handshake | IPDU + DCDT | Run integration tests with strict TLS/headers (NCSS 2030) using local self-signed certs until production domain is live |
| HRMIS MOU / RFC | IPDU + HRMIS technical unit | Use §7.1 as the formal contract template; agree auth, 202 SLA, and idempotent `psc_reference` |
| CMS webhook key rotation | IPDU ops | Rotate `X-CMS-Callback-Key` via env; plan HMAC signing in v1.1.0 |
| Dynamic form contract tests | IPDU dev | Assert 400 `dynamic_form` errors in partner test packs for unknown `field_key` values |

---

## 13. Changelog and contact

| Version | Date | Notes |
|---------|------|-------|
| 1.1 | May 2026 | Dynamic form validation; `{id}` vs reference_number; HRMIS retry SLA; IPDU checklist; CMS webhook ops |
| 1.0 | May 2026 | Initial partner-facing API guide; HRMIS proposed contract; Form 4.4 director/DG rules |


For a **service account** and API key for HRMIS staging, contact IPDU after mutual agreement / security review.
