# Performance & Responsiveness — Blocking I/O Sweep

This is the priority workstream per the audit brief. Governing rule applied throughout: *a user-facing request should perform only the work required to durably record the user's intent and return a correct answer — everything else belongs after the response, on a queue.*

---

## "Recently fixed, verify it stayed fixed"

**The original defect:** submitting a form (any workflow transition) waited synchronously on the Resend transactional-email API — measured at ~1.2–1.5s per recipient — before the request returned. Fixed in commit `0466493` ("Move workflow/assignment emails off the request path onto Celery"), Aug 19, adding four `@shared_task`/`queue_*` pairs in `tasks.py` and a new test file, `test_async_notification_tasks.py`.

**Is the fixed path still fixed?** Yes — `queue_transition_emails` and its three siblings still call `.delay()`, and their production callers in `views.py`'s `transition()` action are wrapped in `transaction.on_commit()` (`views.py:2189-2193`). No regression found in the four originally-fixed call sites.

**Does a test now prevent its return?** `test_async_notification_tasks.py` verifies the *task bodies* produce correct emails and that the `.delay()`-fails fallback works — it does **not** assert that a submission-transition POST makes zero outbound HTTP calls, which is the actual regression-proof property that matters (see the Guardrail Plan below). So: partially. The specific 4 call sites the fix targeted are covered by intent; the pattern itself has no test that would catch a fifth instance appearing.

**Was the fix systemic?** No. It was a targeted patch to the 4 call sites the slow-request reports named. **At least 9 other request-path call sites doing synchronous outbound email remain**, three of them added or reintroduced in the 48 hours *after* the fix shipped — including in code from this same audit's own review period. This is the headline finding of this workstream (P0-04, P1-15 in the findings register).

---

## A. Full outbound-call inventory

| # | Site | Context | Classification |
|---|---|---|---|
| 1 | `media_access.py:72` | Celery-only (OCR/vision fetch) | SAFE |
| 2 | `resend_backend.py:144` | Transitively via every `send_mail()` | Depends on caller |
| 3 | `email_backend.py:153/155` | SMTP send | Depends on caller |
| 4 | `views.py:8975` | `AISettingsViewSet.test_gemini`, admin diagnostic | BLOCKING (low traffic) |
| 5 | `views.py:6035` | `ai_smart_report_view`, waits on full LLM completion in-request | **BLOCKING** |
| 6 | `ai/whisper_client.py:39` | Celery-only | SAFE |
| 7 | `decision_service.py:172/202` | `serve_decision`/`acknowledge_service`, called directly from `views.py:4155,4211` | **BLOCKING** |
| 8 | `email_notify.py:342-389` | `send_password_reset_email`, called from `views.py:7370` — **unauthenticated, public endpoint** | **BLOCKING** |
| 9 | `deadline_reminder_views.py:71` | Direct `@action POST` | **BLOCKING** |
| 10-11 | `views.py:9033,9257` | Admin "send test" diagnostics | BLOCKING (low traffic) |
| 12 | `views.py:6428` | `UserViewSet.create()`, onboarding email inline in `POST /users/` | **BLOCKING** |
| 13 | `rules/engine.py:104` | `rules_run_now`, one email per recipient per flag, unbounded | **BLOCKING — bulk fan-out** |
| 14 | `rules/engine.py:201` | `maybe_send_digest`, not directly view-reachable as written | Low risk |
| 15 | `automation/engine.py:82` via `signals.py:52` | `post_save` on Submission/CommissionTask/Meeting — fires on every save, **including inside `transition()`'s open transaction** | **BLOCKING — most severe (P0-04)** |
| 16 | `automation/engine.py:82` via `automation_views.py:184` | `automation_run_now`, admin "run now" | **BLOCKING** |
| 17 | `intelligence/reports.py:140` | `intelligence_report_run`, runs an analytics query then emails synchronously | **BLOCKING** |
| 18 | `email_notify.py:624-626` via `views.py:8309` | `notify_agenda_circulated` — loops every Commissioner + Chairperson with a PDF attachment | **BLOCKING — confirmed live recurrence of the fixed pattern** |

**Callout — finding #15 (signal-hidden, worst-case):** `signals.py:57-101` wires `post_save` for `Submission`/`CommissionTask`/`Meeting` to the automation engine, synchronously, wrapped only in a savepoint (`transaction.atomic()` at `signals.py:50`) — not `on_commit`, not `.delay()`. Because `transition()` calls `submission.save()` at `views.py:2127`, *inside its own open `transaction.atomic()` block* (`views.py:2014-2177`), a matching `Automation` rule's email send now executes **while database row locks are held**. This is invisible from reading `views.py` alone — exactly the kind of hiding place the audit brief anticipated — and is strictly worse than the original bug: a slow provider here doesn't just delay one response, it holds locks that block *other* requests too.

