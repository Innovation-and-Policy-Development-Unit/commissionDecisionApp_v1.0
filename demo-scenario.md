# Live Demo Scenario: Full Submission-to-Implementation Workflow

## Scenario: Restructure of the Curriculum Development Unit, Ministry of Education (MET)

A complete walkthrough showing a submission entering the system, being assessed, decided at a Commission sitting, minutes signed by the Chairperson, and tasks allocated **only after** sign-off — in full alignment with the PSC SOP.

---

## Setup (run before demo)

```bash
docker compose exec backend python manage.py seed_tracker --clear --force-submissions
```

**Note:** Seed data now includes `FormCategory.display_order` values, so agenda items auto-sort by category priority.

---

## Part 1: Submission Creation & Intake (5 min)

### Step 1 — Ministry HR prepares and Head of Agency endorses
| Actor | Username | Password |
|-------|----------|----------|
| HR Officer, MET | `hr.education` | `Ministry123!` |
| Director General, MET | `dg.met` | `DG12345!` |

1. Login as **hr.education**
   - **(DEMO: Push Notification)** Instead of typing a 6-digit OTP, the screen shows a **simulated Microsoft Authenticator push notification** — click **Approve Push**
   - Behind the scenes, `DEMO_MODE=true` auto-generates the valid TOTP code
2. Go to **Submissions** → **Create Submission**
3. Fill in:
   - **Title:** *Proposal to Restructure the Curriculum Development Unit, Ministry of Education*
   - **Category:** Organisation & Structure
   - **Classification:** Confidential (default per SOP Section 4)
   - **Ministry:** MET (Ministry of Education)
   - **Department:** CURRICULUM (Curriculum Development Unit)
4. **Save as Draft** → shows at DRAFT stage
5. **SOP Alignment:** Switch to **dg.met** — the Head of Agency reviews and endorses
6. Open the submission → Click **Endorse** → the submission is now endorsed by the Director General
7. Switch back to **hr.education** → Click **Submit to PSC** → advances to SUBMITTED
8. *Notification is sent to the relevant OPSC Unit Manager*

### Step 1b — HR User sees estimated meeting date (NEW)
| Actor | Username | Password |
|-------|----------|----------|
| HR Officer, MET | `hr.education` | `Ministry123!` |

1. Login as **hr.education**
2. Open the submission from the list
3. **Notice the Estimated Meeting Date field** — shows the next upcoming Commission sitting date
4. This field appears on both the **list view** (submissions table) and **detail view**
5. Helps HR plan their workflow and set stakeholder expectations
6. **Show this to audience:** *"When your submission will be heard is now visible from the moment of submission"*

### Step 2 — PSC Admin receives and registers
| Actor | Username | Password |
|-------|----------|----------|
| PSC Admin | `admin` | `Admin1234!` |

1. Login as **admin**
2. Open the submission from the list
3. Click **Receive at PSC** → advances to RECEIVED_BY_PSC
4. Click **Register & Route** → fill in:
   - **Routed Unit:** HR Unit
5. Submit → advances to REGISTERED_ROUTED, reference number generated

### Step 3 — Senior Admin Officer / Secretary manages agenda
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Login as **s.tari** (Senior Administration Officer — SOP Section 6)
2. Open the submission
3. Click **Forward to Checklist Review** → advances to MANAGER_CHECKLIST_REVIEW

---

## Part 2: Assessment & Commission Readiness (3 min)

### Step 4 — HR Unit Manager clears checklist
| Actor | Username | Password |
|-------|----------|----------|
| HR Unit Manager | `m.hrunit` | `Manager123!` |

1. Login as **m.hrunit**
2. Open the submission from the queue (MANAGER_CHECKLIST_REVIEW)
3. Review the checklist items and click **Approve Checklist** → advances to UNDER_ASSESSMENT

### Step 5 — PSC Officer completes assessment
| Actor | Username | Password |
|-------|----------|----------|
| PSC Officer | `p.mahe` | `Officer123!` |

1. Login as **p.mahe**
2. Open the submission (UNDER_ASSESSMENT)
3. Click **Forward to Commission** → advances to FORWARDED_TO_COMMISSION

### Step 6 — Senior Admin Officer schedules for Commission
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Login as **s.tari**
2. Go to **Commission Sittings** → **Schedule Meeting**
3. Create a sitting:
   - **Title:** *PSC Ordinary Meeting 10/2026*
   - **Type:** Ordinary Sitting
   - **Date:** *[next Tuesday]*
   - **Venue:** *PSC Conference Room*
