# Architecture, Testing, CI/CD, and Standards

---

## 1. Current architecture

Django project `config` + a single application `tracker` holding **90 models** (`models.py`, 4,708 lines), a **13,759-line** `views.py`, and a 3,311-line `serializers.py`. Some functional areas already have their own sub-packages (`ai/`, `automation/`, `intelligence/`, `rules/`, `reports/`, `letters/`, `daily_brief/`) — it's specifically the three core layers (models/views/serializers) that remain single monoliths, because every model lives in one `models.py` regardless of domain, and Django's app boundary is the module, not the sub-package.

**Evidence this is a live cost, not a theoretical one:** in the last 30 commits, `views.py` was touched in **19 of them** — the single most-churned file in the repository, and also its largest.

## 2. Proposed domain decomposition

| New app | Representative models | Representative views |
|---|---|---|
| `org_structure` | `Ministry`, `Department`, `Unit`, `AgendaSection`, `FormCategory`, `PublicHoliday` | `MinistryViewSet`, `DepartmentViewSet`, `UnitViewSet` |
| `forms` | `PSCFormType`, `PSCFormField`, `PSCFormResponse`, `RequiredDocument`, `PSCForm37Data`, `TravelApprovalLetter` | `PSCFormTypeViewSet`, `PSCFormFieldViewSet` |
| `submissions` (core, split last) | `Submission`, `SubmissionStageEvent`, `SubmissionCoAssignment`, `SubmissionDocument`, `SubmissionPresence`, `SubmissionPrivateNote` | `SubmissionViewSet` (~3,450 lines — needs internal breakup before the app move) |
| `workflow` | `WorkflowEvent`, `AgendaDeferral` | Transition logic currently embedded in `SubmissionViewSet` |
| `meetings_minutes` | `Meeting`, `AgendaItem`, `MeetingOtherMatter`, `Minutes`, `MinutesComment`, `FlyingMinuteSignature` | `MeetingViewSet`, `MinutesViewSet` |
| `decisions` | `DecisionService`, `DecisionLetter`, `DecisionRegisterReport` | `DecisionLetterViewSet` + `decision_service.py`/`decision_allocation.py` |
| `tasks` | `CommissionTask`, `CommissionTaskUpdate`, `CommissionSubTask` | `CommissionTaskViewSet` |
| `identity` | `Profile`, `TrustedSession`, `PasswordResetToken`, `UserSignature`, `DocumentSignature` | Auth/TOTP/PIN/registration views |
| `rbac`/`admin_config` | `SystemPermission`, `RoleDefinition`, `SystemSetting`, `EmailTemplate` | `RoleDefinitionViewSet`, `SystemSettingViewSet` |
| `audit`/`security` | `AuditLog`, `SecurityIncident`, `SecurityScan`, `AIGenerationLog`, `IntegrityFlag` | `AuditLogViewSet`, `BackupViewSet` |
| `knowledge` | `KnowledgeCategory`, `KnowledgeArticle` | — |
| `notifications` | `Notification`, `Comment`, `Mention`, `WebPushSubscription` | `NotificationViewSet` |
| `odu_ipdu` | `RestructureSubmissionData`, `ODURestructureChecklist`, `ODURestructureBoardPaper`, `IPDUBoardPaper` | ~2,400 lines of `views.py`, already comment-delimited in `models.py` |
| `intelligence` / `automation` | `Dashboard`, `SavedExploration`, `Automation`, `AutomationRun` | Already partially isolated as sub-packages |

### Migration-safety constraint (must not be skipped)

Every one of the 90 models is recorded in migration history under app_label `tracker` across 258 migrations. Moving a model to a new app is **not a file move** — Django tracks `(app_label, model_name)` as table identity, and a naive move orphans migration history and collides at deploy time. The correct approach is `migrations.SeparateDatabaseAndState` — `state_operations=[DeleteModel(...)]` in `tracker`'s migration, paired with a state-only `CreateModel` in the new app, with `Meta.db_table` overridden to preserve the existing physical table name (`tracker_<model>`) so no data movement actually happens. Every cross-app FK left pointing at a moved model needs its reference updated.

