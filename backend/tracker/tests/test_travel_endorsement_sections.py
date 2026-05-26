"""PSC 4.5 / 4.6 endorsement chains by initiator type."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from tracker.models import Department, Ministry, Profile, Role, Submission, WorkflowStage
from tracker.travel_forms import (
    default_head_position_title,
    endorsement_sections,
    ministry_dg_endorsement_label,
    needs_department_director_endorsement,
)


class TravelEndorsementSectionTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST", name="Test Ministry")
        self.department = Department.objects.create(
            ministry=self.ministry, code="BIO", name="Biosecurity",
        )

    def _submission_for(self, user, **extra):
        return Submission.objects.create(
            title="Travel",
            ministry=self.ministry,
            form_type_code="PSC 4.5",
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=user,
            **extra,
        )

    def test_biosecurity_head_label(self):
        self.assertEqual(
            default_head_position_title(self.department),
            "Director, Biosecurity",
        )

    def test_statistics_chief_statistician_label(self):
        vbo = Department.objects.create(
            ministry=self.ministry,
            code="VNSO",
            name="Vanuatu Bureau of Statistics",
            head_position_title="Chief Statistician",
        )
        self.assertEqual(default_head_position_title(vbo), "Chief Statistician")

    def test_dg_label_includes_ministry(self):
        user = User.objects.create_user("trav", password="x")
        Profile.objects.create(
            user=user, role=Role.TRAVELLER,
            ministry=self.ministry, department=self.department,
        )
        sub = self._submission_for(user, department=self.department)
        self.assertIn(self.ministry.name, ministry_dg_endorsement_label(sub))

    def test_traveller_requires_director_and_dg(self):
        user = User.objects.create_user("traveller", password="x")
        Profile.objects.create(
            user=user, role=Role.TRAVELLER,
            ministry=self.ministry, department=self.department,
        )
        sub = self._submission_for(user, department=self.department)
        keys = [s["key"] for s in endorsement_sections("PSC 4.5", sub)]
        self.assertEqual(keys, ["director_signature", "dg_signature"])
        self.assertTrue(needs_department_director_endorsement(sub))

    def test_ministry_csu_hr_requires_dg_only(self):
        user = User.objects.create_user("csuhr", password="x")
        Profile.objects.create(user=user, role=Role.MINISTRY_HR, ministry=self.ministry)
        sub = self._submission_for(user)
        keys = [s["key"] for s in endorsement_sections("PSC 4.6", sub)]
        self.assertEqual(keys, ["dg_signature"])
        self.assertFalse(needs_department_director_endorsement(sub))

    def test_ministry_hr_with_department_requires_director_and_dg(self):
        user = User.objects.create_user("dept_hr", password="x")
        Profile.objects.create(
            user=user, role=Role.MINISTRY_HR,
            ministry=self.ministry, department=self.department,
        )
        sub = self._submission_for(user, department=self.department)
        keys = [s["key"] for s in endorsement_sections("PSC 4.5", sub)]
        self.assertEqual(keys, ["director_signature", "dg_signature"])

    def test_head_of_agency_creator_has_no_ministry_endorsements(self):
        user = User.objects.create_user("dg", password="x")
        Profile.objects.create(user=user, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        sub = self._submission_for(user)
        self.assertEqual(endorsement_sections("PSC 4.5", sub), [])
