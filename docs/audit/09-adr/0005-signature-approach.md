# ADR 0005: Digital Signature Approach

## Context

`DocumentSignature` and `FlyingMinuteSignature` capture a rasterized image (a picture of a signature) plus metadata (signer identity, IP, auth method, trusted-session linkage, server timestamp) — evidentially useful but not cryptographically binding. The system's own code comments already describe this as an interim measure pending Vanuatu digital-signature legislation, consistent with the Minutes-workflow's manual wet-ink-scan process built this session.

## Decision

**Maintain the current interim approach** (rasterized signature + rich provenance metadata) as the correct choice for now, given digital signatures are not yet legally recognized in Vanuatu per the codebase's own operating assumption. Two near-term, low-cost improvements that don't require waiting for legislation:

1. **Add RFC 3161 trusted timestamping** to the signature-capture flow — cheap to add, strengthens the evidential record (an independent, verifiable timestamp) without requiring any change to the underlying legal recognition question.
2. **Close the audit-log integrity gap first (P1-08, ADR-adjacent).** The evidential value of the current metadata-rich approach is undermined if the supporting `AuditLog`/provenance records aren't themselves tamper-evident — fixing that is a higher-leverage near-term investment than jumping to a cryptographic signature scheme the law doesn't yet recognize.

## Consequences

- The system remains dependent on operational (not cryptographic) controls for signature evidential weight until Vanuatu's legal framework changes — an accepted, deliberate limitation, not an oversight.
- When digital-signature legislation is enacted, the existing PIN-confirmed in-app `sign` action (already built, parallel to the wet-ink upload path) is positioned to become the primary path with comparatively modest additional work — the interim design was built with this transition in mind.

## Alternatives considered

- **Build a full PAdES/PKI signing system now, ahead of legal recognition.** Rejected — significant engineering investment (certificate authority integration, key custody, HSM or equivalent) for a signature type that would not yet carry the legal weight of the current wet-ink process it's meant to support. Revisit once legislation is confirmed (see Open Questions).
- **Do nothing until legislation changes.** Rejected — the RFC 3161 timestamping and audit-log hardening improvements are valuable regardless of the legal-recognition timeline and are cheap enough not to defer.
