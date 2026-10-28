"""
Bulk-create user accounts from a CSV and (optionally) email each their sign-in details.

Usage:
    python manage.py import_users users.csv --password '<shared temp password>' --dry-run
    python manage.py import_users users.csv --password '<...>'
    python manage.py import_users users.csv --password '<...>' --send-emails --only cthyna,lebong
    python manage.py import_users users.csv --password '<...>' --send-emails

CSV columns: first_name, last_name, email, role, ministry, department, unit, is_active.
`role` is the role's display label (e.g. "Compliance Manager") or its code
(e.g. "compliance_manager"). `unit` may be blank, and so may `department` except for
a Department Admin Officer (a ministry HR officer or Director-General is ministry-wide).
The username is the part of the
email before the "@".

Every account is created with force_password_change=True, so the temporary
password must be replaced at first sign-in. The command is idempotent: users that
already exist are skipped, and with --send-emails the welcome email is also sent
to CSV users who exist, have not yet changed their password, and still have the
supplied password — so accounts can be created first and mailed in a second run.
All rows are validated before anything is written; one bad row aborts the import.
"""

import csv
import time
from pathlib import Path
from urllib.parse import urlparse

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction

from tracker.models import AuditLog, Department, Ministry, Profile, Role, Unit

REQUIRED_COLUMNS = {"first_name", "last_name", "email", "role", "ministry", "department", "unit", "is_active"}

# Resend's default limit is 2 requests/second.
EMAIL_PAUSE_SECONDS = 0.6

_ROLE_LOOKUP = {}
for _value, _label in Role.choices:
    _ROLE_LOOKUP[_value.casefold()] = _value
    _ROLE_LOOKUP[str(_label).casefold()] = _value


