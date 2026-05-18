# PSC Form 2.1 & 2.2 — Submission Workflow
*For review by the Organisational Development Unit (ODU)*

---

## Diagram 1 — How PSC Form 2.2 is Submitted (Two Paths)

```mermaid
flowchart TD
    A([Ministry logs into SCDMS]) --> B[Selects PSC Form 2.2\nJob Description]
    B --> C{How is this JD\nbeing submitted?}

    C -->|Attached to a\nForm 2.1 submission| D[Search and link\nparent Form 2.1]
    C -->|Standalone submission| E[Proceed as\nindependent submission]

    D --> F[Fill in JD form only\nNo separate routing\nNo separate checklist\nReviewed alongside Form 2.1]

    E --> G[Fill in JD form\n+ Upload DG signed letter\nFull workflow applies]

    F --> H([Submitted as attachment\nto Form 2.1])
    G --> I([Submitted independently\nto PSC])
```

---

## Diagram 2 — Full Workflow: PSC Form 2.1 with Attached Form 2.2

```mermaid
flowchart TD
    subgraph MINISTRY ["MINISTRY SIDE"]
        M1[Ministry creates\nPSC Form 2.1\nOrganisation Restructure] 
        M1 --> M2[Fills digitized form:\nSubmission Details\nBackground & Reasons\nProposal & Positions\nCosting & Budget\nImplementation Plan\nRecommendation]
        M2 --> M3{New positions\nbeing created?}
        M3 -->|Yes| M4[Create PSC Form 2.2\nfor each new position\nlinked as attachment\nto this Form 2.1]
        M3 -->|No| M5
        M4 --> M5[Ministry submits\nStatus: Submitted to PSC]
    end

    subgraph PSC_INTAKE ["PSC INTAKE"]
        P1[PSC receives submission\nStatus: Received by PSC]
        P2{Complete?}
        P3[Returned for Clarification\nMinistry corrects and resubmits]
        P4[Registered and Routed\nto ODU\nStatus: Registered & Routed]
    end

    subgraph ODU ["ODU REVIEW"]
        O1[ODU Manager reviews\nchecklist of required documents:\n• Current Org Structure OPSC-stamped\n• Proposed Org Structure\n• PSC Form 2.2 for each new post\n• OPSC Excel Cost Spreadsheet\n• Other supporting documents\nStatus: Manager Checklist Review]
        O2[ODU Manager assigns\nto ODU Principal\nfor detailed assessment]
        O3[ODU Principal conducts\nassessment and prepares\nrecommendation report\nStatus: Under Assessment]
    end

    subgraph COMMISSION ["PSC COMMISSION"]
        C1[Submission forwarded\nto Commission\nStatus: Forwarded to Commission]
        C2[Commission Sitting\nStatus: Commission Sitting]
        C3{Commission\nDecision}
        C4[APPROVED\nAll attached Form 2.2s\nautomatically cascade\nto Approved status]
        C5[REJECTED\nAll attached Form 2.2s\nautomatically cascade\nto Rejected status]
        C6[RETURNED / DEFERRED\nBack to Ministry or\nheld for further review]
    end

    subgraph POST ["POST-DECISION"]
        D1[Minutes Drafted and Signed]
        D2[Decision Entered and Assigned]
        D3[Under Implementation]
        D4[Implementation Report]
    end

    M5 --> P1
    P1 --> P2
    P2 -->|Incomplete| P3
    P3 -->|Resubmitted| P1
    P2 -->|Complete| P4
    P4 --> O1
    O1 --> O2
    O2 --> O3
    O3 --> C1
    C1 --> C2
    C2 --> C3
    C3 -->|Approved| C4
    C3 -->|Rejected| C5
    C3 -->|Returned/Deferred| C6
    C6 -->|Ministry responds| P1
    C4 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
```

---

## Diagram 3 — Standalone PSC Form 2.2 Workflow
*(e.g. Regrading, Position Name Change — submitted without a Form 2.1)*

```mermaid
flowchart TD
    subgraph MINISTRY ["MINISTRY SIDE"]
        S1[Ministry creates\nPSC Form 2.2\nStandalone submission]
        S1 --> S2[Fills in Job Description form\nUploads DG signed letter\nsupporting the request\ne.g. regrading or name change]
        S2 --> S3[Ministry submits\nStatus: Submitted to PSC]
    end

    subgraph PSC_INTAKE ["PSC INTAKE"]
        S4[PSC receives submission\nStatus: Received by PSC]
        S5{Complete?\nDG letter present?}
        S6[Returned for Clarification]
        S7[Registered and Routed\nto ODU]
    end

    subgraph ODU ["ODU REVIEW"]
        S8[ODU Manager reviews checklist:\n• DG Signed Letter\n• Completed PSC Form 2.2\nStatus: Manager Checklist Review]
        S9[ODU Principal assesses\nregrading or JD change\nStatus: Under Assessment]
    end

    subgraph COMMISSION ["PSC COMMISSION"]
        S10[Forwarded to Commission]
        S11[Commission Sitting]
        S12{Decision}
        S13[APPROVED]
        S14[REJECTED / RETURNED]
    end

    S3 --> S4
    S4 --> S5
    S5 -->|Incomplete| S6
    S6 -->|Resubmitted| S4
    S5 -->|Complete| S7
    S7 --> S8
    S8 --> S9
    S9 --> S10
    S10 --> S11
    S11 --> S12
    S12 -->|Approved| S13
    S12 -->|Rejected/Returned| S14
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

| | PSC Form 2.1 | Form 2.2 Attached to 2.1 | Form 2.2 Standalone |
|---|---|---|---|
| **Separate routing to ODU** | Yes | No — reviewed with parent 2.1 | Yes |
| **Separate checklist review** | Yes | No | Yes |
| **DG letter required** | No | No | Yes |
| **ODU assessment report** | Yes | Covered by 2.1 report | Yes |
| **Commission decision** | Yes | Auto-cascades from 2.1 | Yes |
| **Appears in log as top-level** | Yes | No — indented under 2.1 | Yes |

---

*Diagram prepared by IPDU · SCDMS System · May 2026*
