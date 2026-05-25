# SCDMS — System scope for partner units

**Document purpose:** Help other OPSC and government units (e.g. **HRMIS**, Finance, VIPAM, line ministries) understand what the **Submission & Commission Decision Management System (SCDMS)** covers, so complementary systems can be designed **without duplicating** the same functions.

**System names in use**

| Name | Meaning |
|------|---------|
| **SCDMS** | Full product name — Submission & Commission Decision Management System |
| **Commission Decision Portal (CDP)** | Web portal used by ministries and OPSC staff for submissions and commission workflow |
| **CMS** | Separate **Case Management System** for OPSC Compliance Unit (disciplinary/grievance case files); integrates with CDP, not a substitute for HRMIS |

**Owner / operator:** Office of the Public Service Commission (OPSC), Vanuatu — Information and Technology Planning Division (IPDU).

**Audience:** Unit heads and system owners planning or operating parallel systems (HRMIS, payroll, establishment registers, document management, etc.).

**Version:** 1.0 — May 2026

---

## 1. Executive summary

SCDMS is the **authoritative workflow and record system for matters that require PSC assessment, Commission deliberation, formal minutes, and post-decision implementation tracking**. It is **not** a human resources information system (HRIS), payroll engine, or employee master database.

Partner units should treat SCDMS as the **decision and commission process layer**. Systems such as **HRMIS** should remain the **system of record for people, positions, and day-to-day HR operations**, and should **feed or receive** information from SCDMS only at defined hand-off points (see §6).

---

## 2. Mandate — what problem SCDMS solves

The Public Service Commission decides on personnel and related matters under the Public Service Act and PSC procedures. Before SCDMS, that lifecycle spanned paper forms, email, and disconnected registers.

SCDMS digitises:

1. **Lodgement** — Ministries and OPSC units submit structured PSC form packages with supporting documents.
2. **Registration & routing** — Secretariat registers matters and routes them to the correct OPSC unit (ODU, VIPAM, **HR Unit**, Compliance, CSU, etc.).
3. **Assessment** — Unit managers and principals run checklist review and statutory assessment (including working-day deadlines).
4. **Commission process** — Agenda, sittings, deliberation outcomes, minutes, and decision notifications.
5. **Post-decision execution** — Commission tasks, implementation status, and reporting back on decisions.
6. **Audit & reporting** — Workflow history, dashboards, decision register, and exports for oversight.

**One-line scope:** *From “matter submitted to PSC” through “Commission decided and implementation tracked” — not “manage the employee for their entire career.”*

---

## 3. Systems landscape (avoid duplication)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Line ministries & agencies                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   HRMIS      │  │  Finance /   │  │  Other ops   │                   │
│  │ (employee    │  │  payroll     │  │  systems     │                   │
│  │  master,     │  │              │  │              │                   │
│  │  leave,      │  │              │  │              │                   │
│  │  recruitment)│  │              │  │              │                   │
│  └──────┬───────┘  └──────────────┘  └──────────────┘                   │
│         │ complement (reference data, post-decision updates)             │
│         ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  SCDMS — Commission Decision Portal (CDP)                         │   │
│  │  Submissions · workflow · forms · documents · commission · tasks  │   │
│  └───────────────┬───────────────────────────────┬──────────────────┘   │
└──────────────────┼───────────────────────────────┼────────────────────────┘
                   │                               │
                   ▼                               ▼
         ┌─────────────────┐           ┌─────────────────┐
         │  OPSC units     │           │  CMS (Compliance)│
         │  assessment     │◄─────────►│  case management │
         └─────────────────┘  register  └─────────────────┘
              with Commission   from CMS
