# ADR 0002: Domain Module Boundaries

## Context

`models.py` (4,708 lines, 90 models), `views.py` (13,759 lines), and `serializers.py` (3,311 lines) are single files holding every domain in the system. `views.py` was touched in 19 of the last 30 commits — the most-churned file in the repository. Some functional areas already have their own sub-packages (`ai/`, `automation/`, `intelligence/`, `rules/`, `reports/`, `letters/`) — it's specifically the ORM/API core that remains monolithic.

## Decision

Decompose into domain-scoped Django apps, in the phased order set out in `04-architecture-and-standards.md` §2 (knowledge → odu_ipdu → audit/security → identity/rbac → meetings_minutes/decisions/tasks → submissions last), using `migrations.SeparateDatabaseAndState` with `db_table` overrides to preserve physical tables and avoid any actual data movement. `submissions` — the highest-risk, most cross-referential domain — is internally decomposed into smaller ViewSet mixins *within the existing app* first, before its eventual app move.

## Consequences

- Each phase is an independent, stagingtested, rollback-capable deploy — appropriate for a small team without a big-bang rewrite.
- Cross-app foreign keys will multiply as domains split (normal in Django, but means every phase's migration needs care with `related_name`/`to=` string references).
- Near-term velocity cost: the team pays a one-time tax per phase (updating imports, verifying migration state) in exchange for reduced long-term merge contention on the three files responsible for most of the churn observed in git history.
- This does not, by itself, fix the RBAC/duplication issues in ADR 0001 — those live inside the domains being moved and should be addressed opportunistically during each phase's move, not treated as blocking prerequisites.

## Alternatives considered

- **Leave as one app, rely on internal file organization only** (e.g. splitting `views.py` into multiple files within the same app, no migration risk). Lower-risk, faster, and a reasonable *first* step for the `submissions` domain specifically (see Decision) — but does not address Django's app-level boundary for permissions/admin registration/independent testing that the full split provides for the other domains. Treated as complementary, not a substitute.
- **Big-bang rewrite into a fresh multi-app project.** Rejected — infeasible for a two-person team maintaining a live government system, and discards 258 migrations' worth of validated schema history for no correctness benefit.
