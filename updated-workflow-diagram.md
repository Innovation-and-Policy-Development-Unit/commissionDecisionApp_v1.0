```mermaid
flowchart LR
    %% === MINISTRY HR (MANUAL PREPARATION) ===
    subgraph MinistryHR["Ministry HR (Manual)"]
        direction TB
        HR_Prepare["HR prepares & scans documents<br/>(manual process)"]
    end
    
    %% === OPSC PROCESSING (END-TO-END SYSTEM) ===
    subgraph OPSC["OPSC Processing<br/>(Complete System Workflow)"]
        direction TB
        %% Submission intake
        SUB["Submit to PSC<br/>(Submitted)"] --> REG["Register & Route<br/>(Registered and Routed)"]
        REG --> MCR["Manager Checklist Review<br/>(Manager Checklist Review)"]
        MCR --> UA["Under Assessment<br/>(Under Assessment)"]
        
        %% Assessment handling
        UA -->|Clarification needed| RFC["Returned for<br>Clarification<br/>(Returned for Clarification)"]
        RFC --> SUB
        UA -->|Legal advice| ALA["Awaiting Legal<br>Advice<br/>(Awaiting Legal Advice)"]
        ALA --> UA
        
        %% Commission interaction (OPSC manages this)
        UA --> FWD["Forward to<br>Commission<br/>(Forwarded to Commission)"]
        FWD --> CS["Commission<br>Sitting<br/>(Commission Sitting)"]
        
        %% Commission returns decision to OPSC
        CS -->|Decision:&nbsp;Approve/Reject/Defer/MA| DECISION["Decision<br>Received by OPSC"]
        
        %% Decision processing
        DECISION --> APP["Approved<br/>(Approved)"]
        DECISION --> REJ["Rejected<br/>(Rejected)"]
        DECISION --> MA["Matters<br>Arising<br/>(Matters Arising)"]
        DECISION --> DHR["Deferred Back<br>to HR<br/>(Deferred Back to HR)"]
        
        %% Deferral handling (OPSC managed)
        DHR -->|Full process| SUB
        DHR -->|Shortcut| MA
        MA --> CS
        
        %% Post-decision processing (OPSC handled)
        APP --> MDS["Minutes Drafted<br>& Signed<br/>(Minutes Drafted and Signed)"]
        REJ --> MDS
        MDS --> DEA["Decision Entered<br>& Assigned<br/>(Decision Entered and Assigned)"]
        DEA --> UI["Under<br>Implementation<br/>(Under Implementation)"]
        UI --> IR["Implementation<br>Report<br/>(Implementation Report)"]
    end
    
    %% === COMMISSION (DELIBERATION ONLY) ===
    subgraph Commission["Commission<br/>(Deliberation Function Only)"]
        direction TB
        CS -->|Deliberates| DELIB[Deliberation<br>Process]
        DELIB -->|Returns decision| CS
    end
    
    %% === ROLE ASSIGNMENTS ===
    %% Ministry HR Roles
    HR_Prepare -->|Ministry HR Officer<br/>(Ministry HR)| MinistryHR
    
    %% OPSC Roles
    SUB -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    REG -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    MCR -->|HR Unit Manager<br/>(HR Unit Manager)| OPSC
    UA -->|PSC Officer<br/>(PSC Officer)| OPSC
    RFC -->|HR Unit Manager<br/>(HR Unit Manager)| OPSC
    ALA -->|PSC Officer<br/>(PSC Officer)| OPSC
    FWD -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    CS -->|Commissioner/Chairperson<br/>(PSC Commissioner/Chairperson)| Commission
    DECISION -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    APP -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    REJ -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    MA -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    DHR -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    MDS -->|Senior Admin Officer<br/>(Senior Admin Officer)| OPSC
    DEA -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    UI -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    IR -->|PSC Officer/Admin<br/>(PSC Officer/Admin)| OPSC
    
    %% === CONNECTIONS ===
    %% Manual HR feeds into system
    HR_Prepare --> SUB
    
    %% === STYLING ===
    classDef ministryHR fill:#f8f9fa,stroke:#6c757d,color:#212529;
    classDef opsc fill:#d4edda,stroke:#28a745,color:#155724;
    classDef commission fill:#f8d7da,stroke:#dc3545,color:#721c24;
    classDef roleLabel fill:#fff3cd,stroke:#ffc107,color:#856404,font-size:10px;
    
    class HR_Prepare ministryHR;
    class SUB,REG,MCR,UA,RFC,ALA,FWD,CS,DECISION,APP,REJ,MA,DHR,MDS,DEA,UI,IR opsc;
    class DELIB commission;
    
    %% Style role labels
    classDef roleText fill:#fff,stroke:#333,color:#000,font-size:9px;