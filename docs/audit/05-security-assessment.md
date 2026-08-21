# Security Assessment — OWASP ASVS L2 Mapping

Scope: `/opt/scdms`, Django 6.0/DRF backend + React frontend. All citations are exact `file:line`. The two headline findings (P0-01, P0-02) were independently re-verified by the report author directly against the source, not taken solely on the research pass's word.

---

## Summary table

| Finding | ASVS area | Verdict |
|---|---|---|
| JWT storage in `localStorage` | V3.2, V8.1 | **Fails** |
| CSP: SPA shell allows `unsafe-inline` | V14.4 | **Weakened** |
| RBAC — submission/document API endpoints | V4.1-V4.3 | **Passes** |
| RBAC — media file serving | V4.1, V4.3 | **Fails** (P0-01) |
| RBAC — checklist sub-resource | V4.2 | **Fails** (P1-03) |
| RBAC — submission SLA endpoint | V4.2 | **Fails** (P1-04) |
| Audit log integrity | V7.4/V1.7 | **Fails** (P1-08) |
| Signature capture (non-repudiation) | V8 | Weak, no cryptographic binding |
| Backup restore endpoint | V13.1/V13.2, V12.1 | **Fails** (P0-02) |
| File upload pipeline | V12.1, V12.3, V12.4/5 | **Fails** (P1-06) |
| AI/Gemini data flow | V8.1/V8.2 | **Fails** (P1-07) |
| Secrets management | V14.2/V6.4 | **Fails** (P0-03) |
| CORS | V14.5 | **Passes** |
| HSTS | V14.4 | Strong in Django, but nginx's own header is commented out pending TLS |
| Rate limiting / throttling | V4.4/V11.1 | Good coverage on sensitive flows; login docstring overstates what's implemented |
| Session fixation (password change) | V3.3 | **Fails** (P1-05) |
| `TrustedSession` expiry logic | V3.2/V3.3 | **Correct** |

---

## 1. JWT storage (P1-01)

Both access and refresh tokens live in `localStorage`:
- `frontend/src/api/client.js:25-26,41-45,96-102`
- `frontend/src/context/AuthContext.jsx:11,65-66,206-207`

Any XSS anywhere in the SPA origin can read both tokens directly — there are no `HttpOnly`/`SameSite` cookie protections to bypass because these aren't cookies. `ROTATE_REFRESH_TOKENS=True` (`backend/config/settings.py:247`) means a **live** injected script (not just a one-shot theft) can keep riding the rotation chain, limited only by `BLACKLIST_AFTER_ROTATION` racing the legitimate user's own next refresh. A one-shot theft of just the refresh token is valid for up to `JWT_REFRESH_DAYS` (default 7 days, `settings.py:245`).

**Recommendation:** migrate to `httpOnly` + `Secure` + `SameSite=Strict` cookies with CSRF double-submit token, the standard mitigation for exactly this threat model. This is an L-effort change touching the whole auth flow — sequence it deliberately (see ADR `09-adr/`).

## 2. Content-Security-Policy inconsistency (P1-02)

Two independent CSP implementations exist and disagree:
- Django middleware (`backend/tracker/middleware.py:14-25`): `script-src 'self'` — no inline scripts.
- nginx (`frontend/nginx-docker.conf:55,69`, `frontend/app-locations.conf:34`): `script-src 'self' 'unsafe-inline'` — **verified directly**, allows inline scripts.

