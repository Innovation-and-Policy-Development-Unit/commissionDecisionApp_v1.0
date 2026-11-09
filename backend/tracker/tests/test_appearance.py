"""Appearance: a user's own choices, the organisation default, and who may set it."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..appearance_views import FACTORY_DEFAULT
from ..models import Profile, Role


def _user(name, role):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role)
    return u


def _client(u):
    c = APIClient()
    c.force_authenticate(user=u)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AppearanceTests(TestCase):
    def setUp(self):
        self.admin = _user("ap_admin", Role.PSC_ADMIN)
        self.hr = _user("ap_hr", Role.MINISTRY_HR)

    def test_a_new_user_gets_the_factory_default_and_no_choices_of_their_own(self):
        data = _client(self.hr).get("/api/appearance/").data
        self.assertEqual(data["org"], FACTORY_DEFAULT)
        self.assertEqual(data["user"], {})
        self.assertFalse(data["can_set_org"])

    def test_a_user_saves_their_own_choices_and_they_follow_them(self):
        res = _client(self.hr).put("/api/appearance/me/", {"preset": "violet", "mode": "system", "fontSize": "large"}, format="json")
        self.assertEqual(res.data["user"], {"preset": "violet", "mode": "system", "fontSize": "large"})
        again = _client(self.hr).get("/api/appearance/").data  # as if from another device
        self.assertEqual(again["user"]["preset"], "violet")

    def test_unknown_settings_and_values_are_dropped(self):
        res = _client(self.hr).put("/api/appearance/me/", {"preset": "hot-pink", "mode": "dark", "evil": "<script>", "font": 5}, format="json")
        self.assertEqual(res.data["user"], {"mode": "dark"})

    def test_an_empty_save_goes_back_to_the_organisation_default(self):
        _client(self.hr).put("/api/appearance/me/", {"preset": "rose"}, format="json")
        res = _client(self.hr).put("/api/appearance/me/", {}, format="json")
        self.assertEqual(res.data["user"], {})

    def test_only_an_administrator_sets_the_organisation_default(self):
        self.assertEqual(_client(self.hr).put("/api/appearance/org/", {"preset": "teal"}, format="json").status_code, 403)
        res = _client(self.admin).put("/api/appearance/org/", {"preset": "teal", "density": "compact"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["org"]["preset"], "teal")
        self.assertTrue(res.data["can_set_org"])
        seen_by_hr = _client(self.hr).get("/api/appearance/").data
        self.assertEqual((seen_by_hr["org"]["preset"], seen_by_hr["org"]["density"]), ("teal", "compact"))
        self.assertEqual(seen_by_hr["org"]["corners"], "default")  # anything not set keeps the factory value

    def test_it_needs_a_login(self):
        self.assertEqual(APIClient().get("/api/appearance/").status_code, 401)