### Recommended phasing (most-decoupled first, validated technique before touching load-bearing tables)

1. **`knowledge`** — near-zero inbound FKs, lowest blast radius, good first exercise.
2. **`odu_ipdu`** — self-contained cluster, already comment-delimited, only inbound dependency is a FK to `Submission`.
3. **`audit`/`security`** — mostly append-only, referenced *from* other domains rather than referencing them.
4. **`identity`/`rbac`** — higher risk (auth middleware, axes, JWT all touch `Profile`); do only after 1-3 validate the technique in production.
5. **`meetings_minutes`, `decisions`, `tasks`** — deeply cross-referential with `Submission`; split after `submissions` itself is the stable core.
6. **`submissions`** last — internally decompose `SubmissionViewSet` into mixins *within* the same app first (a lower-risk, non-migration-touching step) before moving the model.

Each phase should be its own deploy window with a scripted, staging-tested rollback — appropriate caution for a two-person IT team.

## 3. Workflow engine — declarative graph, imperative role gate, three copies of routing logic

`transitions.py` (916 lines) centers on three dict-based stage graphs (`_STAGE_GRAPH`, `_INTERNAL_STAGE_GRAPH`, `_SECRETARY_ONLY_STAGE_GRAPH`) — genuinely declarative. But **role-scoped permission is not** — it's a second layer of role-specific allow-sets and `if role == X` branches inside `assert_transition_allowed()`, and it is **duplicated a third time** in `views.py`'s `transition()` action, which layers its own independent unit-routing and assignment gates on top (`views.py:1822-1889`), with source comments explicitly acknowledging the duplication ("Keep this mapping in sync with...", `transitions.py:351`, `views.py:1822`) as a manually-maintained invariant rather than a structurally-enforced one.

**Should this move to a DB/admin-editable model?** Not the core stage graph, not as a first step. The role/routing conditionals are the majority of the file's logic and aren't cleanly data-drivable without a small rules-DSL — a real engineering investment. What's more tractable and already partially config-driven: SLA/deadline day-counts (`CHECKLIST_REVIEW_SLA_DAYS`, `PSC_REGISTRATION_SLA_DAYS`, both already `settings`-driven) and the holiday calendar (already a DB model, `PublicHoliday`). Recommend expanding *that* surface rather than building a full transition-graph editor.

**If a transition editor is ever built, the governance gap to close first:** the one precedent that exists (`RoleDefinitionViewSet.update()`, `views.py:6723-6759`) is a direct single-actor edit with an audit-log entry — no maker-checker step. For a legally-significant workflow, a second-approval requirement (a small `WorkflowConfigChangeRequest` model, `proposed_by`/`approved_by`/`status`) has no existing precedent anywhere in the codebase and would need to be built new, not copied.

## 4. Testing

- **Backend:** 64 test files under `backend/tracker/tests/`. Good coverage of core workflow transitions, IPDU/ODU, Meetings/Sitting, and Minutes. **Zero dedicated coverage** for: Knowledge Base, staff chat, web push, decision letters, feedback module, UI translations, meeting transcripts. **No dedicated test module for account lockout/2FA/session-PIN** despite substantial logic at `views.py:6560-6930`. `test_rbac.py` is only 79 lines against a 33-role system. No `pytest-cov`/coverage measurement exists anywhere.
- **Frontend:** confirmed zero automated tests — no test files, no test runner script in `package.json`, no testing library in dependencies.
- **CI:** none exists to run any of the above automatically.

### Target test pyramid

