"""P1-09 (SCDMS Pre-Production Readiness Audit — Findings Register): the
Role Definitions admin UI lets an admin toggle permissions like
transition_workflow/create_submission that no code path actually consults —
the submission lifecycle is governed entirely by hardcoded role checks in
transitions.py. SystemPermission.is_enforced makes that gap visible instead
of silently misleading.

P1-10: 5 of 33 defined roles (traveller, secretary_opsc, dg_director,
commission_member, panel_member) were never seeded a RoleDefinition."""

from django.core.management import call_command
from django.test import TestCase

from ..models import Role, RoleDefinition, SystemPermission


class RoleDefinitionCoverageTests(TestCase):
    """P1-10."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_tracker")

    def test_every_role_has_a_role_definition(self):
        seeded_roles = set(RoleDefinition.objects.values_list("role", flat=True))
        all_roles = {choice.value for choice in Role}
        missing = all_roles - seeded_roles
        self.assertEqual(missing, set(), f"Roles with no RoleDefinition: {missing}")

    def test_previously_missing_roles_now_seeded(self):
        for role in (
            Role.TRAVELLER, Role.SECRETARY_OPSC, Role.DG_DIRECTOR,
            Role.COMMISSION_MEMBER, Role.PANEL_MEMBER,
        ):
            self.assertTrue(
                RoleDefinition.objects.filter(role=role).exists(),
                f"{role} still has no RoleDefinition",
            )

    def test_traveller_can_create_submissions(self):
        """Grounded in transitions.py/opsc_access.py's real handling of this
        role — not an invented permission."""
        rd = RoleDefinition.objects.get(role=Role.TRAVELLER)
        self.assertTrue(rd.permissions.filter(code="create_submission").exists())


class SystemPermissionEnforcementTests(TestCase):
    """P1-09."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_tracker")

    def test_transition_workflow_is_marked_unenforced(self):
        """The clearest case: transitions.py never consults this code at all,
        despite it being toggleable per-role in the admin UI."""
        perm = SystemPermission.objects.get(code="transition_workflow")
        self.assertFalse(perm.is_enforced)

    def test_view_submissions_is_marked_enforced(self):
        """Contrast case — this one genuinely is consulted (views.py)."""
        perm = SystemPermission.objects.get(code="view_submissions")
        self.assertTrue(perm.is_enforced)

    def test_allocate_decision_is_marked_enforced(self):
        perm = SystemPermission.objects.get(code="allocate_decision")
        self.assertTrue(perm.is_enforced)

    def test_reseeding_does_not_flip_enforced_flags(self):
        """seed_tracker is idempotent and re-runs on every container start —
        confirm it doesn't drift the is_enforced computation on repeat runs."""
        call_command("seed_tracker")
        perm = SystemPermission.objects.get(code="transition_workflow")
        self.assertFalse(perm.is_enforced)
        perm2 = SystemPermission.objects.get(code="view_submissions")
        self.assertTrue(perm2.is_enforced)
