---
output:
  word_document: default
  html_document: default
---
# PSC Form 2.1 & 2.2 — Submission Workflow
*For review by the Organisational Development Unit (ODU)*

---

## Diagram 1 — How PSC Form 2.2 is Submitted (Two Paths)

```mermaid
flowchart TD
    A([Ministry HR Manager\nlogs into SCDMS]) --> B[Selects PSC Form 2.2\nJob Description]
    B --> C{How is this JD\nbeing submitted?}

    C -->|Attached to a\nForm 2.1 submission| D[Search and link\nparent Form 2.1]
    C -->|Standalone submission| E[Proceed as\nindependent submission]

    D --> F[Fill in JD form only\nNo separate routing\nNo separate checklist\nReviewed alongside Form 2.1]

    E --> G[Fill in JD form\n+ Upload DG signed letter\nFull workflow applies]

    F --> H([Submitted as attachment\nto Form 2.1])
    G --> I([Submitted independently\nto PSC])
```

---

## Diagram 2 — Full PSC Internal Workflow

```mermaid
flowchart TD
    subgraph MINISTRY ["MINISTRY"]
        M1([Ministry HR Manager\nSubmits via SCDMS])
    end

    subgraph PSC_INTAKE ["PSC — INTAKE & AUTOMATED ROUTING"]
        R0{Submission\nType?}
        R1[Restructure /\nAnomalies]
        R2[Annual Report /\nBusiness Plan]
        R3[Discipline /\nGrievance /\nSuspension]
        R4[Other Submissions\ne.g. Regrading /\nName Change]
    end

    subgraph ODU ["ODU — ORGANISATIONAL DEVELOPMENT UNIT"]
        O1[Principal\nJob Analyst]
        O2[Principal\nOrganisation\nDevelopment]
        O3[Manager ODU\nChecklist &\nAssessment]
        O4[Manager ODU\nOversees process]
        O5{Return for\nClarification?}
    end

    subgraph OTHER_UNITS ["OTHER PSC UNITS"]
        U1[Manager CIU\nConduct &\nInvestigation]
        U2[Manager VIPAM]
        U3[Manager HRM\nHuman Resource\nManagement]
    end

    subgraph SECRETARIAT ["PSC SECRETARIAT"]
        S1[Secretary\nSign-off]
        S2[Secretary of Secretary\nFinal Approval]
    end

    subgraph COMMISSION ["PSC COMMISSION SITTING"]
        C1[Commission\nSitting]
        C2{Commission\nDecision}
        C3[APPROVED\nAll attached Form 2.2s\nauto-cascade to Approved]
        C4[REJECTED\nAll attached Form 2.2s\nauto-cascade to Rejected]
        C5[RETURNED /\nDEFERRED]
    end

    subgraph POST ["POST-DECISION"]
        D1[Minutes Drafted\nand Signed]
        D2[Decision Entered\nand Assigned]
        D3[Under\nImplementation]
        D4[Implementation\nReport]
    end

    M1 --> R0

    R0 -->|Restructure /\nAnomalies| R1
    R0 -->|Annual Report /\nBusiness Plan| R2
    R0 -->|Discipline /\nGrievance /\nSuspension| R3
    R0 -->|Other| R4

    R1 --> O1
    R2 --> O2
    O1 --> O3
    O2 --> O3

    R3 --> U1
    R4 --> U2
    R4 --> U3

    O3 --> O4
    O4 --> O5
    O5 -->|No issues| S1
    O5 -->|Needs correction| M1

    S1 --> S2
    S2 --> C1

    C1 --> C2
    C2 -->|Approved| C3
    C2 -->|Rejected| C4
    C2 -->|Returned /\nDeferred| C5
    C5 -->|Ministry responds| M1

    C3 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
```

---

## Diagram 3 — Detailed ODU Internal Routing

```mermaid
flowchart TD
    subgraph INTAKE ["FROM PSC INTAKE"]
        I1([Restructure /\nAnomalies submission\nreceived by ODU])
        I2([Annual Report /\nBusiness Plan submission\nreceived by ODU])
    end

    subgraph ODU_PROCESSING ["ODU PROCESSING"]
        P1[Principal Job Analyst\nReviews Form 2.1\nand all attached Form 2.2s\nStatus: Under Assessment]
        P2[Principal Organisation Development\nReviews Annual Report /\nBusiness Plan submission\nStatus: Under Assessment]
        P3[Manager ODU\nChecklist Review:\n• Current Org Structure OPSC-stamped\n• Proposed Org Structure\n• PSC Form 2.2 for each new post\n• OPSC Excel Cost Spreadsheet\n• Other supporting documents\nStatus: Manager Checklist Review]
        P4[Manager ODU\nOversees assessment process\nStatus: Under Oversight]
        P5{Clarification\nNeeded?}
        P6[Return to Ministry\nfor Clarification\nStatus: Returned for Clarification]
    end

    subgraph SECRETARIAT ["PSC SECRETARIAT"]
        S1[Secretary\nPrepares agenda /\nfinal sign-off\nStatus: With Secretary]
        S2[Secretary of Secretary\nFinal authorisation\nbefore Commission\nStatus: With Secretary of Secretary]
    end

    I1 --> P1
    I2 --> P2
    P1 --> P3
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 -->|No| S1
    P5 -->|Yes| P6
    P6 -->|Ministry resubmits| P3
    S1 --> S2
    S2 -->|Forwarded to Commission| C([Commission Sitting])
```

---

## Diagram 4 — How Form 2.2 Attachments Appear in the System
*(What the PSC sees in the Submission Log)*

```mermaid
flowchart LR
    subgraph LOG ["Submission Log — PSC View"]
        direction TB
        R1["PSC-2025-00142 — Restructure of Ministry of Finance\n Form 2.1  |  Submitted  |  Ministry of Finance"]
        R2["    └ PSC-2025-00143 — Senior Finance Officer JD\n        Form 2.2 attached  |  Submitted"]
        R3["    └ PSC-2025-00144 — Data Entry Clerk JD\n        Form 2.2 attached  |  Submitted"]
        R4["PSC-2025-00145 — Regrading of Budget Officer\n Form 2.2 standalone  |  Submitted  |  Ministry of Finance"]
        R1 --- R2
        R1 --- R3
    end
```

---

## Summary Table — ODU Involvement by Submission Type

| | PSC Form 2.1 (Restructure) | Form 2.2 Attached to 2.1 | Form 2.2 Standalone |
|---|---|---|---|
| **Automated routing to** | Principal Job Analyst → Manager ODU | No — reviewed with parent 2.1 | Manager ODU directly |
| **Separate checklist review** | Yes — Manager ODU | No | Yes — Manager ODU |
| **DG letter required** | No | No | Yes |
| **ODU assessment report** | Yes — Principal Job Analyst | Covered by 2.1 report | Yes |
| **Commission decision** | Yes | Auto-cascades from 2.1 | Yes |
| **Appears in log as top-level** | Yes | No — indented under 2.1 | Yes |
| **Return for clarification** | Manager ODU → Ministry HR Manager | Via parent 2.1 | Manager ODU → Ministry HR Manager |

---

## Routing Decision Table — By Submission Type

| Submission Type | Routed To |
|---|---|
| Restructure / Anomalies | Principal Job Analyst → Manager ODU |
| Annual Report / Business Plan | Principal Organisation Development → Manager ODU |
| Discipline / Grievance / Suspension | Manager CIU |
| Regrading / Name Change / Other | Manager VIPAM / Manager HRM |

---

*Diagram prepared by IPDU · SCDMS System · May 2026*
