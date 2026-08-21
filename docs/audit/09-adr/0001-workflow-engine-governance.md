# ADR 0001: Workflow Engine Governance

## Context

`transitions.py` encodes the submission-lifecycle state machine as three declarative stage graphs plus a substantial layer of imperative, role-specific conditional logic — roughly two-thirds of the file's 916 lines is the latter. Role-scoped permission is additionally duplicated a third time in `views.py`'s `transition()` action (unit-routing and assignment gates), with source comments explicitly acknowledging this as a manually-maintained invariant. The audit brief asked us to assess the case for a declarative, DB/config-driven workflow engine PSC could amend without a code release.

## Decision

**Do not build a full transition-graph editor now.** Instead:
1. Expand what's already config-driven — SLA/deadline day-counts (`CHECKLIST_REVIEW_SLA_DAYS`, `PSC_REGISTRATION_SLA_DAYS`) and the holiday calendar (`PublicHoliday` model) — to cover the stages currently missing SLA fields (P2-08).
2. Consolidate the three copies of role/routing logic (`transitions.py`'s allow-sets, `transitions.py`'s imperative branches, `views.py`'s duplicated unit-routing gate) into a single source of truth within `transitions.py`, removing `views.py`'s independent copy. This is a code-quality fix, not a new subsystem.
3. Revisit a full config-driven engine only if/when PSC's own process-amendment frequency demonstrably outpaces the team's release cadence — not speculatively.

## Consequences

- The core, legally-significant transition graph stays code-reviewed and deploy-gated — appropriate for a system whose incorrect transition is (per the audit brief's own framing) a legal irregularity.
- PSC staff still cannot self-serve most process changes; a genuine SOP amendment requires a development cycle. This is an accepted trade-off given the team's size and the risk profile of getting a workflow-editor's governance model wrong (see Alternatives).
- Consolidating the three copies of role logic reduces (but does not eliminate) the drift risk the current duplication carries.

## Alternatives considered

- **Full DB-driven transition editor with an admin UI.** Rejected for now: the existing precedent for editing a governance-sensitive DB object (`RoleDefinitionViewSet`) has no maker-checker/second-approval step, and the audit found (P1-09) that this exact tool already gives administrators an incorrect impression of the control they actually have. Building a second, more consequential instance of the same governance gap would compound the risk rather than reduce it. If revisited, it must ship with a proper approval workflow, not reuse the current pattern.
- **A small rules-DSL specifically for the role/routing conditionals**, leaving the core stage graph as-is. Deferred — real engineering investment, revisit if the consolidation in Decision #2 proves insufficient to stop drift.
