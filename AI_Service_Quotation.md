---
output:
  pdf_document: default
  html_document: default
---
# QUOTATION — AI API SERVICE
## Public Service Commission of Vanuatu
### Submission & Commission Decision Management System (SCDMS)

---

**Document Reference:** SCDMS/AI/2026/001
**Date:** 21 May 2026
**Prepared by:** Information and Technology Planning Division (IPDU)
**Submitted to:** Director, IPDU
**Version:** 3.0 (revised to full single-scope implementation)

---

## 1. Purpose

This document provides a cost quotation and justification for the procurement of Artificial Intelligence (AI) API services to power **24 planned AI features** across 6 functional categories within the Public Service Commission's Submission and Commission Decision Management System (SCDMS). The features span both the Commission Decision Portal (CDP) and the parallel Case Management System (CMS) operated by the Compliance Unit.

---

## 2. Background

The SCDMS is a full-stack web application developed for the Public Service Commission (PSC) of Vanuatu that manages the complete lifecycle of personnel decisions — from ministry submission through PSC assessment, commission sittings, formal minutes, and post-decision implementation tracking. A parallel Case Management System (CMS) has been developed for the Compliance Unit to manage disciplinary, misconduct, grievance, and performance cases.

### System User Base

| User Group | Count | System Role |
|---|---|---|
| Ministry HR Managers | ~15–26 (1–2 per ministry × 13 ministries) | Submit compliance cases via CDP portal |
| OPSC Compliance Officers | ~10–15 | Manage cases in CMS |
| OPSC Commission Secretary & Assistants | ~5 | Manage Commission sittings, minutes, decisions |
| OPSC Senior Management / Director | ~5 | Reporting, oversight, approvals |
| OPSC Administrative & Other Staff | ~20 | General system use |
| **Total active users** | **~65–90** | |

All 13 line ministries will have HR Managers accessing the Commission Decision Portal. Approximately 50 OPSC staff will use the Case Management System with different role-based permissions.

As part of the AI integration phase of development, 24 AI-powered features have been identified, scoped, and approved for full implementation. These features require access to an AI language model API provided by **Anthropic PBC**, a leading AI safety company headquartered in San Francisco, USA. All 24 features will be delivered as a single scope of work.

---

## 3. Proposed AI Features

All 24 features are included in the full implementation scope and are grouped into six categories.

---

### CATEGORY A — Submission Intelligence (CDP)

#### A1. Auto-Fill Compliance ChecklistWhen an HR Manager uploads a submission along with supporting documents, the AI reads the submission text and attached PDFs, then automatically pre-fills the compliance checklist fields — e.g. *"Was the employee given 48-hour notice?", "Is the allegation specific?", "Has the supervisor signed?"*. The compliance officer reviews and confirms the AI-filled answers rather than reading every document from scratch.

**Benefit:** Reduces compliance officer workload by an estimated 60–70% per submission. Directly addresses the Commission's goal of reducing workflow time. Benefits all 13 ministry HR Managers submitting cases.
**Model:** Claude Haiku 4.5

#### A2. Document Classification
When a document is uploaded (PDF, image, Word file), the AI identifies the document type — e.g. *Appointment Letter, Notice of Allegation, Medical Certificate, PSC Form 7* — and tags it automatically.

**Benefit:** Eliminates manual labelling of attachments. Makes document search accurate and fast across the entire case file.
**Model:** Claude Haiku 4.5

#### A3. Missing Information DetectorBefore an HR Manager can submit, the AI scans the draft submission and produces a plain-English list of what is missing or incomplete — e.g. *"Employee's response is not attached", "Date of incident is not specified"*. Critical gaps block submission.

**Benefit:** Prevents incomplete submissions reaching the PSC, reducing the most common cause of submission delays and returns across all 13 ministries.
**Model:** Claude Haiku 4.5

#### A4. Duplicate / Similar Submission Detector
When a new submission is received, the AI compares it against existing cases and flags if a highly similar or duplicate case already exists, showing a link to the original.

**Benefit:** Prevents duplicate case creation when a ministry accidentally re-submits or uses a slightly different subject name.
**Model:** Claude Sonnet 4.6

#### A5. Submission Quality Score
After submission, the AI assigns a quality score (e.g. 78/100) based on completeness, clarity, quality of evidence, and adherence to PSC formatting requirements, with a brief explanation.

