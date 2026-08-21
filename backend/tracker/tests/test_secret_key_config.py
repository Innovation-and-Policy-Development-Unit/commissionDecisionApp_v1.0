"""Django SECRET_KEY configuration (P0-03, SCDMS Pre-Production Readiness
Audit — Findings Register): settings.py used to fall back to a hardcoded,
publicly-readable key if DJANGO_SECRET_KEY was unset, with no DEBUG gate —
if that fallback were ever live, it forges session/CSRF/password-reset
tokens for any user. These tests lock in the fix: no source-code fallback,
and startup fails loudly (ImproperlyConfigured) if the env var is missing.

Runs settings import in a subprocess rather than the current process,
since Django settings are meant to be configured once per process and an
in-process reload would corrupt the rest of the test suite.
"""

import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class SecretKeyConfigTests(SimpleTestCase):
    def _run_django_setup(self, env_overrides):
        env = os.environ.copy()
        env.pop("DJANGO_SECRET_KEY", None)
        env["DJANGO_SETTINGS_MODULE"] = "config.settings"
        env.update(env_overrides)
        return subprocess.run(
            [sys.executable, "-c", "import django; django.setup()"],
            cwd=str(BACKEND_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_missing_secret_key_raises_improperly_configured(self):
        result = self._run_django_setup({})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)
        self.assertIn("ImproperlyConfigured", result.stderr)

    def test_present_secret_key_still_starts_up(self):
        result = self._run_django_setup({"DJANGO_SECRET_KEY": "test-key-for-subprocess-check"})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_no_hardcoded_fallback_string_in_source(self):
        content = (BACKEND_DIR / "config" / "settings.py").read_text()
        self.assertNotIn("django-insecure", content)
