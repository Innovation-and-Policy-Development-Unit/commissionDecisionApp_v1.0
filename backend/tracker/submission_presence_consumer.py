"""WebSocket consumer for the submission-detail 'who's viewing this' bar.

Replaces the old 30s HTTP-heartbeat polling with a push model: the channel
layer broadcasts a fresh viewer list to everyone on the submission the
moment someone joins or leaves. Connection accounting mirrors
chat_consumers.ChatConsumer so a user with several tabs open on the same
submission only drops off the list once their last tab disconnects.
"""
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .submission_presence import (
    clear_presence,
    mark_connect,
    mark_disconnect,
    refresh_connection,
    serialize_viewers,
    touch_presence,
)


class SubmissionPresenceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        try:
            self.submission_id = int(self.scope["url_route"]["kwargs"]["submission_id"])
        except (KeyError, TypeError, ValueError):
            await self.close(code=4404)
            return
        if not await database_sync_to_async(self._can_view)(user, self.submission_id):
            await self.close(code=4403)
            return

        self.user = user
        self.group = f"submission_presence_{self.submission_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        await sync_to_async(touch_presence)(submission_id=self.submission_id, user=user)
        became_online = await sync_to_async(mark_connect)(
            submission_id=self.submission_id, user_id=user.id,
        )
        await self.send_json({"type": "viewers", "viewers": await self._viewers()})
        if became_online:
            # Skip echoing back to this exact channel — it just got the
            # current list directly above.
            await self.channel_layer.group_send(
                self.group, {"type": "presence.viewers", "origin_channel": self.channel_name},
            )

    async def disconnect(self, code):
        user = getattr(self, "user", None)
        if not user:
            return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        became_offline = await sync_to_async(mark_disconnect)(
            submission_id=self.submission_id, user_id=user.id,
        )
        if became_offline:
            await sync_to_async(clear_presence)(
                submission_id=self.submission_id, user_id=user.id,
            )
            await self.channel_layer.group_send(self.group, {"type": "presence.viewers"})

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await sync_to_async(touch_presence)(submission_id=self.submission_id, user=self.user)
            await sync_to_async(refresh_connection)(
                submission_id=self.submission_id, user_id=self.user.id,
            )

    # ── server → client (channel layer group handler) ───────────────────
    async def presence_viewers(self, event):
        if event.get("origin_channel") == self.channel_name:
            return
        # Each recipient gets a freshly-serialized list tailored to its own
        # is_self flag rather than a single shared payload.
        await self.send_json({"type": "viewers", "viewers": await self._viewers()})

    async def _viewers(self):
        return await database_sync_to_async(serialize_viewers)(
            submission_id=self.submission_id, current_user_id=self.user.id,
        )

    @staticmethod
    def _can_view(user, submission_id):
        from .views import _submission_queryset_for
        return _submission_queryset_for(user).filter(pk=submission_id).exists()
