"""
Upsert ministries and departments from a CSV file.

Usage:
    python manage.py reseed_ministries
    python manage.py reseed_ministries --csv /path/to/file.csv
    python manage.py reseed_ministries --dry-run

The CSV must have two columns: Ministry, Department.
Codes are auto-generated from the ministry name (uppercase initials).
Existing rows are matched by code (ministry) or by (ministry, name) for departments;
names are updated in-place — no rows are deleted so foreign-key references stay intact.
"""

import csv
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tracker.models import Department, Ministry

# Default path: the CSV shipped alongside this repo
DEFAULT_CSV = Path(__file__).resolve().parents[4] / "Book 19(Sheet1).csv"

# Hand-crafted code overrides so the auto-slug matches legacy seeds/FKs
MINISTRY_CODE_MAP: dict[str, str] = {
    "Ministry of Prime Minister":                                                "OPM",
    "Ministry of Agriculture, Livestock, Forestry and Biosecurity":             "MALFB",
    "Ministry of Climate Change and Adaptation":                                "MCCA",
    "Ministry of Trades, Tourism, Commerce and Ni-Vanuatu Business":            "MTTCNB",
    "Ministry of Education and Training":                                        "MET",
    "Ministry of Finance and Economic Management":                              "MFEM",
    "Ministry of Foreign Affairs, International Cooperation and External Trade": "MFAICET",
    "Ministry of Health":                                                        "MOH",
    "Ministry of Infrastructure and Public Utilities":                          "MIPU",
    "Ministry of Internal Affairs":                                             "MIA",
    "Ministry of Justice and Community Services":                               "MJCS",
    "Ministry of Lands and Natural Resources":                                  "MLR",
    "Ministry of Fisheries, Ocean and Maritime Affairs":                        "MFOMA",
}


def _slugify_dept(ministry_code: str, dept_name: str) -> str:
    """Generate a stable dept code: MINISTRY_CODE + _ + uppercased significant words."""
    words = re.sub(r"[^A-Za-z0-9 ]", "", dept_name).split()
    # skip common filler words
    skip = {"of", "and", "the", "for", "in", "a", "an"}
    sig = [w[0] for w in words if w.lower() not in skip]
    abbr = "".join(sig).upper()[:10] or "DEPT"
    return f"{ministry_code}_{abbr}"


class Command(BaseCommand):
    help = "Upsert ministries and departments from CSV (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv",
            default=str(DEFAULT_CSV),
            help="Path to the CSV file (default: Book 19(Sheet1).csv beside the repo root).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without writing to the DB.",
        )

    def handle(self, *args, **options):
        csv_path = Path(options["csv"])
        if not csv_path.exists():
            raise CommandError(f"CSV not found: {csv_path}")

        dry_run: bool = options["dry_run"]
        verb = "[DRY-RUN] " if dry_run else ""

        # Parse CSV → {ministry_name: [dept_name, ...]}
        ministry_depts: dict[str, list[str]] = {}
        with csv_path.open(newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                min_name = row["Ministry"].strip()
                dept_name = row["Department"].strip()
                if min_name and dept_name:
                    ministry_depts.setdefault(min_name, []).append(dept_name)

        created_min = updated_min = 0
        created_dept = updated_dept = 0

        with transaction.atomic():
            for min_name, dept_names in ministry_depts.items():
                code = MINISTRY_CODE_MAP.get(min_name) or self._auto_code(min_name)

                existing = Ministry.objects.filter(code=code).first()
                if existing is None:
                    # Also try matching by exact name in case the code was different
                    existing = Ministry.objects.filter(name=min_name).first()

                if existing is None:
                    if not dry_run:
                        Ministry.objects.create(code=code, name=min_name)
                    self.stdout.write(f"  {verb}CREATE ministry  [{code}] {min_name}")
                    created_min += 1
                else:
                    changed = []
                    if existing.code != code:
                        changed.append(f"code: {existing.code!r} → {code!r}")
                    if existing.name != min_name:
                        changed.append(f"name: {existing.name!r} → {min_name!r}")
                    if changed and not dry_run:
                        existing.code = code
                        existing.name = min_name
                        existing.save(update_fields=["code", "name"])
                    if changed:
                        self.stdout.write(f"  {verb}UPDATE ministry  [{code}] " + "; ".join(changed))
                        updated_min += 1
                    else:
                        self.stdout.write(self.style.SUCCESS(f"  OK     ministry  [{code}] {min_name}"))

                # Resolve the saved ministry object for FK use
                if not dry_run:
                    ministry_obj = Ministry.objects.get(code=code)
                else:
                    ministry_obj = existing  # may be None on first dry run

                # Departments
                for dept_name in dept_names:
                    dept_code = _slugify_dept(code, dept_name)
                    # Match by code first, then by (ministry, name) for legacy rows
                    dept = Department.objects.filter(code=dept_code).first()
                    if dept is None and ministry_obj:
                        dept = Department.objects.filter(
                            ministry=ministry_obj, name=dept_name
                        ).first()

                    if dept is None:
                        if not dry_run and ministry_obj:
                            Department.objects.create(
                                code=dept_code, name=dept_name, ministry=ministry_obj
                            )
                        self.stdout.write(
                            f"    {verb}CREATE dept  [{dept_code}] {dept_name}"
                        )
                        created_dept += 1
                    else:
                        changed = []
                        if dept.code != dept_code:
                            changed.append(f"code: {dept.code!r} → {dept_code!r}")
                        if dept.name != dept_name:
                            changed.append(f"name: {dept.name!r} → {dept_name!r}")
                        if ministry_obj and dept.ministry_id != ministry_obj.pk:
                            changed.append("ministry reassigned")
                        if changed and not dry_run:
                            dept.code = dept_code
                            dept.name = dept_name
                            if ministry_obj:
                                dept.ministry = ministry_obj
                            dept.save(update_fields=["code", "name", "ministry"])
                        if changed:
                            self.stdout.write(
                                f"    {verb}UPDATE dept  [{dept_code}] " + "; ".join(changed)
                            )
                            updated_dept += 1

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"{verb}Done — ministries: +{created_min} created, {updated_min} updated  |  "
            f"departments: +{created_dept} created, {updated_dept} updated"
        ))

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _auto_code(name: str) -> str:
        skip = {"of", "and", "the", "for", "in", "a", "an"}
        words = re.sub(r"[^A-Za-z0-9 ]", "", name).split()
        return "".join(w[0] for w in words if w.lower() not in skip).upper()
