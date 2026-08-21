# SCDMS Pre-Production Readiness Review — Executive Summary

**For:** PSC Chairperson, IPDU Manager
**Date:** 21 August 2026

---

## Is SCDMS fit to carry statutory decisions today?

**Not yet.** SCDMS is a genuinely capable, thoughtfully-built system — the submission-to-decision workflow, the Commission minutes process, and the ODU/IPDU board-paper pipelines are well modeled and match how the Commission actually works. But this review found **five issues serious enough that they must be fixed before the system carries real, legally-reviewable personnel decisions**, plus a further set that will cause real friction for staff if left unaddressed.

None of these five require rebuilding the system. All are fixable in weeks, not months, by the two-person nature of the current build team — but they need to be prioritized ahead of any further feature work.

## The three things that must be fixed before production

**1. Confidential documents can currently be downloaded by anyone who obtains a link — no login required.**
The web server that delivers uploaded documents (personnel files, disciplinary evidence, board papers) does not check who's asking. The system's own permission rules — which correctly restrict a Ministry HR officer to their own ministry's files — are bypassed entirely at this layer. This is the single most urgent item in the review.

**2. There is a working "restore the whole database" function that will accept and load an unverified file from anyone with admin rights.**
A compromised admin account (or one whose login token is stolen — see item 3) can overwrite the entire database, including the audit trail itself, with no confirmation step. This needs a safety catch before go-live.

**3. Login sessions are stored in a way that any successful web-based attack on the site can steal, and a password change does not undo a stolen session.**
This is a standard technical risk in modern web apps, but combined with items 1 and 2 it raises the stakes materially — it's the path by which a smaller vulnerability becomes the bigger ones above. Recommended fix is a standard hardening (moving session tokens out of reach of page scripts).

A further two items belong in this same "before go-live" bucket for different reasons: a hardcoded fallback security key sitting in the source code (needs a one-line fix and a check that the live server isn't actually depending on it), and confirmation that internal correspondence — including one document naming a specific official by name and title, and a commercial pricing quotation — currently sits in the project's version-control history. We have not touched this per your instruction; it's flagged for your records/legal team to decide how to handle.

## What else is worth knowing, in plain terms

- **The Commission has no way to enforce quorum or handle a Commissioner's conflict of interest today** — the system doesn't have a field for either. For a statutory decision-making body, this is a due-process gap worth closing before the system is the system of record.
- **Personnel and disciplinary information is sent to a third-party AI service (Google Gemini) automatically, by default, with nothing stripped out first**, whenever a document is processed or certain drafting features are used. This is a policy decision as much as a technical one — the review lays out what redaction and consent controls would look like.
- **A performance problem you already asked us to fix once has come back in new code.** Two days after fixing "submitting a form is slow because it waits for an email to send," the exact same pattern was reintroduced in the new Minutes approval feature, and turned up in several older corners of the system too. We found where it's hiding (a background trigger invisible in the obvious places) and have proposed both the fix and a way to stop it recurring silently a third time.
- **There is currently no automated testing on the frontend at all, and nothing that runs tests automatically before code ships.** This matters because the findings above — and any future ones like them — currently rely entirely on someone remembering to check by hand.
- **Multi-page forms can lose a user's work if their session times out mid-fill** — a real risk given intermittent connectivity to outer islands, not a hypothetical one.

## What full remediation costs, roughly

- **The five before-production items:** approximately **2–3 weeks** of focused engineering time, achievable by the existing team without new hires, if prioritized ahead of feature work.
- **The next tier** (quorum/recusal, AI data governance, retention scheduling, restoring test coverage, the RBAC gaps documented in the findings register): a further **2–3 months**, sequenced in the accompanying roadmap.
- **Longer-term architectural health** (breaking up the three largest files, a real CI pipeline, offline-tolerant capture for outer islands): a multi-quarter program, not a blocker to going live, detailed in `07-enhancement-roadmap.md`.

## How to read the rest of this review

This summary is deliberately short. The full findings — every one backed by an exact file and line reference, not a general impression — are in `01-findings-register.md`. Technical leads should start there and in `05-security-assessment.md` and `06-performance-and-responsiveness.md`. A phased plan sequencing everything above is in `07-enhancement-roadmap.md`. A short list of decisions only PSC/OPSC leadership can make — including the quorum rule, the AI data-sovereignty policy, and the git-history question — is in `10-open-questions.md`.
