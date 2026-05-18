from django.test import TestCase
from django.contrib.auth.models import User
from ..models import Profile, Role


class RBACTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user("admin", password="test1234")
        Profile.objects.create(user=self.admin_user, role=Role.PSC_ADMIN)

        self.officer_user = User.objects.create_user("officer", password="test1234")
        Profile.objects.create(user=self.officer_user, role=Role.PSC_OFFICER)

        self.ministry_user = User.objects.create_user("ministry", password="test1234")
        Profile.objects.create(user=self.ministry_user, role=Role.MINISTRY_HR)

        self.anon = User.objects.create_user("anon", password="test1234")
        # no profile

    def _get_perm(self, user, perm_code):
        from ..rbac import rbac_user_has_permission
        return rbac_user_has_permission(user, perm_code)

    # ── Admin has all permissions ─────────────────────────────────────────
    def test_admin_can_manage_users(self):
        from ..rbac import rbac_user_can_manage_users
        self.assertTrue(rbac_user_can_manage_users(self.admin_user))

    def test_admin_can_manage_roles(self):
        from ..rbac import rbac_user_can_manage_roles
        self.assertTrue(rbac_user_can_manage_roles(self.admin_user))

    def test_admin_can_view_audit_log(self):
        from ..rbac import rbac_user_can_view_audit_log
        self.assertTrue(rbac_user_can_view_audit_log(self.admin_user))

    # ── Officer lacks admin permissions ─────────────────────────────────
    def test_officer_cannot_manage_users(self):
        from ..rbac import rbac_user_can_manage_users
        self.assertFalse(rbac_user_can_manage_users(self.officer_user))

    def test_officer_cannot_manage_roles(self):
        from ..rbac import rbac_user_can_manage_roles
        self.assertFalse(rbac_user_can_manage_roles(self.officer_user))

    # ── User without profile ─────────────────────────────────────────────
    def test_user_without_profile_cannot_manage_users(self):
        from ..rbac import rbac_user_can_manage_users
        self.assertFalse(rbac_user_can_manage_users(self.anon))

    # ── Ministry user permissions ─────────────────────────────────────────
    def test_ministry_user_cannot_manage_users(self):
        from ..rbac import rbac_user_can_manage_users
        self.assertFalse(rbac_user_can_manage_users(self.ministry_user))

    # ── Superuser bypass ─────────────────────────────────────────────────
    def test_superuser_can_manage_users(self):
        from ..rbac import rbac_user_can_manage_users
        su = User.objects.create_superuser("super", email="s@s.com", password="admin123")
        self.assertTrue(rbac_user_can_manage_users(su))

    def test_unauthenticated_user_cannot_manage_users(self):
        from django.contrib.auth.models import AnonymousUser
        from ..rbac import rbac_user_can_manage_users
        self.assertFalse(rbac_user_can_manage_users(AnonymousUser()))

    # ── Profile access (HasProfilePermission equivalent) ──────────────────
    def test_user_with_profile_has_profile(self):
        self.assertTrue(hasattr(self.admin_user, 'psc_profile'))

    def test_user_without_profile_has_no_profile(self):
        self.assertFalse(hasattr(self.anon, 'psc_profile'))

    # ── Ministry / department scoping ─────────────────────────────────────
    def test_ministry_user_has_ministry_role(self):
        self.assertEqual(self.ministry_user.psc_profile.role, Role.MINISTRY_HR)

    def test_officer_has_officer_role(self):
        self.assertEqual(self.officer_user.psc_profile.role, Role.PSC_OFFICER)
