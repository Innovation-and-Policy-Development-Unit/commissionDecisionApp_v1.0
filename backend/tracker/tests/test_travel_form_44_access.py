"""PSC Form 4.4 — directors/DG only; staff use 4.5/4.6 or ministry-only processes."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Department, FormCategory, Ministry, Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TravelForm44AccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST", name="Test Ministry")
        self.department = Department.objects.create(
            ministry=self.ministry, code="BIO", name="Biosecurity",
        )
        FormCategory.objects.create(code="TRAVEL", name="Travel", display_order=1)
        self.received_at = timezone.now().isoformat()

        self.traveller = User.objects.create_user("traveller", password="pass12345!")
        Profile.objects.create(
            user=self.traveller,
            role=Role.TRAVELLER,
            ministry=self.ministry,
            department=self.department,
        )

        self.hr = User.objects.create_user("ministryhr", password="pass12345!")
        Profile.objects.create(
            user=self.hr,
            role=Role.MINISTRY_HR,
            ministry=self.ministry,
        )

        self.director = User.objects.create_user("director", password="pass12345!")
        Profile.objects.create(
            user=self.director,
            role=Role.HEAD_OF_AGENCY,
            ministry=self.ministry,
            department=self.department,
        )

        self.dg = User.objects.create_user("dg", password="pass12345!")
        Profile.objects.create(
            user=self.dg,
            role=Role.HEAD_OF_AGENCY,
            ministry=self.ministry,
        )

    def _post_travel(self, user, form_type_code, **extra):
        self.client.force_authenticate(user=user)
        payload = {
            "title": "Travel test",
            "form_type_code": form_type_code,
            "received_at": self.received_at,
            "travel_endorsers": {},
            **extra,
        }
        return self.client.post("/api/submissions/", payload, format="json")

    def test_traveller_cannot_create_form_44(self):
        resp = self._post_travel(self.traveller, "PSC 4.4")
        self.assertEqual(resp.status_code, 403)

    def test_traveller_can_create_form_45(self):
        resp = self._post_travel(self.traveller, "PSC 4.5")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.json().get("secretary_only"))

    def test_ministry_hr_cannot_create_form_44(self):
        resp = self._post_travel(self.hr, "PSC 4.4")
        self.assertEqual(resp.status_code, 403)

    def test_dept_director_can_create_form_44(self):
        resp = self._post_travel(self.director, "PSC4.4", department=self.department.id)
        self.assertEqual(resp.status_code, 201, resp.content)
        data = resp.json()
        self.assertTrue(data.get("secretary_only"))
        self.assertEqual(data.get("form_type_code"), "PSC 4.4")

    def test_ministry_dg_can_create_form_44(self):
        resp = self._post_travel(self.dg, "PSC 4.4")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.json().get("secretary_only"))