| Layer | Current | Target |
|---|---|---|
| Model/unit (backend) | Partial | Every model with non-trivial logic (properties, `save()` overrides, SLA computation) |
| DRF API contract | Partial, ad hoc | A baseline "does this endpoint return the right shape/status for the right role" pass per ViewSet |
| Workflow transition matrix | Partial | **Non-negotiable per the audit brief**: every (role × from-stage × to-stage) combination, positive and negative, generated programmatically from `transitions.py`'s own data structures where possible rather than hand-enumerated |
| RBAC assertions | Thin (`test_rbac.py`, 79 lines) | **Non-negotiable**: an IDOR-probe suite specifically — for every `ViewSet`, assert a user outside the intended scope gets 403/404, not 200. This would have caught P1-03/P1-04 |
| Frontend component | Zero | Start with the shared primitives (`Modal`, `BaseInput`, `MultiPageFormRenderer`) since they're highest-leverage |
| E2E journeys | Zero | The two journeys traced in `02-ux-workflow-report.md`, automated |

## 5. CI/CD

No pipeline exists. Dockerfiles are genuine multi-stage builds and correctly run as non-root, but have no security-scanning step, and one build-time binary download (Quarto, `backend/Dockerfile:26`) has no checksum verification.

**Proposed minimal pipeline** (on-prem-deployable, no hyperscaler dependency — appropriate to the stated context):
1. Lint (ruff for Python, eslint for JS) — fast, cheap, catch-everything-else's-prerequisite.
2. Type checks where applicable (frontend has no TypeScript currently — out of scope unless that migration happens separately).
3. Backend test run (`manage.py test`), frontend test run once P1-16's test suite exists.
4. `pip-audit` / `npm audit` — both dependencies are already installed for the Python side, just never invoked.
5. Container image scan (`trivy`/`grype` — either is a single-binary, no-hyperscaler-dependency tool, appropriate for self-hosted runners).
6. Secret scanning (`gitleaks` or `trufflehog`, both self-hostable) on every push.
7. Migration-safety check — at minimum `manage.py makemigrations --check --dry-run` to catch missing migrations.
8. Manual-approval gate before production deploy — appropriate given on-prem infrastructure and a small team; this is a policy gate (a person clicks "approve"), not a technical requirement for a specific platform.

This can run on a self-hosted GitHub Actions runner or a simple on-prem Gitea/Woodpecker setup if GitHub-hosted runners are undesirable for data-sovereignty reasons — worth a decision (see Open Questions) since the codebase already lives on GitHub.

## 6. Repository hygiene

**Findings (confirmed via `git ls-files`, not just working-directory listing):**
- **Tracked, sensitive**: `email_1_technical_assessment_note.txt` (names a real official, cites specific legislation), `AI_Service_Quotation.md`/`.tex` (commercial pricing), `.Rhistory` — flagged separately and urgently in P0-05. **Per explicit instruction, no history rewrite has been performed; this is flagged for records/legal to decide.**
- **Tracked, non-code, contributing to repo bloat**: ten near-duplicate workflow-diagram markdown files, ~40 more `.docx`/`.pptx`/`.html`/`.qmd` documents (concept notes, walkthroughs, committee updates, planning guidelines, letter/checklist templates), several multi-megabyte HTML exports. Repo size excluding `node_modules`/`.venv`: **388MB** — large for a Django/React source tree, driven almost entirely by these tracked binaries (top 10 by size listed below).
- One near-miss already on record in the team's own commit history: a commit message notes "a `git add -A` during this cleanup almost committed a 21MB real ministry document into the repo" before `uploads/` was added to `.gitignore` — i.e., the team is already aware this is a live risk pattern, not a hypothetical one.

**Top 10 largest tracked files:**

| Size | Path |
|---|---|
| 10.9 MB | `PSC Planning & Reporting Guidelines/Ministry Corporate Plan Guideline.pdf` |
| 4.7 MB | `scdms-validation.html` |
| 4.1 MB | `PSC Planning & Reporting Guidelines/Annual Report Guideline.pdf` |
| 3.5 MB | `Technical Document.docx` |
| 3.5 MB | `PSC Planning & Reporting Guidelines/Department Business Plan Guideline.pdf` |
| 3.3 MB | `PSC Planning & Reporting Guidelines/Half Yearly Report Guideline.pdf` |
| 2.6 MB | `PSC Planning & Reporting Guidelines/Quarterly Report Guideline.pdf` |
| 2.1 MB | `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/RECRUITMENT/Letters/New Letter Head- Acting Appointment Approved by Secretary.docx` |
| 2.1 MB | `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/LEAVE PAYOUT/Leave Payout.docx` |
| 2.1 MB | `TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/ALLOWANCES/Medical Claim.docx` |

