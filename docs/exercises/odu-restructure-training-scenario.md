# ODU Training Exercise — Organisation Restructure Submission (PSC Form 2-1)

**Purpose:** Hands-on practice for the Organisation Development Unit (ODU) using SCDMS, including the two specialist principal roles and the digital ODU Restructure Checklist.

**Duration:** 90–120 minutes (can be split across two sessions)

**Prerequisites:** Migration `0096` applied; roles visible in **Administration → Users**; test accounts created by your trainer (you add real users later).

---

## 1. Roles used in this exercise

| Role code | Display name | Exercise persona |
|-----------|--------------|------------------|
| `ministry_hr` | Ministry HR Officer | **Maria K.** — lodges the proposal |
| `head_of_agency` | Head of Agency | **DG James T.** — endorses before PSC |
| `psc_officer` | PSC Officer | **Registry** — receives and routes |
| `odu_manager` | ODU Manager | **Manager Sera L.** — assigns work, approves checklist |
| `principal_org_dev_analyst` | Principal Organization Development Analyst | **Analyst Poma W.** — org structure / policy alignment |
| `principal_job_analyst` | Principal Job Analyst | **Analyst John M.** — job sizing, grading, establishment tables |
| `psc_secretary` | PSC Secretary | **Secretary** — forwards to Commission (demo only) |

**Permissions (both analyst roles):** view dashboard, view submissions, transition workflow, update implementation, view commission minutes/tasks, view audit trail — same ODU principal workflow access as `odu_principal`, scoped to submissions **assigned to them**.

---

## 2. Case background — “MFEM Corporate Services restructure”

The **Ministry of Finance and Economic Management (MFEM)** proposes a **Corporate Services Division restructure** to align with the Corporate Plan 2026–2030.

- **Form:** PSC **2-1** (Organisation Restructure and/or Establishment Variation)
- **Agenda section:** Structure / organisation (as configured in your environment)
- **Proposal type:** *Organisation Restructure* with limited establishment variation (two new Principal Financial Analyst posts, one abolished Clerk III)
- **Rationale (summary):** MFEM must centralise HR/payroll support for line divisions, reduce duplicate admin posts, and improve service levels to Treasury and Budget divisions.

### Key facts for checklist answers

| Topic | Case fact |
|-------|-----------|
| Corporate plan link | MFEM Corporate Plan 2026–2030, Strategic Priority 2 (Organisational capability) |
| Cost impact | Neutral in year 1; savings from abolished post offset by two new PFA posts in year 2 |
| Union consultation | Draft consultation letter attached; consultation planned before Commission sitting |
| Org chart | Before/after charts attached (PDF) |
| Job descriptions | Draft JDs for new PFAs attached; updated JD for regraded Coordinator |
| Establishment schedule | Tabular schedule shows +2 / −1 FTE |

---

## 3. Setup (trainer / admin — once)

1. **Administration → Users** — create users and assign roles (no passwords in this document).
2. Link OPSC staff on their user profile:
   - **Ministry:** Ministry of the Prime Minister (code `MPM` or `OPM`)
   - **Department:** Office of the Public Service Commission (`OPSC`)
   - **Unit:** e.g. ODU, IPDU, VIPAM, HR, Compliance, or CSU
3. Confirm form type **PSC 2-1** is active and mapped to the correct agenda section.
4. Optional: under **Agenda sections**, ensure *structure* (or your org section code) lists `odu_manager` as a receiver role if you use agenda-based routing.

---

## 4. Exercise flow

### Part A — Ministry lodges the submission (15 min)

**Login:** `ministry_hr` (Maria)

1. Open **Submit for Commission** (or ministry lodge form).
2. Select category and form **PSC 2-1**.
3. Complete minimum required fields, for example:
   - **Ministry / Department:** Ministry of Finance and Economic Management
   - **Subject:** Corporate Services Division Restructure 2026
   - **Proposal type:** Organisation Restructure
   - **Background:** (use case summary above)
4. Upload attachments: org charts, establishment schedule, draft JDs, consultation letter.
5. Save as **Draft**, then submit to PSC when complete.
6. **Checkpoint:** Reference number generated; stage = *Submitted to PSC*.

**Login:** `head_of_agency` (DG) — if your workflow requires DG endorsement before PSC receipt, endorse the package.

---

### Part B — PSC intake and route to ODU (10 min)

**Login:** `psc_officer`

1. Locate the MFEM submission in the register.
2. Transition: **Received by PSC** → **Registered and Routed**.
3. Set **routed unit** = **ODU** and agenda section appropriate for structure/restructure.
4. Advance to **Manager Checklist Review**.
5. **Checkpoint:** `routed_unit` = `odu`, stage = `manager_checklist_review`.

