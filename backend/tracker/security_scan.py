"""Run the dependency (pip-audit) and static-analysis (Bandit) scans and store the result.

Shared by the administrator's "Run scan" button (views.SecurityScanViewSet.run_scan)
and the weekly scheduled run (tasks.run_scheduled_security_scan), so both produce
the same SecurityScan record."""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys

from django.utils import timezone

from .audit import log_action
from .models import AuditLog, SecurityScan

_security_log = logging.getLogger("scdms.security")
SCAN_TYPES = ("dependency", "sast", "full")


def run_security_scan(scan_type: str = "full", *, request=None, user=None) -> SecurityScan:
    """Run a scan synchronously (10 to 60 s typically) and return the saved SecurityScan.

    `request` is passed to the audit log when an administrator triggered it; a
    scheduled run passes neither and is recorded with no actor."""
    scan_type = (scan_type or "full").strip().lower()
    if scan_type not in SCAN_TYPES:
        scan_type = "full"
    actor = user or (getattr(request, "user", None) if request is not None else None)

    scan = SecurityScan.objects.create(
        scan_type=scan_type,
        triggered_by=actor if getattr(actor, "pk", None) else None,
        status="running",
    )

    dep_results = []
    sast_results = {}
    error_parts = []

    if scan_type in ("dependency", "full"):
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pip_audit", "--format=json"],  # no -q: pip-audit 2.10 rejects it
                capture_output=True, text=True, timeout=120,
            )
            raw = proc.stdout.strip()
            if raw:
                parsed = json.loads(raw)
                # pip-audit JSON: {"dependencies": [...], "vulnerabilities": [...]}
                # Normalise to a flat list of vulnerability objects.
                if isinstance(parsed, dict):
                    vulns = parsed.get("vulnerabilities") or []
                    # pip-audit < 2.7: list at top level
                    if not vulns and isinstance(parsed.get("dependencies"), list):
                        for dep in parsed["dependencies"]:
                            for v in dep.get("vulns", []):
                                v["package"] = dep.get("name", "")
                                v["installed_version"] = dep.get("version", "")
                                vulns.append(v)
                    dep_results = vulns
                elif isinstance(parsed, list):
                    dep_results = parsed
            elif proc.returncode == 0:
                dep_results = []  # no output = no vulnerabilities
            else:
                error_parts.append(f"pip-audit stderr: {proc.stderr[:500]}")
        except subprocess.TimeoutExpired:
            error_parts.append("pip-audit timed out after 120s.")
        except Exception as exc:  # noqa: BLE001
            error_parts.append(f"pip-audit error: {exc}")

    if scan_type in ("sast", "full"):
        try:
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            proc = subprocess.run(
                [sys.executable, "-m", "bandit", "-r", backend_dir, "-f", "json", "-q", "--exit-zero"],
                capture_output=True, text=True, timeout=180,
            )
            raw = proc.stdout.strip()
            sast_results = json.loads(raw) if raw else {"results": [], "metrics": {}}
        except subprocess.TimeoutExpired:
            error_parts.append("bandit timed out after 180s.")
        except Exception as exc:  # noqa: BLE001
            error_parts.append(f"bandit error: {exc}")

    sast_issues = sast_results.get("results", [])
    summary = {
        "dependency_vulnerabilities": len(dep_results),
        "sast_issues_total": len(sast_issues),
        "sast_high": sum(1 for i in sast_issues if i.get("issue_severity") == "HIGH"),
        "sast_medium": sum(1 for i in sast_issues if i.get("issue_severity") == "MEDIUM"),
        "sast_low": sum(1 for i in sast_issues if i.get("issue_severity") == "LOW"),
    }

    scan.dependency_results = dep_results
    scan.sast_results = sast_results
    scan.summary = summary
    scan.status = "failed" if error_parts else "completed"
    scan.error_message = "\n".join(error_parts)
    scan.completed_at = timezone.now()
    scan.save()

    who = scan.triggered_by.username if scan.triggered_by_id else "scheduled"
    log_action(
        request, AuditLog.Action.READ, resource_type="SecurityScan", resource_id=scan.id,
        description=f"Security scan ({scan_type}, {who}) {scan.status}. "
                    f"Deps: {len(dep_results)} vulns | SAST: {len(sast_issues)} issues",
    )
    _security_log.info("SECURITY_SCAN | type=%s | status=%s | by=%s", scan_type, scan.status, who)
    return scan