**Benefit:** Gives compliance officers an immediate signal of how much review work a submission requires.
**Model:** Claude Haiku 4.5

---

### CATEGORY B — Case Management Intelligence (CMS)

#### B1. Case Summary GeneratorA compliance officer clicks "Generate Summary" and the AI reads the full case file — submission, documents, notes, stage history, employee responses — and produces a structured 1–2 page summary in plain English covering: background, allegation, timeline, employee response, key evidence, current stage, and outstanding actions.

**Benefit:** Eliminates hours of manual file review when cases transfer between officers or when briefing a new reviewer. Particularly valuable with a team of 10–15 compliance officers handling concurrent cases.
**Model:** Claude Sonnet 4.6

#### B2. Risk Assessment
The AI analyses case attributes — seniority of the subject, nature of the allegation, prior cases, ministry history, SLA status — and produces a risk rating (Low / Medium / High / Critical) with a short explanation. High-risk cases are visually flagged on the dashboard.

**Benefit:** Ensures senior executive and politically sensitive matters receive appropriate priority and are not buried in a queue.
**Model:** Claude Sonnet 4.6

#### B3. Recommended Outcome (Advisory)
Based on case facts, allegation type, evidence, and employee response, the AI suggests a recommended outcome (e.g. *Formal Warning, Termination, No Further Action*) with a short rationale. This is advisory only — the officer and Commission retain full decision-making authority.

**Benefit:** Supports junior officers with a reference point and promotes consistency of outcomes across all case types and officers.
**Model:** Claude Sonnet 4.6
*Note: AI recommendation will be displayed with a mandatory disclaimer.*

#### B4. SLA Breach Predictor
The AI monitors case progress and predicts when a stage is likely to breach its statutory deadline — based on current pace, officer workload, and historical patterns — and sends an early warning notification before the standard system alert.

**Benefit:** Converts reactive deadline alerts into proactive interventions. Especially important with ~100 active cases managed concurrently across the compliance team.
**Model:** Claude Haiku 4.5

#### B5. Auto-Draft Notice of AllegationFrom the case facts (subject details, allegation description, date of incident, regulatory reference), the AI drafts a formal Notice of Allegation letter in the standard PSC format for officer review, editing, and approval.

**Benefit:** Reduces Notice of Allegation drafting from 30–60 minutes to a 5-minute review.
**Model:** Claude Sonnet 4.6

---

### CATEGORY C — Reporting & Analytics

#### C1. Natural Language Report GenerationA manager types a plain-English question such as *"How many disciplinary cases were opened in the Ministry of Finance this year?"* or *"Show me all overdue cases involving senior executives"* — and the system generates the report, data table, and optional chart.

**Benefit:** Eliminates the need for technical staff or pre-built report templates. All 50 OPSC staff can get answers instantly without relying on IT.
**Model:** Claude Sonnet 4.6

#### C2. AI-Generated Executive Summary for Commission Meetings
Before each Commission sitting, the AI compiles a structured executive briefing: cases ready for decision, outstanding matters from the previous sitting, SLA performance, at-risk cases, and flagged priorities — produced automatically from live system data.

**Benefit:** Reduces manual preparation of Commission briefing packs from a half-day task to a one-click operation.
**Model:** Claude Sonnet 4.6

#### C3. Trend Analysis
The AI analyses patterns across all cases — which of the 13 ministries have the highest misconduct rates, which case types are increasing, outcome consistency over time — and surfaces these as a dashboard report.

**Benefit:** Enables the Commission to make data-driven systemic recommendations and target capacity-building at high-risk ministries.
**Model:** Claude Sonnet 4.6

#### C4. Meeting Minutes → Action Items Extractor
An officer pastes meeting minutes text and the AI extracts decisions made, action items with owners and deadlines, deferred matters, and follow-up questions, formatted as a structured action register.

**Benefit:** Ensures no action items are missed from Commission meeting minutes.
**Model:** Claude Haiku 4.5

---

### CATEGORY D — Chatbot / Conversational Interface

#### D1. Staff Chatbot — PSC Regulations & ProceduresA chat interface where staff can ask plain-English questions about PSC Act provisions, public service regulations, and internal procedures. For example: *"What is the maximum period of temporary suspension without pay?"*, *"Which form do I use for a serious misconduct referral?"*. The AI answers from the PSC Act, regulations, and procedure manuals loaded as its knowledge base.