4. Add the restructure submission to the agenda
5. Notice the agenda items are **auto-ordered** by `FormCategory.display_order`:
   - *Corporate Services* items appear first, then *Organisation & Structure*, etc.
   - Same-category items are ordered FIFO by creation time
6. **(DEMO: Agenda Reorder)** Use the **drag handles** on each agenda item to reorder them
7. Click **Save Order** — sends `POST /agenda/items/reorder/` with the new sequence
8. The agenda persists in the new order

### Step 6b — SOP Agenda Approval Gate (NEW)
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Click **Submit Agenda to Chairperson** → agenda_status changes to `with_chairman`

| Actor | Username | Password |
|-------|----------|----------|
| Chairperson | `j.taue` | `Commissioner123!` |

2. Login as **j.taue** (Chairperson, PSC — SOP Section 6)
3. Open the meeting → Click **Approve Agenda** → agenda_status changes to `chairman_approved`
4. **SHOW THIS TO AUDIENCE:** *The agenda is now approved by the Chairperson*

| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

5. Login as **s.tari** → Click **Circulate Agenda** → agenda_status changes to `circulated`
6. Open the submission → Click **Schedule for Sitting** → advances to COMMISSION_SITTING

### Step 6c — Cutoff Enforcement Demo (NEW)
1. While still logged in as **s.tari**, try adding a NEW agenda item to the same meeting
2. If the current time is **past** the meeting's `submission_cutoff`, the system blocks it:
   > *"Cannot add agenda item: Submission cutoff for this meeting was [datetime]. This item has been queued for the next available meeting."*
3. **Show this to audience** — ensures late items don't disrupt prepared agendas
4. Navigate to the next scheduled meeting to confirm the item was auto-queued there

---

## Part 3: Commission Deliberation & Decision (3 min)

### Step 7 — Chairperson records decision
| Actor | Username | Password |
|-------|----------|----------|
| Chairperson, PSC | `j.taue` | `Commissioner123!` |

1. Login as **j.taue**
2. Open the submission (COMMISSION_SITTING)
3. Click **Record Decision** → Select: **APPROVED**
4. Add decision notes
5. Confirm → advances to APPROVED

### KEY POINT — Task creation is BLOCKED here
1. Try to go to **Commission Tasks** → **Create Task**
2. Select this submission → the system **blocks it**:
   > *"Cannot allocate task: Commission minutes have not been signed yet."*
3. **Show this error to the audience**

---

## Part 4: Minutes Drafting & Chairperson Sign-Off (5 min)

### Step 8 — Senior Admin Officer drafts minutes
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Login as **s.tari**
2. Go to **Commission Sittings** → select Meeting 10/2026
3. Click **Minutes** → **Draft Minutes**
4. AI-assisted: click **AI Draft Minutes** to auto-generate
5. Review and edit, then **Save**

### Step 9 — Senior Admin Officer reviews minutes
1. Click **Mark as Reviewed** → status changes to REVIEWED

### Step 10 — Chairperson signs (Critical Moment — SOP Stage 3, step 7)
| Actor | Username | Password |
|-------|----------|----------|
| Chairperson, PSC | `j.taue` | `Commissioner123!` |

1. Login as **j.taue**
2. Go to **Commission Sittings** → Meeting 10/2026 → Minutes
3. Click **Sign Minutes**
4. Enter PIN when prompted → confirm
5. Status changes to **SIGNED** — PDF generated with embedded signature
6. *circulated_at timestamp recorded for SLA tracking* (SOP: minutes within 3 days)

---

## Part 5: Task Allocation (only NOW possible) (3 min)

### Step 11 — Senior Admin Officer advances and delegates
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Open the submission (now at MINUTES_DRAFTED_SIGNED)
2. Click **Advance to Decision Entered & Assigned** → DECISION_ENTERED_ASSIGNED
3. Go to **Commission Tasks** → **Create Task** → **Success!** (was blocked before)
4. **HIGHLIGHT TO AUDIENCE:** *This was not possible 5 minutes ago before the Chairperson signed*

### Step 12 — OPSC Manager assigns to staff
| Actor | Username | Password |
|-------|----------|----------|
| OPSC Manager | `m.opsc` | `Manager123!` |

1. Login as **m.opsc**
2. Open the task → Click **Assign to Staff** → select **p.mahe**
3. Create subtasks with due dates

### Step 13 — Staff executes tasks (SOP: 3-day SLA)
| Actor | Username | Password |
|-------|----------|----------|
| PSC Officer | `p.mahe` | `Officer123!` |

1. Login as **p.mahe**
2. Dashboard shows assigned tasks with SLA due dates
3. Mark subtasks as completed
4. Update submission to UNDER_IMPLEMENTATION