---

### Part C — ODU Manager assigns specialists (10 min)

**Login:** `odu_manager` (Sera)

1. Open the submission; confirm it appears in your ODU queue (not another unit’s).
2. Use **Assign** (or equivalent) to allocate:
   - **Principal Organization Development Analyst** — overall org design, corporate plan alignment, completeness of restructure narrative.
   - **Principal Job Analyst** — establishment schedule, grading, JDs, job evaluation notes.
3. **Checkpoint:** Each analyst sees the submission only after assignment; others in ODU do not.

**Discussion question:** Why must the manager not assign a VIPAM or HR Unit principal to this case?

---

### Part D — Principal Organization Development Analyst (25 min)

**Login:** `principal_org_dev_analyst` (Poma)

1. Open the assigned submission.
2. Open the **ODU Restructure Checklist** (ORG-3.1 / PSC 2-1 only, during checklist review).
3. If no checklist exists, start the draft (system may pre-fill Section A from the submission).
4. Work through **Group 1 — Submission completeness** and org-structure items in Groups 2–3:
   - Mark **Yes / No / N/A** with short notes where the case fact supports your answer.
5. Save draft frequently.
6. Do **not** submit yet — leave in **Draft** for combined review with the Job Analyst.

**Checkpoint:** Checklist status = `draft`; at least Groups 1–2 answered.

---

### Part E — Principal Job Analyst (25 min)

**Login:** `principal_job_analyst` (John)

1. Open the **same** submission (manager should assign the same submission; if your process uses one lead analyst, manager assigns only John and Poma collaborates offline — adjust per local SOP).
2. Complete checklist items on **establishment variation**, **grading**, **job descriptions**, and **cost / FTE** sections.
3. Coordinate with Poma so all **20 items** are answered before one analyst submits.

**Note:** If your SOP designates a single checklist owner, assign only one principal; the other updates **restructure data** or comments on the submission record instead.

4. When all 20 items are answered, **Submit checklist for manager review**.
5. **Checkpoint:** Checklist status = `submitted`.

---

### Part F — ODU Manager approves checklist (10 min)

**Login:** `odu_manager`

1. Open submission; review checklist **read-only**.
2. Verify disagreements between analysts are resolved in notes.
3. **Approve** checklist.
4. Transition submission to **Under Assessment** (or your next stage per local workflow).
5. **Checkpoint:** Checklist = `approved`; audit trail shows approve action.

---

### Part G — Optional: assessment and Commission path (15 min)

1. Assigned principal completes any remaining **restructure data** fields on the submission.
2. `psc_officer` / `psc_secretary` — forward toward Commission when ready (trainer demonstrates only).
3. Discuss post-decision task allocation to `odu_manager` if the Commission approves with implementation actions.

---

## 5. Scoring rubric (trainer)

| Criterion | Pass |
|-----------|------|
| Routing | Submission routed to ODU only; correct agenda section |
| Assignment | Manager assigned only ODU principal/senior roles within unit |
| Checklist eligibility | Checklist visible only for PSC 2-1 / ORG-3.1 in checklist review |
| Role separation | Org Dev vs Job Analyst items completed with appropriate focus |
| Submission | All 20 checklist items answered before submit |
| Approval | Manager approval recorded before leaving checklist review |
| Security | Principals cannot open submissions not assigned to them |

---

## 6. Common mistakes (debrief)

1. **Wrong form code** — checklist does not appear (must be ORG-3.1 or PSC 2-1).
2. **Wrong stage** — checklist only in `manager_checklist_review`.
3. **Cross-unit assignment** — manager tries to assign `hr_unit_principal` to an ODU case (system should reject).
4. **Submitting incomplete checklist** — fewer than 20 answers.
5. **Wrong role on user profile** — user has `odu_principal` vs specialist role; both work, but training should use the new role titles for clarity.

---

## 7. Quick reference — API / system codes

- Form types: `PSC 2-1`, `ORG-3.1`
- Routed unit: `odu`
- Stage for checklist: `manager_checklist_review`
- Role codes: `principal_org_dev_analyst`, `principal_job_analyst`, `odu_manager`

---

## 8. After training

1. Create production users in **Administration → Users** with the correct role.
2. Run `python manage.py seed_tracker` on new environments to refresh role definitions (or rely on migration `0096`).
3. File this exercise with your ODU SOP and the [Unit Manager Guide](../user-guide-unit-manager.qmd) as applicable.

*Office of the Public Service Commission — SCDMS training material.*
