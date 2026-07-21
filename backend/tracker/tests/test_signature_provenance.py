from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from ..audit import signing_provenance
from ..models import (
    Department, DocumentSignature, FlyingMinuteSignature, FormCategory,
    Meeting, MeetingType, Ministry, Profile, Role, Submission,
    SubmissionDocument, TrustedSession, WorkflowStage,
)
from ..totp import generate_totp, generate_totp_secret


def _claims(access_token_str):
    return AccessToken(access_token_str)


@override_settings(
    SECURE_SSL_REDIRECT=False,
    ALLOWED_HOSTS=['*'],
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-signature-provenance-login",
        }
    },
)
class LoginClaimTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    @override_settings(TWO_FACTOR_REQUIRED=False)
    def test_password_only_login_carries_password_only_claim(self):
        user = User.objects.create_user("plainuser", password="TestPass123!")
        Profile.objects.create(user=user, role=Role.PSC_OFFICER)
        resp = self.client.post("/api/auth/token/", {"username": "plainuser", "password": "TestPass123!"})
        self.assertEqual(resp.status_code, 200)
        claims = _claims(resp.json()["access"])
        self.assertEqual(claims["auth_method"], "password_only")
        self.assertIsNotNone(claims["trusted_session_id"])
        ts = TrustedSession.objects.get(pk=claims["trusted_session_id"])
        self.assertEqual(ts.user.username, "plainuser")

    def test_totp_login_carries_totp_claim(self):
        user = User.objects.create_user("totpuser", password="TestPass123!")
        secret = generate_totp_secret()
        Profile.objects.create(user=user, role=Role.PSC_OFFICER, totp_secret=secret, two_factor_enabled=True)

        code = generate_totp(secret)
        resp = self.client.post("/api/auth/totp/verify/", {"username": "totpuser", "code": code})
        self.assertEqual(resp.status_code, 200)
        claims = _claims(resp.json()["access"])
        self.assertEqual(claims["auth_method"], "totp")
        ts = TrustedSession.objects.get(pk=claims["trusted_session_id"])
        self.assertEqual(ts.user.username, "totpuser")

    @override_settings(DEMO_MODE=True)
    def test_demo_push_login_carries_push_demo_claim_not_totp(self):
        user = User.objects.create_user("pushuser", password="TestPass123!")
        secret = generate_totp_secret()
        Profile.objects.create(user=user, role=Role.PSC_OFFICER, totp_secret=secret, two_factor_enabled=True)

        resp = self.client.post("/api/auth/totp/verify/", {"username": "pushuser", "push_approved": True})
        self.assertEqual(resp.status_code, 200)
        claims = _claims(resp.json()["access"])
        self.assertEqual(claims["auth_method"], "push_demo")
        self.assertNotEqual(claims["auth_method"], "totp")

    def test_pin_login_carries_pin_claim_and_reuses_existing_session(self):
        user = User.objects.create_user("pinuser", password="TestPass123!")
        profile = Profile.objects.create(
            user=user, role=Role.PSC_OFFICER,
            session_pin=make_password("1234"), session_pin_set_at=timezone.now(),
        )
        ts = TrustedSession.objects.create(
            user=user, expires_at=TrustedSession.compute_expiry(),
            ip_address="127.0.0.1", user_agent="test",
        )

        resp = self.client.post("/api/auth/session-pin/verify/", {"username": "pinuser", "pin": "1234"})
        self.assertEqual(resp.status_code, 200)
        claims = _claims(resp.json()["access"])
        self.assertEqual(claims["auth_method"], "pin")
        self.assertEqual(claims["trusted_session_id"], ts.id)


