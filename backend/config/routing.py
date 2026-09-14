from django.urls import re_path

from tracker.chat_consumers import ChatConsumer
from tracker.submission_presence_consumer import SubmissionPresenceConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/$", ChatConsumer.as_asgi()),
    re_path(
        r"^ws/submissions/(?P<submission_id>\d+)/presence/$",
        SubmissionPresenceConsumer.as_asgi(),
    ),
]