**Callout — finding #18:** the sibling task `notify_meeting_scheduled_task`'s own docstring states its async design exists "so the create request never blocks on potentially many ministry-HR recipients." That reasoning was written down by the team and then not applied to `notify_agenda_circulated`, which loops over every Commissioner and Chairperson with the exact same shape.

## B. Timeouts and retries

| Call | Timeout? | Retry/backoff? |
|---|---|---|
| Resend SDK (`resend_backend.py:144`) | **None** | N/A (SDK-level) |
| Production SMTP (`DynamicEmailBackend`) | **None** — Django's default SMTP backend has `timeout=None` (blocks forever); only a diagnostic-only helper (`send_smtp_message`) sets `timeout=30` | N/A |
| Gemini (`ai/claude_client.py`, all call sites) | **None anywhere** | N/A |
| `email_dispatch` Celery tasks (`tasks.py:36,72,96,126`) | — | **None** — bare `@shared_task`, no `bind=True`/`max_retries`, unlike the AI-generation tasks in the same file which do have `bind=True, max_retries=3` |
| `media_access.py:72` | `timeout=120` | — |

A hung SMTP or Gemini call currently has no ceiling — a slow provider degrades into a hung worker (or hung request thread, for the synchronous sites) with no automatic recovery.

## C. Work that should be queued but isn't

- **WeasyPrint PDF generation inside a mutating request handler**: `views.py:10461-10490` (`MinutesViewSet.sign`, a `POST`) generates and persists a signed PDF as part of the signing action itself, extending that request's latency. (The two `GET`-only PDF-download actions are an acceptable pattern — the user is already waiting for a download.)
- **`serve_decision()`** (`views.py:4155-4202`): renders a PDF (`decision_service.py:87-111`) *and* loops recipients synchronously in the same request.
- **Bulk fan-out**: `notify_agenda_circulated` (all Commissioners+Chairperson), `rules_run_now` (one email per recipient per open flag, system-wide, unbounded), `automation_run_now` (per-match, per-action-recipient).
- **XML/JSON bulk form-field import**: searched exhaustively — **no such parser exists in the current codebase.** Treat as not applicable rather than a live finding.

## D. `transaction.on_commit` and enqueue safety

The `transition()` action itself is a model of correct usage: every `.delay()` call it makes (`queue_submission_brief`, `queue_submission_quality_score`, `_issue_letter`, `queue_clarification_bilingual`, `queue_transition_guidance`, `views.py:2198-2266`) is properly wrapped in `transaction.on_commit(...)`.

One misapplication found: `views.py:8309` wraps `_notify_circulated` (a **plain synchronous function call**, not a `.delay()`) in `transaction.on_commit`. This correctly avoids a pre-commit race, but `on_commit` only guarantees *ordering* relative to the transaction — it does nothing to move the work off the request thread. The actual problem (synchronous email inside the request) is untouched by this wrapping; it's a case of applying the right-looking pattern to the wrong problem.

Several other `.delay()` sites (`tasks.py:120,149`; `views.py:7547,7585,8024,10317,...`) are bare at the call site but land after their triggering `.save()` under Django's autocommit default, so risk is low in practice — just not defensively consistent with the pattern used in `transition()`.

## E. Database work in the request path

Sampled three high-traffic endpoints — **no N+1 problems found in any of them**:
- `dashboard_stats_view` / `system_stats_view` — aggregate-only (`.count()`/`Count()` annotations), cached (`api_cache`), no per-row serialization. Minor inefficiency: 7 separate `.count()` calls against the same base queryset that could collapse into one conditional-aggregate query — low severity given the cache layer.
- `SubmissionViewSet` list/detail — `_submission_queryset_for()` carries a comprehensive `select_related`/`prefetch_related` set that was cross-checked field-by-field against `SubmissionListSerializer` and covers every FK the serializer surfaces. Pagination `.count()` runs against the already-filtered queryset, not an unbounded scan.

Not exhaustively swept: `smart_report_views.py`, `report_template_views.py`, `intelligence_views.py`'s query/export views — flagged as a follow-up if a dedicated N+1 pass is wanted there.

## F. Transaction scope

`transition()`'s atomic block (`views.py:2014-2177`) contains DB writes only — no network calls in the visible code. But finding #15 (§A) means a real network call **does** execute inside it via the signal side-channel, which is invisible without reading `signals.py` alongside `views.py`. `endorse()` (`views.py:2271-2351`) has the same underlying issue and additionally dispatches notifications via a bare `try/except: pass` outside `on_commit`, inconsistent with `transition()`'s more defensive pattern.

## G. `email_backend.py` — confirmed uncached, per-send DB cost