**Benefit:** Available to all 65–90 users. Reduces procedural errors by HR managers in all 13 ministries. Reduces enquiry calls to the PSC Secretariat.
**Model:** Claude Sonnet 4.6 with document retrieval (RAG)

#### D2. Submission Status Chatbot
An employee or HR manager types *"What is the status of case PSC-2026-00042?"* and receives a plain-English status update without navigating the portal or calling the PSC office.

**Benefit:** Self-service status queries from 13 ministry HR managers free up PSC Secretariat staff from routine enquiry calls.
**Model:** Claude Haiku 4.5

#### D3. Compliance Officer Case Assistant
A case-specific chatbot available to the assigned compliance officer. The officer asks questions about their open case: *"Draft a response to the employee's latest submission"*, *"Summarise what happened in Stage 2"*, *"What does PSC Reg 28 say about this allegation?"*. The AI has access to the full case file as context.

**Benefit:** Reduces the need for officers to search regulations manually or seek senior guidance for every procedural question.
**Model:** Claude Sonnet 4.6

---

### CATEGORY E — Document Processing

#### E1. OCR + Key Facts Extraction from Scanned Documents
When a scanned image or non-searchable PDF is uploaded, the AI extracts and structures the key facts: names, dates, positions, references, and relevant statements. Extracted text is stored as searchable metadata.

**Benefit:** Makes scanned paper records searchable and removes the need to read them manually each time. Important given that many ministry documents arrive as scanned copies.
**Model:** Claude Sonnet 4.6 (vision capability)

#### E2. Meeting Minutes → Structured RecordUpload or paste meeting minutes (Commission sitting, disciplinary hearing) and the AI produces a structured record with: date, attendees, agenda items, decisions per item, action items with owners and deadlines, and matters deferred.

**Benefit:** Reduces manual minutes drafting from hours to a review task. Ensures consistent formatting across all Commission records.
**Model:** Claude Haiku 4.5

#### E3. Auto-Redact Sensitive Data
Before a document is shared externally, the AI identifies and redacts sensitive personal information — witness names, personal addresses, medical details, third-party identifiers — and generates a clean redacted PDF alongside the original.

**Benefit:** Prevents accidental disclosure of sensitive information, reducing legal and reputational risk for the PSC when sharing documents across 13 ministries.
**Model:** Claude Sonnet 4.6

---

### CATEGORY F — Workflow Automation

#### F1. Smart Case Routing
When a new case is created, the AI suggests which officer to assign based on: current workload, case type expertise, seniority of the subject, and ministry familiarity.

**Benefit:** Balances workloads across the compliance team and ensures appropriate expertise matches for complex cases.
**Model:** Claude Haiku 4.5

#### F2. Deadline Notification Drafting
When a case stage is nearing its deadline, the system auto-drafts a personalised reminder email to the responsible officer or ministry contact — including the case reference, what is outstanding, the exact deadline, and consequence of non-compliance.

**Benefit:** Specific, well-written reminders with full case context are more likely to prompt action than generic system alerts. Covers all 13 ministry contacts.
**Model:** Claude Haiku 4.5

#### F3. Compliance Outcome Letter Generator
After the Commission reaches a decision, the AI drafts the formal outcome letter to the subject employee and their ministry in official PSC format, referencing the applicable regulation, the decision, and any required follow-up actions.

**Benefit:** Ensures consistency and legal accuracy in outcome letters. Reduces drafting time from hours to minutes across all case types.
**Model:** Claude Sonnet 4.6

#### F4. Policy Q&A from PSC Act / RegulationsThe full text of the PSC Act, Public Service Regulations, and government circulars are loaded as a knowledge base. Any user can ask a question and receive a direct answer with the exact regulation section cited — e.g. *"What is the statutory period for a disciplinary suspension?"* → *"Under PSC Regulation 31(2), the maximum period is 3 months…"*

**Benefit:** Instant, cited regulatory answers for all 65–90 users including HR Managers across all 13 ministries. Reduces procedural errors system-wide.
**Model:** Claude Sonnet 4.6 with document retrieval (RAG)

---

## 4. Vendor Information

| Field | Detail |
|---|---|
| **Vendor Name** | Anthropic PBC |
| **Country** | United States of America |
| **Website** | console.anthropic.com |
| **Service Type** | AI Language Model API (Claude) |
| **Billing Model** | Pay-per-use (no subscription, no minimum commitment) |
| **Contract Type** | No contract required — cancel at any time |
| **Invoicing** | Monthly invoice or prepaid credit top-up available |
| **Spending Control** | Hard monthly spending cap configurable by the organisation |

