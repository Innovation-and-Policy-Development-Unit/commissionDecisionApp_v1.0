# ADR 0004: AI Processing Location and Data Governance

## Context

Every AI feature in SCDMS calls Google's Gemini API automatically, with no consent gate, no redaction step, and (via the vision-OCR fallback) can transmit raw images of uploaded personnel/disciplinary documents. `AIGenerationLog` records that a call happened but never what was sent, so there is currently no way to reconstruct after the fact exactly what data left Vanuatu for any given call. This is a governance decision as much as a technical one, and the audit brief is explicit that it must not be decided unilaterally by this review.

## Decision

**This ADR does not resolve the question — it frames the options for a leadership decision** (see `10-open-questions.md` for the specific question to route to the appropriate stakeholder). Recommended interim technical step, regardless of which policy direction is chosen: extend `AIGenerationLog` to capture a hash (not the raw content, to avoid duplicating the exposure in a second location) of every transmitted payload, so a future audit can at least verify *what class* of data was sent for a given call without needing the policy question resolved first.

## Options for leadership to weigh

1. **Status quo, with disclosure.** Continue using Gemini, but document the practice explicitly (a privacy notice, an internal policy record) rather than leaving it as an undocumented default. Lowest effort, does not reduce the underlying exposure.
2. **Opt-in + redaction.** Require an explicit per-feature toggle before any AI call fires, and strip/mask personnel names and identifying details from prompts before transmission where the feature's value doesn't depend on seeing them (e.g. summarization features may not need a real name to be useful; drafting features like the Notice of Allegation likely do). Medium effort, meaningfully reduces exposure while keeping the Gemini-quality AI features.
3. **Self-hosted model for the highest-sensitivity features specifically** (discipline-adjacent drafting/assessment — `B2_risk_assessment.py`, `B3_recommended_outcome.py`, `B5_notice_of_allegation.py`), keeping Gemini for lower-sensitivity features (general summarization, non-personnel search). Highest effort and infrastructure cost, but resolves the data-sovereignty question entirely for the features where it matters most.

## Consequences (of not deciding)

Every day this remains undecided, ordinary use of the system continues sending Vanuatu personnel and disciplinary data to a foreign jurisdiction with no audit trail of content. The interim hashing step (Decision) is a stopgap that improves auditability without resolving the underlying policy question — it should not be treated as a substitute for the leadership decision.

## Alternatives considered

Not applicable in the usual ADR sense — this document exists specifically to surface the options rather than pick one, per the audit's explicit instruction not to make this call unilaterally.
