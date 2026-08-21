# ADR 0003: Token Storage Strategy

## Context

Access and refresh JWTs are currently stored in `localStorage` (`frontend/src/api/client.js`, `AuthContext.jsx`), readable by any JavaScript executing in the page's origin. Any XSS anywhere in the SPA is therefore a full-session-takeover primitive, with impact amplified by the system holding statutory personnel data and (per P0-02) a backup-restore capability reachable by a compromised privileged account.

## Decision

Migrate to `httpOnly` + `Secure` + `SameSite=Strict` cookies for both access and refresh tokens, with CSRF double-submit-token protection for state-changing requests (Django already ships CSRF middleware; this extends its use to the JWT-cookie flow rather than the current header-based bearer-token pattern).

## Consequences

- Removes the localStorage-XSS exfiltration path entirely — a JS-executing attacker can no longer read the token value directly.
- Does **not** eliminate XSS risk generally — a live XSS payload can still make authenticated requests *as* the victim while they're on the page (cookies are sent automatically), so this is a materially better posture, not a complete XSS mitigation. The CSP hardening in P1-02 (removing `unsafe-inline`) remains necessary as a complementary control, not a substitute.
- This is an **L-effort, cross-cutting change** touching the entire auth flow (`client.js` interceptor, `AuthContext`, the login/lock/PIN-setup pages built this session, and the backend's token-issuing views). Recommend sequencing as its own dedicated work item with a feature-flag or parallel-path rollout, not a single big-bang cutover, given how much of the app's auth surface changed in the most recent development cycle.
- Requires `SameSite=Strict` cookie compatibility verification against the actual deployment topology (Cloudflare Tunnel + nginx) before committing to the approach.

## Alternatives considered

- **Keep `localStorage`, rely entirely on CSP hardening (P1-02) as the compensating control.** Rejected as insufficient on its own — CSP reduces the *likelihood* of a successful XSS, but does nothing to reduce the *impact* if one occurs regardless (a new third-party dependency, a missed sanitization case, etc.). Given the sensitivity of the data in scope, defense-in-depth via cookie storage is warranted even with a strong CSP.
- **Short-lived access tokens with very aggressive rotation as a partial mitigation, keeping localStorage.** Rejected — reduces the *window* of a stolen-token attack but not the fact that the theft is trivial to begin with; adds operational complexity (more frequent refresh traffic) without addressing the root cause.
