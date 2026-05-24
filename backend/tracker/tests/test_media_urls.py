"""Public media URL helper."""
from django.test import RequestFactory, SimpleTestCase, override_settings

from tracker.media_urls import public_media_url


class _FakeField:
    def __init__(self, url):
        self.url = url


class PublicMediaUrlTests(SimpleTestCase):
  @override_settings(MEDIA_URL="https://scdms-api.onrender.com/media/")
  def test_absolute_media_url_when_cdp_configured(self):
    url = public_media_url(_FakeField("/media/profile_pics/test.png"))
    self.assertEqual(url, "https://scdms-api.onrender.com/media/profile_pics/test.png")

  def test_build_absolute_uri_with_request(self):
    request = RequestFactory().get("/api/me/")
    url = public_media_url(_FakeField("/media/profile_pics/a.png"), request)
    self.assertTrue(url.endswith("/media/profile_pics/a.png"))
    self.assertIn("http", url)
