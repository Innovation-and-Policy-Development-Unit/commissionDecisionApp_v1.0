# Email draft — SCDMS scope for HRMIS unit

**To:** [HRMIS Unit Manager name]  
**Cc:** [OPSC IPDU / your manager as appropriate]  
**Subject:** SCDMS scope — how the Commission Decision system complements HRMIS (not a duplicate HRIS)

---

Dear [Name],

I am writing to share the **scope and boundaries** of the Office of the Public Service Commission’s **Submission & Commission Decision Management System (SCDMS)**—also referred to as the **Commission Decision Portal (CDP)**—so your team can plan HRMIS as the **complementary** system of record for people and HR operations, without overlapping the PSC decision workflow.

## Project status (May 2026)

SCDMS is approximately **85% near completion**. Core ministry submission paths, Commission secretariat functions, Compliance integration (CMS), and a large share of OPSC workflows are already in the application. The following is **currently pending** before production go-live:

1. **HR Unit and VIPAM unit workflow digitization in the system** — These assessment units will receive **optimized, end-to-end workflows** (routing, assessment, and hand-off to Commission), **not** a manual, step-by-step digitization of every legacy form in isolation. The aim is a coherent process in SCDMS that matches how the units actually work.  
2. **Technical Assessment Note (TAN)** — Submitted to the **Department of Corporate and Digital Transformation (DCDT)** for approval. DCDT’s review is usually **focused on security** (hosting, access control, and compliance). The system is built with **Django** and developed **in line with Vanuatu’s National Cyber Security Strategy 2030**.  
3. **Infrastructure** — **Virtual server provisioning by DCDT**. Once the server environment is provisioned, OPSC will request **domain name** assignment and production **TLS** configuration for the service.

The **SCDMS REST API is already fully developed** (documented, secured, and ready for integration). Connecting to HRMIS is the main external dependency (see below). We are sharing scope and HRMIS API needs early so your roadmap can progress **in parallel** with the items above, not only after deployment.

## What SCDMS is for

SCDMS is the **authoritative system for matters that require PSC assessment, Commission deliberation, formal minutes, and post-decision implementation tracking**. In short, it covers the journey from **“matter lodged with PSC”** through **“Commission decided and implementation recorded”**.

It supports, among other things:

- Ministry and OPSC **submission** of digitised PSC forms and supporting documents  
- **Registration, routing, and assessment** by OPSC units (ODU, VIPAM, HR Unit, Compliance, CSU, etc.)  
- **Commission** agenda, sittings, minutes, and the decision register  
- **Post-decision tasks** and implementation status on PSC matters  
- **Secretary-only** approvals for certain PSC forms (e.g. overseas travel 4.5/4.6; domestic travel **4.4 for department directors and Director-General only**—staff domestic travel remains within ministry processes and is **not** lodged in SCDMS)

SCDMS is **not** a human resources information system, payroll system, or employee master database.

> **Note:** The “HR Unit” referenced inside SCDMS is an **OPSC assessment unit** that handles specific PSC form categories. It is **not** the same as a ministry-wide HRMIS product.

## What HRMIS should continue to own

We expect HRMIS to remain the **system of record** for:

- Employee / person master data and persistent employee identifiers  
- Positions, establishment, reporting lines, and org structure (ministry-side)  
- Day-to-day HR transactions: leave, attendance, recruitment before PSC involvement, onboarding, routine performance management, learning delivery  
- Applying **Commission-approved outcomes** to live HR records (appointment dates, grades, acting periods, separations, etc.) after decisions are implemented  

SCDMS will hold **case-specific** employee details on a submission only for that PSC matter; it does not replace HRMIS as the career-long employee file.

## What SCDMS does not replace

Please **do not** plan to rebuild inside HRMIS:

- PSC submission workflow, reference numbers (PSC-YYYY-NNNNN), or stage tracking  
- Commission meeting agenda, minutes, or decision register  
- OPSC unit checklist and assessment workflows leading to Commission  
- Compliance **investigation** case management (that sits in the separate **Case Management System, CMS**, which links to SCDMS when a matter goes to Commission)

## How we see the systems working together — API access required

**SCDMS side:** The **SCDMS API is fully developed**—a secured REST interface (JWT authentication, role-based access, OpenAPI documentation) ready for ministry portals, CMS, and future HRMIS integration.

**HRMIS side:** To complete the hand-offs below, **SCDMS will need secure API access to HRMIS** (read for submission pre-fill and validation; agreed write or callback for post-decision outcomes). HRMIS remains the system of record for employee and position data; SCDMS will not maintain a parallel employee master.

| Hand-off | Direction | API role |
|----------|-----------|----------|
| Pre-fill on new PSC submission | HRMIS → SCDMS | SCDMS calls HRMIS to resolve employee ID, name, position, ministry/department |
| Active employee / position check | HRMIS validates; SCDMS enforces PSC rules | SCDMS queries HRMIS before or on submit |
| After decision implemented | SCDMS → HRMIS / payroll | SCDMS notifies or posts structured outcomes (appointment date, grade, acting end, separation, etc.) |
| Navigation | Both ways | Deep links between HRMIS employee profile and PSC reference (PSC-YYYY-NNNNN) |

The **integration pattern is agreed**; **HRMIS API endpoints** (surface, authentication, rate limits, and data fields) are what we need your team to define and implement. We can share the partner API guide **`docs/SCDMS_API_DOCUMENTATION.md`** (SCDMS endpoints + proposed HRMIS API contract) for review ahead of production go-live and pilot testing.

We do **not** propose continuous bidirectional sync of full employee records—only **event-driven, purpose-specific** calls at the stages above.

## Attached / follow-up material

A detailed scope note for partner units is available on request (**SCDMS_SYSTEM_SCOPE_FOR_PARTNER_UNITS**). We would welcome a **short meeting** with your team to:

- Confirm functional boundaries (what stays in HRMIS vs SCDMS), and  
- **Nominate technical contacts** on your side to scope and implement the **HRMIS APIs** SCDMS will call (SCDMS’s API is already available for your review).

Please reply with a suitable time, or name your integration lead and we will send **SCDMS API documentation** and a proposed HRMIS API requirements outline ahead of the meeting.

Kind regards,

[Your name]  
[Title]  
Information and Technology Planning Division (IPDU)  
Office of the Public Service Commission of Vanuatu  
[Email] | [Phone]
