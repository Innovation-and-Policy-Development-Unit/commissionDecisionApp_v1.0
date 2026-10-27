# OPSC staff training: practice data in the system

For whoever writes or updates the OPSC staff training materials (day plan, presentation,
workbook, quick guide, facilitator guide, Exercise 6 case sheets) for the training on
**Friday 30 October 2026**. It describes the practice data that already exists in the
production SCDMS, and the system behaviour the exercises must match. Passwords are not
recorded here; the facilitator lead holds them.

## What exists

Created on 2026-10-28 by `python manage.py seed_opsc_training --teams 8`
(`backend/tracker/management/commands/seed_opsc_training.py`).

| Item | Value |
|---|---|
| Practice ministry | "Ministry of Practice Services (practice only)", code `PRAC` |
| Practice cases (Exercise 1) | `TRAIN-OPSC-E1-01` to `TRAIN-OPSC-E1-08`: one per team (team N uses case N) |
| Form type | `RECRUIT-CONFIRM`, Confirmation of Appointment Submission Paper (routes to the HR unit) |
| Case stage at start | **Submitted to PSC**, with all three required documents already attached |
| Case title | `[TRAINING] Confirmation of appointment — Team N (practice only)` |
| Lodged by | `practice.ministry.hr` |
| Practice sitting (Exercise 3) | `TRAIN-OPSC-MTG-001`, "OPSC TRAINING SITTING — practice only, not real", 30 Oct 2026 09:00; submission cutoff 29 Oct 17:00 |

Practice accounts (no email address set by default):

| Username | Role | OPSC unit |
|---|---|---|
| `practice.psc.officer` | PSC Officer | CSU |
| `practice.senior.admin` | Senior Administration Officer | CSU |
| `practice.hr.manager` | HR Unit Manager | HR |
| `practice.hr.principal` | HR Unit Principal | HR |
| `practice.secretary` | PSC Secretary | CSU |
| `practice.chairperson` | Chairman | CSU |
| `practice.ministry.hr` | Ministry HR Officer | practice ministry |

Participants use their own accounts for the role they hold; the practice accounts cover roles
they do not hold. Practice accounts are role-wide, so they also see the one real case in the system.

## What is NOT pre-created

- **Exercise 5 case**: the facilitator lodges it on the day as `practice.ministry.hr`, in the type the team picks.
- **Exercise 6 cases** (Compliance SMDR, VIPAM training request, CSU Temporary Appointment): created by
  the participants themselves with *New Submission*, under their own accounts, typing the details from
  the case sheets. They get real `PSC-2026-nnnnn` numbers and are not flagged as tests, so they must be
  deleted by hand after the training.

## System behaviour the materials must match

Checked against the code (cited files), not the live screens; the Wednesday dry run confirms.

1. **Practice cases are `is_test`.** Test cases are kept out of reports, AI briefs and automatic agenda
   placement, and they **block agenda submission and endorsement** while on a meeting's agenda
   (`backend/tracker/views.py`, `_test_items_on_agenda`). So Exercise 3 can add the case to the agenda
   and mark it as sitting, but cannot send the agenda to the Chairperson or endorse it. A facilitator
   should describe endorsement instead. The materials currently say participants send it for endorsement.
2. **Use the pre-created sitting.** Creating a meeting through the app emails the HR Unit Manager and
   ministry HR officers (`perform_create` in the meetings viewset). Participants should not create
   their own practice meeting; the workbook step "create a practice meeting" should be replaced with
   "open the practice sitting your facilitator names".
3. **Route to Manager is one click.** The unit comes from the form type
   (`PSCFormType.routed_unit`, `backend/tracker/intake_routing.py`); there is no choice of unit. The
   stage after it is **Manager Checklist Review**. "Registered and Routed" is not reachable
   (`frontend/src/components/submissions/WorkflowActionsPanel.jsx`, `transitions.py`).
4. **Assessment flow.** At Manager Checklist Review the manager *allocates* the case to a principal or
   senior officer (stage unchanged). The principal/senior does the review and presses **Submit to
   Manager** (hand back). Only then can the manager press **Submit to Secretary**. A manager is blocked
   from advancing a case that is allocated and not handed back. **Under Assessment** is reached only by
   the Secretary pressing **Return to Assessment**; the 21-working-day timer starts there.
5. **Compliance route.** After the Principal's *Return to Senior*, the Senior has two alternative
   buttons: **Resubmit to Principal** or **Submit to Manager**. They are not sequential.
6. **Sign-in order.** Password, then a forced "change your temporary password" screen (first time),
   then the emailed 6-digit code, then the session PIN. Practice accounts have no forced change, but
   still need an emailed code, so each needs an email address (Admin > Users) or the seed re-run with
   `--facilitator-email`.
7. **Menu names.** The Implementation page is "Implementation", the decisions list is "Decisions"; both,
   and Pending Decisions, look role-restricted.

## Cleaning up after the training

```bash
sudo -n docker exec scdms-backend-1 python manage.py seed_opsc_training --cleanup
```

Removes the practice ministry, cases (including Exercise 5 cases lodged under it), their tasks and
files, the practice sitting and the seven accounts. It then lists internal cases created around the
training day (the Exercise 6 ones) for manual review. If the backend container was recreated, copy the
command file back into it first.