**Supporting Vendor (audio transcription):**

| Field | Detail |
|---|---|
| **Vendor Name** | OpenAI LLC |
| **Service** | Whisper API (speech-to-text for meeting minutes) |
| **Billing Model** | Pay-per-use |

---

## 5. Cost Estimate

### Usage Assumptions (based on actual system user base)

| Usage Factor | Basis | Monthly Estimate |
|---|---|---|
| Ministry HR Managers | 1–2 per ministry × 13 ministries | ~15–26 users |
| OPSC system users | All roles | ~50 users |
| **Total active users** | | **~65–90 users** |
| Submissions received per month | ~5–8 per ministry, not all monthly | ~80 submissions |
| Active cases in CMS | Across 10–15 compliance officers | ~100 cases |
| Commission sittings per month | Fixed schedule | 4 sittings |
| Chatbot / Q&A queries | 65–90 users, mixed frequency | ~600 queries |
| Reports and summaries generated | Officers + management | ~80 reports |
| Documents processed (OCR / redact) | Ministry submissions | ~60 documents |
| Feedback comments submitted | All users | ~80 comments |

---

### Monthly Cost Breakdown — All 24 Features

| Feature | Model | Est. Monthly Tokens | Monthly Cost (USD) |
|---|---|---|---|
| A1 — Auto-fill compliance checklist | Haiku 4.5 | 200,000 | ~$0.20 |
| A2 — Document classification | Haiku 4.5 | 75,000 | ~$0.08 |
| A3 — Missing information detector | Haiku 4.5 | 64,000 | ~$0.06 |
| A4 — Duplicate submission detector | Sonnet 4.6 | 100,000 | ~$0.30 |
| A5 — Submission quality score | Haiku 4.5 | 40,000 | ~$0.04 |
| B1 — Case summary generator | Sonnet 4.6 | 800,000 | ~$2.40 |
| B2 — Risk assessment | Sonnet 4.6 | 150,000 | ~$0.45 |
| B3 — Recommended outcome (advisory) | Sonnet 4.6 | 100,000 | ~$0.30 |
| B4 — SLA breach predictor | Haiku 4.5 | 100,000 | ~$0.10 |
| B5 — Auto-draft Notice of Allegation | Sonnet 4.6 | 120,000 | ~$0.36 |
| C1 — Natural language reports | Sonnet 4.6 | 375,000 | ~$1.13 |
| C2 — Executive summary (Commission meetings) | Sonnet 4.6 | 80,000 | ~$0.24 |
| C3 — Trend analysis | Sonnet 4.6 | 80,000 | ~$0.24 |
| C4 — Meeting minutes → action items | Haiku 4.5 | 12,000 | ~$0.01 |
| D1 — Staff chatbot (PSC regulations) | Sonnet 4.6 | 1,000,000 | ~$3.00 |
| D2 — Submission status chatbot | Haiku 4.5 | 100,000 | ~$0.10 |
| D3 — Compliance officer case assistant | Sonnet 4.6 | 250,000 | ~$0.75 |
| E1 — OCR + key facts extraction | Sonnet 4.6 | 150,000 | ~$0.45 |
| E2 — Meeting minutes structured record | Haiku 4.5 | 16,000 | ~$0.02 |
| E3 — Auto-redact sensitive data | Sonnet 4.6 | 60,000 | ~$0.18 |
| F1 — Smart case routing | Haiku 4.5 | 25,000 | ~$0.03 |
| F2 — Deadline notification drafting | Haiku 4.5 | 50,000 | ~$0.05 |
| F3 — Compliance outcome letter generator | Sonnet 4.6 | 60,000 | ~$0.18 |
| F4 — Policy Q&A (PSC Act / Regs) | Sonnet 4.6 | 400,000 | ~$1.20 |
| Meeting Minutes Audio Transcription | OpenAI Whisper | 4 × 90 min avg | ~$2.16 |
| Feedback Triage | Haiku 4.5 | 80 × 300 tokens | ~$0.02 |
| **TOTAL — Standard Usage** | | | **~$18.25 / month** |
| **TOTAL — High Usage (2× volume)** | | | **~$36.50 / month** |

---

### Annual Cost Estimate