```

| System | Primary role | Relationship to SCDMS |
|--------|----------------|------------------------|
| **SCDMS (CDP)** | PSC decision workflow & commission records | **This document** |
| **CMS** | Compliance case investigation & sign-off | Cases **created in CMS**; when ready for Commission, **registered into CDP** via API; callbacks on sign-off |
| **HRMIS** (example partner) | Employee/position master, HR transactions, ministry HR processes | **Should not** rebuild submission workflow, commission minutes, or PSC form routing; **may** supply employee identifiers and receive **outcomes** after Commission decisions |
| **Payroll / Finance** | Pay, allowances, vote | Implement **approved** salary/allowance changes after decision — not duplicate PSC assessment |

> **Important:** In SCDMS, **“HR Unit”** means the OPSC **assessment unit** that handles certain PSC form categories (appointments, establishment-linked matters). It is **not** the same product as a ministry-wide **HRMIS**.

---

## 4. In scope — functions SCDMS provides

### 4.1 Core workflow

- Configurable **workflow stages** from draft → ministry submit → PSC receive/register/route → unit manager checklist → principal assessment → forward to Commission → sitting → outcome → minutes → decision tasks → implementation reporting.
- **Role-based access** for ministry users, OPSC secretariat, commissioners, unit managers/principals, and post-decision execution roles.
- **Workflow events** and audit trail for accountability.
- **Reference numbers** (e.g. PSC-YYYY-NNNNN) as the business key for a matter.

### 4.2 Submission & form management

- **Form categories** aligned to PSC business areas, including for example:
  - Discipline / compliance (ministry referrals; OPSC compliance uses CMS + CDP registration)
  - Health Commission
  - Appointment / acting appointment
  - Direct appointment / confirmation
  - Extra responsibility, overtime, special skills allowances
  - Contract / temporary salaried appointment
  - Salary adjustment
  - Training / scholarship / internship / cadetship
  - Medical claim, partial severance, resignation/retirement/death
  - **Travel** (PSC Forms 4.4, 4.5, 4.6 — secretary-only approval path, not full Commission)
  - Other matters
- **Dynamic Form Builder** — digitised PSC forms (`PSCFormType`, fields, multi-page UI, XML/JSON import).
- **Attachments** — submission documents with classification (confidential by default).
- **Checklists** — unit manager compliance checklists per submission type.
- **Parent/child submissions** — linked packages (e.g. main form + attachment form).

### 4.3 Commission secretariat

- **Commission meetings** — scheduling, types, status.
- **Agenda** — ordering matters for sittings.
- **Minutes** — drafting, approval, flying minutes where applicable.
- **Meeting audio** — transcription pipeline (Whisper + AI cleanup) and minutes drafting support.
- **Minute agenda intake** — structured intake of agenda items for meetings.
- **Decision register** — searchable record of Commission outcomes.
- **Briefing packs** and secretariat tooling for sitting preparation.

### 4.4 Post-decision implementation

- **Commission tasks** — allocation to OPSC managers, principals, senior officers.
- **Sub-tasks and status updates** — implementation progress.
- **Implementation status** on submissions (not started → in progress → completed, etc.).

### 4.5 Document services (within the decision file)

- Upload, versioning context per submission.
- **In-browser annotation** and **digital signatures** on documents (including travel endorsement sections).
- **PDF generation** for outputs where configured (e.g. letters, packs).

### 4.6 Notifications & communications

- In-app **notifications**.
- **Email dispatch** (configurable SMTP, scheduled flush of pending notification emails).
- Ministry **return for clarification** workflows with bilingual guidance support (AI-assisted where enabled).

### 4.7 Reporting & analytics

- Executive **dashboard** (KPIs by stage, unit, ministry).
- **Smart reports** / statistical exports.
- Role-scoped lists and global search across authorised submissions.

### 4.8 Administration & security

- User and **role/permission** management.
- **Ministry and department** directory (for routing and filters — organisational reference, not full org-chart HRIS).
- System settings, backup, security audit, API inventory.
- **JWT authentication**, optional **TOTP 2FA**, session PIN, brute-force lockout, audit logging.

### 4.9 AI-assisted features (CDP)

Where enabled, AI supports the **decision process** (not general HR analytics), for example:

- Package completeness / missing-information checks before submit.
- Document classification and checklist pre-fill.
- Executive briefs for the Secretary.
- Quality scoring and policy guardrails for reviewers.
- Meeting transcription and minutes drafting.
- Staff assistant chatbot scoped to SCDMS procedures (not binding legal advice).

### 4.10 Compliance integration (CMS ↔ CDP)

- Compliance **cases are not created** in the ministry submission wizard; they originate in **CMS**.
- When a case is ready for Commission attention, CMS **registers** a linked submission in CDP (`cms_case_id`).
- CDP can **dispatch** updates to CMS and receive **webhook callbacks** (e.g. Compliance Manager sign-off).
- Digitised **COMP-*** form types for OPSC internal compliance submissions.

---

## 5. Out of scope — what partner units should own instead

The following are **explicitly outside** SCDMS. Building them again in HRMIS (or another unit system) is appropriate; building them **inside** SCDMS would duplicate effort and blur data ownership.

### 5.1 Employee & workforce master data (HRMIS core)

| Capability | Owner (recommended) | Notes for SCDMS |
|------------|---------------------|-------------------|
| Canonical **employee ID** / person record | HRMIS | CDP may store names/IDs **on a submission** for the matter at hand only |
| Employment history, acting history, service dates | HRMIS | Not maintained as live HR records in CDP |
| **Position** catalogue, reporting lines, cost centre | HRMIS / establishment systems | CDP uses ministry/department picklists for **routing**, not establishment control |
| **Organisation structure** maintenance | HRMIS / ministry systems | CDP ministries/departments are a **submission directory** |
| Employee self-service profile | HRMIS | — |

### 5.2 Operational HR transactions

| Capability | Owner (recommended) |
|------------|---------------------|
| **Leave** application, balances, approvals | HRMIS |
| **Timesheets** and attendance | HRMIS / workforce |
| **Payroll** calculation, payslips, tax | Finance / payroll |
| **Recruitment** advertising, shortlisting, interviews, offers (pre-PSC) | HRMIS / recruitment module |
| **Onboarding** checklists (IT, induction) | HRMIS |
| **Performance appraisal** cycles (routine line management) | HRMIS — unless escalated to PSC as a formal matter |
| **Learning management** (course delivery, completions) | LMS / HRMIS — CDP handles **PSC training/scholarship decisions**, not classroom scheduling |

### 5.3 Compliance investigation (CMS)

| Capability | Owner |
|------------|--------|
| Case investigation notes, hearings timetable, internal compliance workflow | **CMS** |
| Full disciplinary case file before Commission registration | **CMS** |

CDP holds the **Commission-facing** submission and outcome; CMS holds the **investigation case file**.

### 5.4 Enterprise functions not specific to PSC decisions

- General **document management** (DMS) for all corporate records.
- **Asset management**, **fleet**, **inventory**.
- **Generic workflow/BPM** for non-PSC approvals.
- **Business intelligence warehouse** across all government HR — CDP reporting is **PSC decision-centric**.

---

## 6. Data ownership & complementarity (HRMIS example)

Use this matrix when designing integrations.

| Data element | System of record | In SCDMS |
|--------------|------------------|----------|
| Employee identity (persistent) | **HRMIS** | Copy/reference on forms only |
| Position & establishment (current) | **HRMIS** / establishment register | Described in submission payload; decision may **authorize** a change |
| PSC submission package & stage | **SCDMS** | Yes — full history |
| Commission minutes & decision text | **SCDMS** | Yes |
| Implementation task status (PSC units) | **SCDMS** | Yes |
| Approved salary / allowance effective date | **HRMIS / payroll** after decision | Outcome exported or manually applied |
| Disciplinary investigation detail | **CMS** | Summary + link via `cms_case_id` |
| Leave balance | **HRMIS** | Not stored |

### 6.1 Suggested integration patterns (non-prescriptive)

These are **design targets** for HRMIS and similar systems — not all are implemented today.

1. **Pre-fill from HRMIS** — When a ministry HR officer starts a PSC form in CDP, pull employee name, file number, position title, and ministry/department from HRMIS by employee ID (read-only API).
2. **Validate before submit** — HRMIS confirms the employee is active and the position exists; CDP still runs its own PSC checklist and AI package checks.
3. **Post-decision update** — When CDP marks a decision **implemented**, push structured outcomes to HRMIS (appointment date, grade, acting end date, separation date) — **event-driven**, not continuous sync of full employee records.
4. **Deep link** — HRMIS case screen links to `PSC-YYYY-NNNNN` in CDP for status; CDP links back to HRMIS employee profile for context.
5. **No bidirectional master sync** — Avoid making CDP a second employee database; avoid making HRMIS store commission minutes as the only copy.

---

## 7. Users & access (who uses SCDMS)

| Actor | Typical use |
|-------|-------------|
| **Ministry HR / Dept admin / Head of Agency** | Create and submit PSC matters; respond to clarifications |
| **OPSC Secretariat** | Register, route, meetings, agenda, minutes, notifications |
| **OPSC unit managers** (VIPAM, HR, ODU, Compliance, CSU) | Checklist gate, assign principals |
| **OPSC unit principals** | Assessment, forward to Commission |
| **Commissioners / Chair** | Sitting participation (as configured) |
| **OPSC managers / principals / senior officers** | Post-decision tasks |
| **Travellers** (Forms 4.4–4.6) | Secretary-only travel workflow |
| **Compliance roles** | CMS for cases; CDP for Commission registration and review |
| **PSC administrators** | Users, forms, system config |

Approximate scale: **~65–90** active users (ministry HR across **13 line ministries** plus OPSC staff). This is orders of magnitude smaller than a national HRMIS user base.

---

## 8. Technical interfaces (for integration teams)

- **REST API** under `/api/` with JWT authentication; OpenAPI schema via drf-spectacular.
- **CMS integration** — `CMS_API_URL`, `CMS_API_KEY`, `CMS_CALLBACK_SECRET`; register case from CMS; webhook sign-off from CMS.
- **No public “employee API”** in SCDMS today — partner systems should plan **new read/write contracts** with IPDU if pre-fill or post-decision feeds are required.

Security expectations: confidential submissions, audit logging, 2FA for privileged roles, secrets via environment variables (not in application repos).

---

## 9. Decision guide for new features

When a unit proposes functionality, use this checklist:

| Question | If **yes** → likely SCDMS | If **no** → likely partner system (e.g. HRMIS) |
|----------|---------------------------|--------------------------------------------------|
| Does it require PSC or Commission **approval** recorded in minutes? | ✓ | |
| Is it a **PSC form type** in the official PSC manual? | ✓ | |
| Does it track **implementation of a Commission decision**? | ✓ | |
| Is it day-to-day HR without a Commission decision? | | ✓ |
| Is it the **legal/system-of-record employee file**? | | ✓ |
| Is it payroll, leave, or recruitment **before** PSC involvement? | | ✓ |

---

## 10. Summary for HRMIS unit

**Build in HRMIS:** employee master, positions, leave, payroll inputs, recruitment, performance cycles, ministry HR dashboards, and applying Commission outcomes to live HR records.

**Do not rebuild in HRMIS:** PSC submission workflow, unit routing to OPSC, commission sitting agenda/minutes, decision register, secretary travel approval path (4.4–4.6), or compliance case management (use CMS + CDP link).

**Work together:** shared employee identifier, pre-fill on submission, status deep links, and structured **post-decision** updates when PSC marks implementation complete.

---

## 11. Document control

| Field | Value |
|-------|--------|
| Maintained by | IPDU / OPSC |
| Source repository | `commissionDecisionApp_v1.0` |
| Related docs | `README.md`, `docs/psc_staff_knowledge.md`, user guides under `docs/` and `frontend/public/guides/` |
| Change requests | Contact IPDU with proposed boundary changes before duplicate systems are commissioned |

---

*This scope reflects the deployed SCDMS/CDP codebase and operating model as of May 2026. Integration endpoints with HRMIS are architectural recommendations unless separately documented as delivered.*
