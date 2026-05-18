```mermaid
flowchart TB
    %% Ministry HR (Manual steps only)
    subgraph MinistryHR["Ministry HR (Manual)"]
        direction TB
        HR_Prepare["HR prepares & scans (manual)"]
    end
    
    %% OPSC Processing (System handles everything from submission to implementation)
    subgraph OPSC_Processing["OPSC Processing (System)"]
        direction TB
        %% Submission and initial processing
        SUB["Submitted to PSC"] --> REG["Registered & Routed"]
        REG --> MCR["Manager Checklist Review"]
        MCR --> UA["Under Assessment (21‑day)"]
        
        %% Assessment loops
        UA -->|"Clarification needed"| RFC["Returned for Clarification"]
        RFC --> SUB
        UA -->|"Legal advice"| ALA["Awaiting Legal Advice"]
        ALA --> UA
        
        %% Commission forwarding and sitting (still OPSC-managed)
        UA --> FTC["Forwarded to Commission"]
        FTC --> CS["Commission Sitting"]
        CS -->|"Defer to later meeting"| TAB["Tabled"]
        TAB -->|"Next meeting"| CS
        CS --> APP["Approved"]
        CS --> REJ["Rejected"]
        CS -->|"New: shortcut"| MA["Matters Arising"]
        CS --> DHR["Deferred Back to HR"]
        DHR -->|"Full pipeline"| SUB
        DHR -->|"New: shortcut"| MA
        MA --> CS
        
        %% Post-decision processing (still part of OPSC)
        APP --> MDS["Minutes Drafted & Signed"]
        REJ --> MDS
        MDS --> DEA["Decision Entered & Assigned"]
        DEA --> UI["Under Implementation"]
        UI --> IR["Implementation Report"]
    end
    
    %% Commission (Only the actual deliberation and decision-making)
    subgraph Commission["Commission (Deliberation Only)"]
        direction TB
        %% This represents the Commission's role in the process
        %% The actual flow is managed by OPSC, but Commission makes the decisions
        CS["Commission Sitting"] -->|"Approves/Rejects/Defers"| DecisionOutcome["Decision Outcome"]
        DecisionOutcome --> APP
        DecisionOutcome --> REJ
        DecisionOutcome --> MA
        DecisionOutcome --> DHR
        DecisionOutcome:::invisible
    end
    
    %% Connect manual HR to system start
    HR_Prepare --> SUB
    
    %% Styling for clarity
    classDef ministryHR fill:#f8f9fa,stroke:#6c757d,color:#212529;
    classDef opsc fill:#d4edda,stroke:#28a745,color:#155724;
    classDef commission fill:#f8d7da,stroke:#dc3545,color:#721c24;
    classDef invisible fill:#00000000,stroke:#00000000;
    
    %% Apply styling
    class HR_Prepare ministryHR;
    class SUB,REG,MCR,UA,RFC,ALA,FTC,CS,APP,REJ,MA,DHR,MDS,DEA,UI,IR,DecisionOutcome opsc;
    class DecisionOutcome invisible;
```