| Scenario | Annual Cost (USD) | Annual Cost (approx. VT) |
|---|---|---|
| Standard usage | **~$219 USD** | **~VT 26,061** |
| High usage (2× volume) | **~$438 USD** | **~VT 52,122** |

*VT conversion based on approximate exchange rate of 1 USD = 119 VT. Actual VT amount will vary with exchange rate at time of payment.*

---

### Recommended Approved Annual Budget

| Option | Amount (USD) | Amount (approx. VT) | Notes |
|---|---|---|---|
| **Annual prepaid credit (recommended)** | **USD $250** | **~VT 29,750** | Covers standard usage for 12 months with buffer |
| Annual prepaid credit (high usage buffer) | USD $500 | ~VT 59,500 | Covers high usage for 12 months with buffer |

A prepaid credit of **USD $250** loaded onto the Anthropic account at the start of each financial year is sufficient to cover all 24 features at standard usage for 12 months, with a buffer for growth. Unused credit rolls over and does not expire. A hard monthly spending cap of **USD $40** will be enforced within the Anthropic console to prevent any single month from exceeding budget.

---

## 6. Payment Method

Anthropic supports the following payment options suitable for government procurement:

| Option | Description |
|---|---|
| **Credit / Debit Card** | Monthly charge to a designated government card |
| **Prepaid Credit** | Top-up a fixed amount (e.g. USD $100) — charges draw down from this balance |
| **Invoiced Billing** | Contact Anthropic at sales@anthropic.com to arrange a formal purchase order and invoice — no card required |

**Recommended for PSC:** A single annual prepaid credit top-up of **USD $250** at the start of each financial year. This is the simplest option — one payment, no monthly card charges, no invoices, and unused credit rolls over. Invoiced billing via purchase order is available if required by the Ministry of Finance procurement rules.

---

## 7. Data & Privacy Considerations

- All data sent to the Anthropic API is processed in-transit (HTTPS encrypted)
- Anthropic does not use API inputs to train their models (per their API usage policy)
- No personally identifiable information (PII) beyond what is necessary will be sent — prompts will be structured to pass anonymised or role-level context only
- Data residency: Anthropic processes data in the United States
- AI-generated recommendations (e.g. B3 — Recommended Outcome) will always be displayed with a mandatory disclaimer that the output is advisory only and does not constitute a decision by the PSC
- Role-based access controls ensure ministry HR Managers can only access AI features relevant to their own ministry's submissions

---

## 8. Summary & Recommendation

The 24 AI features proposed for the SCDMS directly support the Commission's strategic goal of **reducing workflow time and administrative burden** across the entire personnel decision lifecycle. With **13 line ministries** submitting cases via the portal and approximately **50 OPSC staff** managing those cases across different roles, the system's AI capabilities will deliver consistent productivity benefits across the entire public service.

Key cost and value summary:

| Scenario | Monthly Cost (USD) | Annual Cost (USD) | Annual Cost (approx. VT) |
|---|---|---|---|
| Standard usage — all 24 features | ~$18.25 | ~$219 | ~VT 26,061 |
| High usage (2× volume) | ~$36.50 | ~$438 | ~VT 52,122 |

**No contract, no lock-in, hard monthly spending cap enforced at all times.**

**It is recommended that the Director, IPDU, approve:**

1. A one-off annual prepaid AI API credit of **USD $250** (approximately **VT 29,750**) to cover all 24 features across all 13 ministries and OPSC staff for the 2026 financial year.
2. A hard monthly spending cap of **USD $40** enforced within the Anthropic console.
3. A formal review of actual costs and usage at the end of the 2026 financial year to determine the following year's budget.

The annual cost of full AI integration — approximately **VT 26,000–30,000 per year** — is negligible relative to the operational savings expected from automating manual processing time across 13 ministries and 50 OPSC staff.

---

## 9. Approval

| | |
|---|---|
| **Prepared by:** | _________________________ |
| **Name / Title:** | IPDU Developer |
| **Date:** | 21 May 2026 |
| | |
| **Approved by:** | _________________________ |
| **Name / Title:** | Director, IPDU |
| **Date:** | _________________________ |

---

*This quotation is based on estimated usage figures for 13 line ministries and approximately 50 OPSC staff, and publicly available Anthropic API pricing as of May 2026. Actual costs may vary. A monthly spending cap will be enforced to ensure costs do not exceed the approved budget. Full feature list and technical specifications are available in `AI_Features_List.txt`.*
