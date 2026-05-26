"""Dynamic form payload validation against Form Builder field definitions."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tracker.dynamic_form_validation import validate_dynamic_form_data
from tracker.models import (
    FormCategory,
    Ministry,
    PSCFormField,
    PSCFormType,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)


class ValidateDynamicFormDataTests(TestCase):
    def setUp(self):
        cat = FormCategory.objects.create(code="HR", name="HR", display_order=1)
        self.form_type = PSCFormType.objects.create(
            code="PSC 3.6",
            name="Appointment",
            category=cat,
            is_active=True,
            is_digitized=True,
        )
        PSCFormField.objects.create(
            form_type=self.form_type,
            label="Salary step",
            field_key="salary_step_code",
            field_type="text",
            is_required=True,
            display_order=1,
        )

    def test_rejects_unknown_field_key(self):
        errors = validate_dynamic_form_data(
            self.form_type, {"salary_step_code": "G5", "bogus_key": "x"}
        )
        self.assertEqual(len(errors), 1)
        self.assertIn("bogus_key", errors[0])
        self.assertIn("PSC 3.6", errors[0])

    def test_requires_configured_fields(self):
        errors = validate_dynamic_form_data(self.form_type, {})
        self.assertTrue(any("salary_step_code" in e and "required" in e for e in errors))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DynamicFormApiValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cat = FormCategory.objects.create(code="HR", name="HR", display_order=1)
        self.form_type = PSCFormType.objects.create(
            code="PSC 3.6",
            name="Appointment",
            category=cat,
            is_active=True,
            is_digitized=True,
        )
        PSCFormField.objects.create(
            form_type=self.form_type,
            label="Salary step",
            field_key="salary_step_code",
            field_type="text",
            is_required=False,
            display_order=1,
        )
        self.ministry = Ministry.objects.create(code="TST", name="Test Ministry")
        user = User.objects.create_user("ministryhr", password="pass12345!")
        Profile.objects.create(user=user, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.user = user
        self.submission = Submission.objects.create(
            title="Test",
            ministry=self.ministry,
            form_type_code="PSC 3.6",
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=user,
        )

    def test_dynamic_form_post_returns_400_for_invalid_keys(self):
        self.client.force_authenticate(user=self.user)
        url = f"/api/submissions/{self.submission.pk}/dynamic-form/"
        resp = self.client.post(
            url,
            {"form_type": self.form_type.pk, "data": {"not_a_field": "x"}},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dynamic_form", resp.data)
        self.assertTrue(
            any("not_a_field" in msg for msg in resp.data["dynamic_form"])
        )