class SigningProvenanceHelperTests(TestCase):
    def test_returns_blanks_when_no_auth_token(self):
        class FakeRequest:
            auth = None
            META = {"REMOTE_ADDR": "10.0.0.5"}
        result = signing_provenance(FakeRequest())
        self.assertEqual(result["auth_method"], "")
        self.assertIsNone(result["trusted_session_id"])
        self.assertEqual(result["signed_ip"], "10.0.0.5")

    def test_returns_blanks_when_auth_lacks_get_method(self):
        class FakeRequest:
            auth = object()  # e.g. API-key auth's return value — not dict-like
            META = {}
        result = signing_provenance(FakeRequest())
        self.assertEqual(result["auth_method"], "")
        self.assertIsNone(result["trusted_session_id"])

    def test_reads_claims_from_dict_like_token(self):
        class FakeToken:
            def get(self, key, default=None):
                return {"auth_method": "totp", "trusted_session_id": 42}.get(key, default)

        class FakeRequest:
            auth = FakeToken()
            META = {"REMOTE_ADDR": "10.0.0.9"}
        result = signing_provenance(FakeRequest())
        self.assertEqual(result["auth_method"], "totp")
        self.assertEqual(result["trusted_session_id"], 42)
        self.assertEqual(result["signed_ip"], "10.0.0.9")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class DocumentSignatureProvenanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("signer", password="test1234")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        ministry = Ministry.objects.create(code="TESTSIG", name="Ministry of Signing")
        form_cat = FormCategory.objects.create(code="psc_sig", name="PSC Sig")
        self.submission = Submission.objects.create(
            title="Sig test", form_category=form_cat, ministry=ministry,
            received_at=timezone.now(), created_by=self.user,
            current_stage=WorkflowStage.SUBMITTED,
        )
        self.document = SubmissionDocument.objects.create(
            submission=self.submission, document_type="other", file="docs/test.pdf",
        )

    def _fake_auth_headers(self):
        # force_authenticate bypasses JWTAuthentication, so request.auth is None
        # in these tests — signing_provenance must fail safe, which is exactly
        # what's asserted here (new signature, no claims available).
        return {}

    def test_new_signature_gets_provenance_fields_present_but_blank_without_jwt(self):
        resp = self.client.post("/api/doc-signatures/", {
            "document": self.document.id,
            "page_number": 1,
            "signed_date": timezone.now().date().isoformat(),
        })
        self.assertEqual(resp.status_code, 201, resp.content)
        sig = DocumentSignature.objects.get(pk=resp.json()["id"])
        self.assertEqual(sig.auth_method, "")
        self.assertIsNone(sig.trusted_session_id)

    def test_real_totp_session_stamps_correct_provenance_end_to_end(self):
        """Full path: log in via real TOTP, use that access token as the request's
        credentials, create a signature, and confirm the claim actually reached
        the saved row — not just that the helper works in isolation."""
        secret = generate_totp_secret()
        profile = self.user.psc_profile
        profile.totp_secret = secret
        profile.two_factor_enabled = True
        profile.save(update_fields=["totp_secret", "two_factor_enabled"])

        code = generate_totp(secret)
        login_resp = self.client.post("/api/auth/totp/verify/", {"username": "signer", "code": code})
        self.assertEqual(login_resp.status_code, 200, login_resp.content)
        access = login_resp.json()["access"]
        ts_id = _claims(access)["trusted_session_id"]

        authed_client = APIClient()
        authed_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = authed_client.post("/api/doc-signatures/", {
            "document": self.document.id,
            "page_number": 3,
            "signed_date": timezone.now().date().isoformat(),
        })
        self.assertEqual(resp.status_code, 201, resp.content)
        sig = DocumentSignature.objects.get(pk=resp.json()["id"])
        self.assertEqual(sig.auth_method, "totp")
        self.assertEqual(sig.trusted_session_id, ts_id)
        self.assertIsNotNone(sig.signed_ip)

    def test_upsert_resign_also_stamps_provenance_call(self):
        DocumentSignature.objects.create(
            document=self.document, signed_by=self.user,
            signed_date=timezone.now().date(),
        )
        resp = self.client.post("/api/doc-signatures/", {
            "document": self.document.id,
            "page_number": 2,
            "signed_date": timezone.now().date().isoformat(),
        })
        self.assertEqual(resp.status_code, 200, resp.content)
        sig = DocumentSignature.objects.get(document=self.document, signed_by=self.user)
        self.assertEqual(sig.page_number, 2)
        # No crash on the upsert path — provenance kwargs merged cleanly even
        # though force_authenticate means they're blank here.
        self.assertEqual(sig.auth_method, "")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class FlyingMinuteSignatureProvenanceTests(TestCase):
    def test_flying_minute_sign_stamps_provenance_fields_exist(self):
        user = User.objects.create_user("member1", password="test1234")
        Profile.objects.create(user=user, role=Role.PSC_COMMISSIONER)
        meeting = Meeting.objects.create(
            type=MeetingType.FLYING_MINUTE, date=timezone.now().date(), time="09:00",
        )

        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.post(f"/api/meetings/{meeting.id}/flying-minute/sign/", {"decision": "approve"})
        self.assertEqual(resp.status_code, 200, resp.content)

        sig = FlyingMinuteSignature.objects.get(meeting=meeting, member=user)
        self.assertEqual(sig.decision, "approve")
        # force_authenticate → no JWT claims → fields present but blank, not crashed.
        self.assertEqual(sig.auth_method, "")
        self.assertIsNone(sig.trusted_session_id)