Because nginx serves the SPA shell and static JS bundle directly (Django's stricter header only reaches `/api/*` responses), the policy that actually matters for mitigating an XSS payload rendered into application HTML is the **weaker** one. Given P1-01's storage choice, this meaningfully reduces CSP's practical value as a compensating control.

**Recommendation:** remove `unsafe-inline` from the nginx policy; audit for any inline-script dependency first (S effort for the config change, M for the audit).

## 3. Object-level authorization (RBAC / IDOR)

**What's protected, verified by tracing the actual query path:**
- `SubmissionViewSet.get_queryset()` (`views.py:1053-1054`) → `_submission_queryset_for()` (`views.py:273-387`) applies per-role `.filter()` — ministry, department, `assigned_to`, `routed_unit`, `is_internal` — **before** DRF's `get_object()` does its PK lookup. A request for an out-of-scope submission genuinely 404s; this is query-level scoping, not fetch-then-check.
- Document download (`views.py:3928-3999`) correctly inherits the same scoped `get_object()` and re-scopes the document lookup to the already-authorized submission.

**What isn't protected:**
- **Media file serving (P0-01)** — see the dedicated write-up below; this is the most severe finding in the review and bypasses everything above.
- **Checklist sub-resource (P1-03)** — `views.py:13550-13556` fetches `Submission` by raw, unscoped PK; `partial_update()` (`views.py:13613-13645`) only re-checks `assigned_to` for manager roles, never principal/senior roles, never `routed_unit`. 9 unit roles can cross-unit read/write.
- **Submission SLA endpoint (P1-04)** — `views.py:11935`, `IsAuthenticated` only, no scoping at all. Any authenticated user of any role can query any submission's timing data by ID.

## 4. Media file serving — P0-01, verified directly

```nginx
# frontend/nginx-docker.conf:131-134 (identical in app-locations.conf:93-96)
location ^~ /media/ {
    alias /var/scdms/media/;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Cache-Control "private, max-age=3600";
}
```

No `auth_request`, no proxy to Django, no `secure_link` module — a plain static file alias. Storage path is predictable: `submission_documents/<sequential-submission-id>/<original-filename>` (`backend/tracker/models.py:2085-2086`), and filenames are frequently the standard templated names the organisation already uses (`TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/` in the repo root gives a strong hint at the naming conventions an attacker would guess against).

**Every RBAC control described in §3 is irrelevant to this path.** Anyone who obtains, guesses, or enumerates a URL retrieves the file directly, with no authentication step of any kind.

**Recommendation:** route media through Django with `X-Accel-Redirect` (nginx serves the bytes, but only after Django's view has re-run the exact same `_submission_queryset_for()` scoping check and told nginx "yes, serve this"), or move to short-lived signed URLs if storage moves off local disk in future. This is the review's top-priority fix.

## 5. Backup / restore — P0-02, verified directly

`backend/tracker/views.py:9442-9494` (`BackupViewSet.restore`):

```python
if uploaded:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
        for chunk in uploaded.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name
    restore_path = tmp_path
    ...
try:
    call_command("loaddata", restore_path)
```

Confirmed by direct read: **no schema validation, no checksum, no verification that the uploaded content resembles a backup this system produced.** The file is always suffixed `.json` regardless of actual content. `loaddata` deserializes and writes arbitrary model rows — including `User`, `RoleDefinition`, and `AuditLog` itself — based purely on file content.

Gated by `HasManageRoles` (`views.py:9356`) — reasonable in isolation, but combined with P1-01 (any `manage_roles` account's session is stealable via XSS) and no dedicated rate limit (falls to the generic 600/min, `views.py` has no `throttle_classes` override), this is close to an unauthenticated arbitrary-write primitive under realistic attack chains.

**Recommendation:** require the uploaded file's checksum/signature to match a manifest this system itself generated at backup time; treat arbitrary-upload restore as a break-glass, out-of-band operation (CLI on the host, not a web endpoint) rather than a normal admin API action. Add a confirmation step and a dedicated tight throttle regardless.

## 6. Audit log integrity (P1-08)

`AuditLog`'s own docstring claims *"Tamper-evident record of every significant system action"* (`models.py:1298-1299`), but the field list (`models.py:1322-1335`) has no hash-chain, signature, or prior-record digest of any kind. Write path (`audit.py:71-83`) is a plain ORM `.save()`. No DB-level `REVOKE UPDATE, DELETE` grant exists (checked across all migrations — no `RunSQL` hardening found). `purge_expired_data.py:49-54` deletes rows via a standard `QuerySet.delete()` call, and that deletion is itself unaudited.

"Append-only" is a convention every code path happens to follow, not an enforced property. A compromised app server (the exact access P0-02 could grant) has unrestricted rewrite access to history.

**Recommendation:** hash-chain each row on write (`sha256(prev_hash + row_content)`, verifiable independently); add a DB-level grant restricting `UPDATE`/`DELETE` on the audit table to a separate, rarely-used privileged role.

## 7. Signature capture — evidential weight

`DocumentSignature` (`models.py:2278-2311`) stores a rasterized PNG (`snapshot` ImageField) composited onto the document page — a picture of a signature, not a cryptographic one. Supporting metadata is genuinely useful for an evidential argument: `signed_by`, `signed_ip`, `auth_method` (totp/pin/password_only/push_demo), `trusted_session` linkage, and server `created_at`. `FlyingMinuteSignature` (`models.py:1072-1106`) follows the same pattern for out-of-session decisions and explicitly cites "SOP Section 8" — built against a documented procedure.

What's missing for genuine non-repudiation: no PAdES/CMS signature, no PKI, no RFC 3161 trusted timestamping, no hardware-backed key. `signed_date` is self-entered by the signer, not server-verified. Because the supporting audit trail is itself not tamper-evident (§6), the "legal defensibility" the codebase's own comments aspire to rests entirely on operational DB-access controls, not any cryptographic guarantee.

**Recommendation:** this is a genuinely hard problem given Vanuatu's legal framework doesn't yet recognize digital signatures (per the system's own interim-process comments) — see ADR on signature approach. Near-term: strengthen the metadata capture (RFC 3161 timestamp at minimum, cheap and doesn't require legal recognition to be useful evidentially) without waiting for the larger PKI question to resolve.

## 8. File upload pipeline (P1-06)

- Size limit present and consistent between app and nginx (50MB, `views.py:3716`, `nginx-docker.conf:112`).
- MIME validation: **absent** on the general upload path (`views.py:3719-3826`); extension-string-only on one narrower path (`views.py:2837`, trivially bypassed by renaming); client-supplied `Content-Type` header trusted (attacker-controlled) on a third path (`views.py:3842`). No content-sniffing library anywhere in the codebase.
- No malware scanning anywhere.
- Files are stored inside `MEDIA_ROOT`, the same directory P0-01 shows is served unauthenticated — there is no "private storage + authenticated proxy" layer at all in the current topology.
- Download URLs are unsigned, non-expiring, and directly guessable (`media_urls.py:28-48`).

**Recommendation:** add content-sniffing validation, integrate malware scanning ahead of the OCR/AI queue, and resolve P0-01 as a structural prerequisite — none of this matters if the files are reachable unauthenticated regardless.

## 9. AI data flow to Gemini (P1-07)

Every AI feature fires automatically — no `AI_FEATURES_ENABLED`/consent flag exists anywhere. Document OCR/classification is queued unconditionally on every upload (`views.py:3803-3806`, `2851-2854`).

Representative payload content, confirmed by reading the actual prompts:
- `ai/document_extraction.py:24-87,248` — when local OCR is unavailable, up to 5 pages of the **actual uploaded document** are rasterized and sent as images to Gemini's vision API; the system prompt explicitly instructs extraction of names, dates, positions, and statements.
- `ai/B5_notice_of_allegation.py:68-85`, `B2_risk_assessment.py:102`, `B3_recommended_outcome.py:98` — discipline-adjacent drafting/assessment features send full submission content (expected to include officer identity and factual allegations) verbatim.

No redaction step exists anywhere in this pipeline. `AIGenerationLog` (`models.py:1350-1386`) records that a call happened, with what latency and outcome — never what was actually sent; its own docstring confirms it's "reliability telemetry... not a record of a user action."

**Conclusion:** Vanuatu personnel and disciplinary data, including raw scanned document images, leaves the country by default on ordinary use of the system, with no consent gate, no redaction, and no way to reconstruct after the fact exactly what was transmitted for any given call.

**Recommendation:** see ADR (AI processing location). Near-term, lower-cost step: extend `AIGenerationLog` to capture a hash of the transmitted payload (cheap, doesn't require a redaction engine to be useful for audit) while the larger redaction/opt-in/self-hosted-model questions are worked through with leadership (see Open Questions).

## 10. Standard checks

**Secrets (P0-03):** `backend/config/settings.py:25-28` — hardcoded `SECRET_KEY` fallback, confirmed present in current source by two independent research passes. `.env` itself is correctly git-ignored and no real secret was found recoverable from git history (full-history regex scan, `git log --all -p` — see `04-architecture-and-standards.md` for the scan methodology). The fallback is the live risk, not a historical leak.

**CORS:** sound. `CORS_ALLOWED_ORIGINS` (`settings.py:396-403`) is an explicit allowlist built from env vars, never wildcarded; `CSRF_TRUSTED_ORIGINS` mirrors it. No code-level flaw found.

**HSTS:** Django's defaults are strong (1-year, subdomains, preload, SSL-redirect all on by default — `settings.py:281-284`), gated correctly on proxy detection. However nginx's own HSTS header is explicitly commented out pending "TLS is live" (`frontend/nginx-docker.conf:36-37`) — a manual step that should be **live-verified against actual production response headers**, not assumed from the config alone.

**Throttling:** good dedicated coverage for OTP, password reset, PIN verification, AI-trigger, and submission-create actions (`settings.py:207-224`, plus dedicated throttle classes bound at their respective views). One documentation/implementation mismatch: `TokenObtainPairView`'s docstring claims a 5/min throttle (`views.py:6804-6809`) that isn't actually configured — real brute-force protection for login comes from django-axes instead, which is a reasonable substitute but not what the comment describes.

**Session fixation (P1-05):** `change_password_view` (`views.py:5485-5552`) never blacklists outstanding tokens, unlike the explicit logout path which does (`views.py:7060`). A stolen token survives the user's own remediation attempt.

**`TrustedSession.compute_expiry()` (models.py:1041-1056):** logic traced line-by-line — "earlier of +`SESSION_TRUST_HOURS` or 5pm same calendar day, falling back to just the flat window if already past 5pm" is correct and internally consistent. `Pacific/Efate` is a valid IANA zone, observes no DST (so the DST-edge-case concern in the original brief doesn't apply here), and is used consistently everywhere timezone-sensitive logic touches this feature. **No bug found in this specific mechanism.**