**Proposed remediation:**
1. `/docs` restructure: move the genuinely-useful reference material (planning guidelines, letter templates — these look like real, current operational references) into `docs/reference/`, keep as tracked files (they're not sensitive, just misplaced) or move to a document store if the team has one.
2. Retire the ten diagram-duplicate files down to one canonical source (recommend Mermaid, checked into `docs/architecture/`, so it renders in GitHub natively and stays a diffable text format rather than another static export).
3. **Do not** run a git-history purge until records/legal has ruled on P0-05 — a purge is destructive to any other clone of the repo and should be a deliberate, coordinated action, not a reflexive cleanup.
4. Add a pre-commit hook or CI check blocking new files above a size threshold (e.g. 1MB) from landing in the app source tree without an explicit override, to stop the pattern recurring — directly addresses the near-miss the team already flagged in their own history.

## 7. Dependencies / SBOM

**Backend** (`requirements.txt`): almost entirely floor-only (`>=`) version constraints, **no lockfile at all** — builds are not reproducible. `redis==4.6.0` is the one exact pin, an inconsistency worth normalizing. No GPL/AGPL-licensed package identified by name, but this has not been run through an actual license scanner — flag as unverified for legal review rather than asserted clean. `bandit`/`pip-audit` are listed as dependencies but invoked nowhere (see §5).

**Frontend** (`package.json`): has a committed lockfile (an asymmetry worth closing on the backend side). No test-runner dependency exists at all.

**Recommendation:** run `pip-audit -r backend/requirements.txt` and `npm audit --prefix frontend` for an actual CVE-verified pass — every CVE-adjacent flag in this review is explicitly unverified pending that tooling run, since this review had no internet access to confirm live CVE status. Generate and commit a backend lockfile as a near-term, low-effort fix (P2-06).

## 8. Documentation set for handover

Present: README (comprehensively updated this session), `docs/deployment-tls.md`, `docs/deployment-render.md`, drf-spectacular OpenAPI schema (completeness not independently verified in this pass — recommend a spot-check against a few of the newer Minutes-workflow endpoints).

Missing, recommended for Phase 1: architecture decision records (started in `09-adr/` from this review), a data dictionary (the model inventory in the README is a starting point, not a full field-level dictionary), a runbook (backup/restore procedure — especially urgent given P0-02's findings about the current restore endpoint — plus incident response), a disaster-recovery plan with an actually-tested RTO/RPO (not just "backups exist"), an SOP-to-system traceability matrix (several code comments already cite SOP sections — e.g. `models.py:1073` "SOP Section 8" — suggesting the underlying SOP document exists and could be cross-referenced systematically), and a user manual per role given the system now has 33 roles.

## 9. Governance & compliance mapping

The codebase already shows deliberate alignment work: model comments cite **NCSS 2030** and **ISO/IEC 27001 Annex A** control references directly (`models.py:1296` A.12.4, `:1421` A.16.1, `:1477` A.12.6) — this is a genuinely good sign that compliance mapping was considered during design, not retrofitted. OWASP ASVS L2 mapping for security findings is in `05-security-assessment.md`.

**Requires local legal confirmation, not this review's assumption** (flagged, not answered, per the audit brief's own instruction and the Open Questions deliverable): the Public Service Act's specific requirements for record retention periods per record category; whether Vanuatu has (or is drafting) a data-protection instrument that would govern the AI cross-border transfer question in P1-07; the legal status of the current wet-ink-scan signature process relative to any pending digital-signature legislation (the codebase's own comments already anticipate this is interim); and the exact quorum rule for a valid Commission sitting, needed before P1-14 can be implemented correctly.
