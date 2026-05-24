"""Public media URL helper."""
from django.test import RequestFactory, SimpleTestCase, override_settings

from tracker.media_urls import public_media_url


class _FakeField:
    def __init__(self, url, name=None):
        self.url = url
        self.name = name or url.replace("/media/", "").lstrip("/")


class PublicMediaUrlTests(SimpleTestCase):
    @override_settings(MEDIA_URL="https://scdms-api.onrender.com/media/")
    def test_absolute_media_url_when_cdp_configured_no_request(self):
        url = public_media_url(_FakeField("/media/profile_pics/test.png", "profile_pics/test.png"))
        self.assertEqual(url, "https://scdms-api.onrender.com/media/profile_pics/test.png")

    def test_build_absolute_uri_with_request(self):
        request = RequestFactory().get("/api/me/", HTTP_HOST="localhost:8080")
        url = public_media_url(
            _FakeField("http://localhost:8000/media/profile_pics/a.png", "profile_pics/a.png"),
            request,
        )
        self.assertEqual(url, "http://localhost:8080/media/profile_pics/a.png")

    @override_settings(MEDIA_URL="http://localhost:8000/media/")
    def test_relative_path_when_no_request_and_relative_media_url(self):
        url = public_media_url(_FakeField("/media/profile_pics/x.jpg", "profile_pics/x.jpg"))
        self.assertEqual(url, "/media/profile_pics/x.jpg")