---

## Part 6: Flying Minute Demo (brief, if time permits)

### Step 14 — Create a Flying Minute (SOP Section 8)
| Actor | Username | Password |
|-------|----------|----------|
| Senior Admin Officer | `s.tari` | `Officer123!` |

1. Login as **s.tari**
2. Go to **Commission Sittings** → **Schedule Meeting**
3. Set **Type:** Flying Minute
4. **Title:** *Urgent: Approval for Emergency Teacher Recruitment — MET*
5. Add the urgent submission to the agenda
6. Click **Submit Agenda to Chairperson**

| Actor | Username | Password |
|-------|----------|----------|
| Chairperson, PSC | `j.taue` | `Commissioner123!` |

7. Login as **j.taue**
8. Open the Flying Minute → Review → **Approve Agenda**
9. Click **Circulate to Members**

| Actor | Username | Password |
|-------|----------|----------|
| PSC Commissioner | `m.carlot` | `Commissioner123!` |

10. Login as **m.carlot**
11. Open the Flying Minute → Click **Sign Flying Minute** → select **Approve**
12. The signature is recorded in `FlyingMinuteSignature`

---

## SOP Alignment Summary

| SOP Requirement | System Implementation | Status |
|----------------|----------------------|--------|
| **Sec 4: Classification** | `classification` field on Submission (default: Confidential) | ✅ |
| **Sec 6: Senior Admin Officer** | `s.tari` user with `senior_admin_officer` role | ✅ |
| **Sec 6: Head of Agency endorsement** | `dg_endorsed_by`/`dg_endorsed_at` on Submission | ✅ |
| **Sec 6: Chairperson (Chairman)** | `j.taue` user with `chairperson` role | ✅ |
| **Sec 6: ODU Manager** | `m.odu` user with `odu_manager` role | ✅ |
| **Stage 1, Step 2: DG signs before dispatch** | Head of Agency endorsement tracked in system | ✅ |
| **Stage 2, Step 1: Secretary allocates to Managers** | Unit routing to manager_checklist_review | ✅ |
| **Stage 2, Step 4: Compliance check → return or forward** | return_for_clarification vs under_assessment | ✅ |
| **Stage 3, Step 2-3: Chairman approves agenda** | agenda_status flow: draft → with_chairman → chairman_approved → circulated | ✅ |
| **Stage 3, Step 6: Deferred with reason → re-listed** | Deferred stage + reason tracking | ✅ |
| **Stage 3, Step 7: Minutes in 3 days** | `minutes_due_at` SLA field on Minutes | ✅ |
| **Stage 3, Step 8: Upload → Managers allocate → staff complete in 3 days** | CommissionTask with `allocate_decision` blocked until minutes signed | ✅ |
| **Submission Cutoff Enforcement** | Items past cutoff auto-queued to next meeting | ✅ |
| **Agenda Auto-Ordering + Reorder** | `display_order` on FormCategory + `POST /agenda/items/reorder/` | ✅ |
| **Estimated Meeting Date** | Dynamic property exposed in submission list/detail serializers | ✅ |
| **Demo Push Notification** | `DEMO_MODE` auto-generates TOTP; simulated Authenticator push | ✅ |
| **Stage 3, Step 9: Report abstracted for next Commission** | IMPLEMENTATION_REPORT stage | ✅ |
| **Sec 8: Flying Minute** | Meeting type `flying_minute` + FlyingMinuteSignature model | ✅ |
| **Sec 8: Urgent request → assessment → circulate → sign → act** | Full workflow with custom endpoints | ✅ |

---

## Quick Reference: All Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| `hr.education` | `Ministry123!` | Ministry HR (MET) |
| `dg.met` | `DG12345!` | Head of Agency (DG, MET) |
| `admin` | `Admin1234!` | PSC Administrator |
| `s.tari` | `Officer123!` | Senior Administration Officer |
| `j.iati` | `Secretary123!` | PSC Secretary |
| `j.taue` | `Commissioner123!` | Chairperson, PSC |
| `m.carlot` | `Commissioner123!` | PSC Commissioner |
| `m.hrunit` | `Manager123!` | HR Unit Manager |
| `m.odu` | `Manager123!` | ODU Manager |
| `m.compliance` | `Manager123!` | Compliance Manager |
| `m.vipam` | `Manager123!` | VIPAM Manager |
| `m.opsc` | `Manager123!` | OPSC Manager |
| `p.mahe` | `Officer123!` | PSC Officer |
| `r.kalsakau` | `Officer123!` | PSC Officer (backup) |
