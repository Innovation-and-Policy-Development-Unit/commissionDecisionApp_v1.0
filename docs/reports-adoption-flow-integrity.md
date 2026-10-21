# Pilot adoption, stage flow and integrity reports

Three templates on the Smart Report engine (`docs/smart-reports-enterprise-spec.md`,
`docs/reports-templates-spec.md`), each backed by its own data domain. They are seeded by
migration `0277` and appear under **Reports** for the roles listed below. Each domain declares
its own vocabulary (KPIs, chart sources, table columns) on its resolver; `catalog.domain_vocab`
selects it, and the template editor loads it with `GET /api/report-templates/vocabulary/?domain=`.

| Template | Domain | Who can run it |
|---|---|---|
| Pilot Adoption & Readiness Scorecard | `pilot_adoption` | PSC-side roles (never ministry roles); template listed for leadership, IPDU and unit managers |
| Where Do Matters Wait? | `stage_flow` | Anyone with report access; results are scoped by the normal submission RBAC |
| Integrity & Access Attestation | `integrity` | Superusers, PSC Administrator, Chairperson, PSC Secretary, Manager IPDU |

Restricted domains are enforced in three places, not only in the template's `visible_roles`: the
resolver (`authorize`), report creation, and report retrieval/listing (`domain_allows`). A report
admin who holds `export_reports` still cannot open another user's report from a domain they
could not run themselves.

## Pilot adoption scorecard

One row per ministry that has accounts or lodged matters.

- **Active users**: accounts whose `User.last_login` falls in the 30 days up to the report end
  date. `last_login` is used rather than AuditLog LOGIN rows, which go stale for 2FA and PIN
  sign-ins. The date filter does not move this window.
- **Lodged**: matters whose first move into Submitted or Received by PSC falls in the date range
  (or, for matters lodged directly by the PSC without such an event, `received_at`). OPSC-internal
  submissions and attached child forms are excluded. Test submissions are excluded unless
  *Include test submissions* is ticked.
- **First-time-right**: share of lodged matters never returned for clarification.
- **Median days to decision**: lodgement to the first Approved, Noted, Not Approved or Rejected.
- **Stalled drafts**: ministry-side drafts untouched for 14+ days.
- **Status**: *Not started* (nothing lodged, nobody active), *Onboarding* (people signing in,
  nothing lodged), *Needs support* (first-time-right under 60% or 3+ stalled drafts), otherwise
  *Active*. Thresholds are constants at the top of `reports/domains/adoption.py`.

## Where do matters wait?

Built from `WorkflowEvent` timestamps. A matter enters a stage when an event moves it there and
leaves when the next event moves it on.

- Median and 90th-percentile figures use **completed** stays only. Matters still sitting in a
  stage are reported separately (*waiting now*, *longest current wait*) so open-ended waits do
  not distort the statistics.
- Ministry-side drafting and endorsement stages are excluded. Outcome stages (Approved, Noted,
  Not Approved, Rejected, Returned, Implementation Report, Recalled) are never counted as waiting.
- A stage is only named *slowest* once it has at least 3 completed stays.
- The detail table lists the 200 longest-waiting matters.

## Integrity & access attestation

- The audit-log hash chain is re-verified in full on every run through
  `tracker/audit_integrity.verify_audit_chain`, the same function the
  `verify_audit_log_integrity` management command now uses.
- *Privileged accounts*: active users who are superusers or staff, hold the PSC Administrator
  role, or hold a role granted `manage_roles`; each is listed with its 2FA status and last sign-in.
- *Security events* in the period (default last 30 days): failed sign-ins, lockouts, unlocks,
  password changes, permission changes, settings changes, backups, restores and exports.
- *Dormant accounts*: active accounts with no sign-in for 90+ days.

## Adding another domain

Create `reports/domains/<name>.py` with a resolver exposing `key`, `vocab`, `param_schema()` and
`resolve()` (plus `authorize(user)` if access should be restricted), register it in
`domains/base.get_resolver`, add it to `SmartReport.Domain` and `catalog.DOMAIN_LABELS`, and seed a
`ReportTemplate`. Resolvers may put `notes` in `meta`; they render as *Notes and definitions*.