class Command(BaseCommand):
    help = "Bulk-create users from a CSV with a shared temporary password; optionally email them."

    def add_arguments(self, parser):
        parser.add_argument("csv", help="Path to the users CSV.")
        parser.add_argument("--password", required=True, help="Temporary password given to every new account.")
        parser.add_argument("--dry-run", action="store_true", help="Validate and report; write nothing, send nothing.")
        parser.add_argument("--send-emails", action="store_true", help="Send the welcome email after creating accounts.")
        parser.add_argument("--only", default="", help="Comma-separated usernames; restrict the whole run to these.")

    def handle(self, *args, **opts):
        path = Path(opts["csv"])
        if not path.is_file():
            raise CommandError(f"CSV not found: {path}")
        password = opts["password"]
        only = {u.strip().lower() for u in opts["only"].split(",") if u.strip()}

        rows = self._read(path)
        if only:
            rows = [r for r in rows if r["username"] in only]
            missing = only - {r["username"] for r in rows}
            if missing:
                raise CommandError(f"--only usernames not in CSV: {', '.join(sorted(missing))}")

        plan, errors = self._validate(rows)
        if errors:
            for err in errors:
                self.stderr.write(self.style.ERROR(err))
            raise CommandError(f"{len(errors)} problem(s) found; nothing was written.")

        to_create = [p for p in plan if p["existing"] is None]
        existing = [p for p in plan if p["existing"] is not None]
        self.stdout.write(f"{len(to_create)} to create, {len(existing)} already exist (skipped).")
        for p in existing:
            self.stdout.write(f"  exists: {p['username']}")

        if opts["dry_run"]:
            for p in to_create:
                self.stdout.write(f"  would create: {p['username']} <{p['email']}> {p['role']} / {p['unit'] or '-'}")
            self.stdout.write(self.style.WARNING("Dry run — nothing written, nothing sent."))
            return

        with transaction.atomic():
            created = [self._create(p, password) for p in to_create]
        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} account(s)."))

        if not opts["send_emails"]:
            self.stdout.write("No emails sent (re-run with --send-emails).")
            return

        targets = list(created)
        for p in existing:
            user = p["existing"]
            profile = getattr(user, "psc_profile", None)
            if profile and profile.force_password_change and user.is_active and user.check_password(password):
                targets.append(user)
        self._send_welcome_emails(targets, password)

    # ── parsing / validation ─────────────────────────────────────────────────
    def _read(self, path: Path) -> list[dict]:
        with path.open(newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            missing = REQUIRED_COLUMNS - {(c or "").strip() for c in (reader.fieldnames or [])}
            if missing:
                raise CommandError(f"CSV is missing column(s): {', '.join(sorted(missing))}")
            rows = []
            for line_no, raw in enumerate(reader, start=2):
                row = {k.strip(): (v or "").strip() for k, v in raw.items() if k}
                if not any(row.values()):
                    continue
                row["line"] = line_no
                row["email"] = row["email"].lower()
                row["username"] = row["email"].split("@")[0]
                rows.append(row)
        return rows

    def _validate(self, rows: list[dict]):
        plan, errors = [], []
        seen_usernames, seen_emails = {}, {}
        for row in rows:
            line, problems = row["line"], []

            try:
                validate_email(row["email"])
            except ValidationError:
                problems.append(f"invalid email {row['email']!r}")
            if not row["first_name"] and not row["last_name"]:
                problems.append("first_name and last_name are both empty")

            role = _ROLE_LOOKUP.get(row["role"].casefold())
            if not role:
                problems.append(f"unknown role {row['role']!r}")

            ministry = department = unit = None
            ministry = Ministry.objects.filter(name__iexact=row["ministry"]).first()
            if not ministry:
                problems.append(f"unknown ministry {row['ministry']!r}")
            elif not row["department"]:
                # Ministry-wide roles (ministry HR, Director-General) belong to no single
                # department; a department admin is scoped to one, so it must be named.
                if role == Role.DEPT_ADMIN:
                    problems.append("a Department Admin Officer needs a department")
                elif row["unit"]:
                    problems.append("a unit needs a department")
            else:
                department = Department.objects.filter(ministry=ministry, name__iexact=row["department"]).first()
                if not department:
                    problems.append(f"unknown department {row['department']!r} in {ministry.name}")
                elif row["unit"]:
                    unit = Unit.objects.filter(department=department, name__iexact=row["unit"]).first()
                    if not unit:
                        problems.append(f"unknown unit {row['unit']!r} in {department.name}")

            is_active = row["is_active"].casefold()
            if is_active not in {"true", "false", "1", "0", "yes", "no"}:
                problems.append(f"is_active must be TRUE/FALSE, got {row['is_active']!r}")

            if row["username"] in seen_usernames:
                problems.append(f"username {row['username']!r} repeats line {seen_usernames[row['username']]}")
            if row["email"] in seen_emails:
                problems.append(f"email repeats line {seen_emails[row['email']]}")
            seen_usernames.setdefault(row["username"], line)
            seen_emails.setdefault(row["email"], line)

            existing = User.objects.filter(username__iexact=row["username"]).first()
            if existing is None and User.objects.filter(email__iexact=row["email"]).exists():
                problems.append(f"email {row['email']} is already used by another username")

            if problems:
                errors.extend(f"line {line} ({row['username']}): {p}" for p in problems)
                continue
            plan.append({
                "username": row["username"], "email": row["email"],
                "first_name": row["first_name"], "last_name": row["last_name"],
                "role": role, "ministry": ministry, "department": department, "unit": unit,
                "is_active": is_active in {"true", "1", "yes"}, "existing": existing,
            })
        return plan, errors

    # ── writes ───────────────────────────────────────────────────────────────
    def _create(self, p: dict, password: str) -> User:
        user = User.objects.create_user(
            username=p["username"], email=p["email"], password=password,
            first_name=p["first_name"], last_name=p["last_name"], is_active=p["is_active"],
        )
        Profile.objects.create(
            user=user, role=p["role"], ministry=p["ministry"], department=p["department"],
            unit=p["unit"], force_password_change=True,
        )
        # request=None: no actor/IP; description marks this as a CLI bulk import.
        from tracker.audit import log_action
        log_action(None, AuditLog.Action.CREATE, resource_type="User", resource_id=user.id,
                   resource_label=user.username,
                   description=f"User account created by bulk import: {user.username} (role: {p['role']})")
        return user

    def _send_welcome_emails(self, users: list[User], password: str):
        from tracker.email_notify import merge_recipient_context
        from tracker.email_templates import get_frontend_base_url, send_templated_email

        base_url = get_frontend_base_url()
        sent, failed = 0, []
        for user in users:
            if not user.is_active:
                continue
            ok = send_templated_email(
                slug="new_user_welcome",
                to=[user.email],
                context=merge_recipient_context(
                    user,
                    initial_password=password,
                    login_url=f"{base_url}/auth/login",
                    portal_domain=urlparse(base_url).netloc or base_url,
                ),
                fail_silently=True,
            )
            if ok:
                sent += 1
                self.stdout.write(f"  emailed: {user.username}")
            else:
                failed.append(user.username)
                self.stderr.write(self.style.ERROR(f"  FAILED: {user.username}"))
            time.sleep(EMAIL_PAUSE_SECONDS)
        self.stdout.write(self.style.SUCCESS(f"Emails sent: {sent}."))
        if failed:
            self.stderr.write(self.style.ERROR(
                f"{len(failed)} failed — re-run with --send-emails --only {','.join(failed)}"))
