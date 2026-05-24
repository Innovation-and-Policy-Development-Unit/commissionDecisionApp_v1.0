# AI implementation standards (SCDMS)

## Model tiers

| Tier | Use for |
|------|---------|
| **Haiku** | Checklists, document classification, quality score, deadline reminders, action items, package validation, transition guidance, agenda blurbs, bilingual ministry comms, implementation subtask drafts, minutes action-item extraction |
| **Sonnet** | Executive briefs, NL register reports, meeting briefing narratives, smart search, staff chat (procedures), document OCR/vision, annotation assist, redaction preview, minutes drafting, outcome letters |

Always read tiers from `feature_registry.FEATURE_MODEL_TIER` via `get_model_tier(slug)`.

## Architecture

1. **Async Celery only** — Never call Claude synchronously on `GET` / page load (`retrieve`, `allowed_transitions`, list views).
2. **User actions** — `POST` may queue work and return `202` or updated model with `*_processed=false`; UI polls until ready.
3. **Persist on models** — Store JSON/text on `Submission`, `SubmissionDocument`, `CommissionTask`, `AgendaItem`, `DecisionRegisterReport`, etc.
4. **Disclaimers** — Legal/formal outputs must include `AI draft — verify` in API payloads and UI (amber banner).

## Patterns

- Queue: `queue_<feature>(id)` → `*.delay()` with sync fallback only when Celery unavailable (log warning).
- Poll: frontend refetches detail endpoint every 3–5s while `*_processed` is false.
- Brief on detail view: `queue_submission_brief(..., sync_fallback=False)` only.