`SystemSetting.get_val()` (`models.py:1177-1182`) is a plain, unmemoized `.objects.get(...)` per call. `_smtp_config_from_settings()` calls it 6 times; `DynamicEmailBackend` calls that resolver **twice** (once in `__init__`, once in `.open()`) — **up to 12 fresh, uncached database queries per single SMTP email sent.** This is SMTP-path-specific (Resend bypasses `SystemSetting` entirely, `resend_backend.py:16-17`), but SMTP is a live, supported configuration path, and this multiplies directly against every fan-out loop in §C that happens to be running on SMTP.

---

## Latency budget

Targets assume a user in Port Vila on a modest fixed/mobile connection (~30-80ms RTT to the server) and, separately, an outer-island user on a higher-latency/lower-bandwidth link (~150-400ms+ RTT, occasional loss). Current/estimated figures are derived from the request-path analysis above, not live profiling (no APM/tracing tool currently captures this — see P2-16) — treat as directionally accurate, not measured.

| Endpoint | Target p50 (Port Vila) | Target p50 (outer island) | Current (estimated) | Blocking work found | Fix |
|---|---|---|---|---|---|
| `POST /submissions/{id}/transition/` | &lt;400ms | &lt;1.2s | Variable — fast if no matching `Automation` rule fires; **1-2s+ if one does** (finding #15) | Automation-engine email inside open transaction | P0-04 |
| `POST /auth/token/` (login) | &lt;300ms | &lt;900ms | Fast — no blocking I/O found on this path | None found | — |
| `GET /submissions/` (log) | &lt;500ms | &lt;1.5s | Fast — well-optimized queryset, no N+1 | None found | — |
| `GET /submissions/{id}/` (bootstrap) | &lt;500ms | &lt;1.5s | Fast at the API layer; frontend fires a redundant 2nd call (P2-14) | Redundant round-trip, not backend-blocking | P2-14 |
| `POST /meetings/{id}/approve-agenda/` | &lt;500ms | &lt;1.5s | **Several seconds**, N = Commissioner count | Synchronous per-recipient email+PDF attachment | Apply `queue_*` pattern |
| `POST /minutes/{id}/sign/` | &lt;800ms (PDF gen is inherently non-trivial) | &lt;2.5s | Several hundred ms to seconds, WeasyPrint in-request | In-request PDF generation | Move PDF render to Celery, poll/webhook for completion |
| `POST /submissions/{id}/serve-decision/` | &lt;600ms | &lt;2s | Slow — PDF render + synchronous per-recipient email | Both C and A findings | Queue both |
| `POST /auth/password-reset/request/` | &lt;400ms | &lt;1.2s | Slow — synchronous send on an **unauthenticated** endpoint | Direct sync email call | Queue |
| `POST /minutes/{id}/submit-for-review/` (+ 4 sibling minutes actions) | &lt;400ms | &lt;1.2s | Slow — added post-fix, not yet queued | Direct sync email × 5 call sites | Apply `queue_*` pattern (P1-15) |
| `POST /users/` (admin create) | &lt;500ms | &lt;1.5s | Slow — onboarding email inline | Direct sync email | Queue |
| `GET /dashboard/` | &lt;400ms | &lt;1.2s | Fast — cached, aggregate-only | None found | — |

## How this class of regression gets caught next time

Four concrete guardrails, ordered by effort:

1. **A test asserting no outbound HTTP during a submission-transition POST (S effort).** Wrap the test client call in a context that fails if `smtplib`/`resend`/`httpx`/`requests`/the Gemini client are invoked synchronously — e.g. monkeypatch each at the test level to raise if called outside a Celery task context. This directly targets the exact regression class that recurred here, including the signal-hidden variant (a signal fires during the same test request, so it's caught the same way).
2. **Request-timing middleware with structured logs (S-M effort).** Log method, path, status, and wall-clock duration for every request; alert (even just a log-level threshold, appropriate for a small ops team) on anything crossing e.g. 1s. Pairs naturally with the request-ID work already recommended for observability (P2-16).
3. **A slow-query log threshold (S effort).** Django's `django.db.backends` logger already exists; set a threshold (e.g. 200ms) and route to a dedicated log stream. Cheap, catches the N+1 class even though none was found in this pass.
4. **CI check on request-path query/call counts for the highest-traffic endpoints (M effort, depends on P2-05/CI existing at all).** Once a CI pipeline exists, add a lightweight assertion (`django-perf-rec` or a hand-rolled `CaptureQueriesContext` count-ceiling) on `transition()`, the submission list, and the dashboard endpoint specifically, since those are the ones this review traced in depth.

The regression that matters most to prevent here isn't re-teaching the team the Celery pattern — they clearly know it (it's used correctly in the majority of `transition()`). It's guardrail #1: something that fails loudly and automatically the next time a new feature adds a synchronous send, rather than relying on someone noticing a slow toast in production.
