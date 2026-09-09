from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache
from django.utils import timezone

from .models import Conversation, ConversationParticipant, Message
from .serializers import MessageSerializer

# Safety-net TTL for the online marker — refreshed on every 'ping' from the
# client and on connect/disconnect. A missed disconnect (dead connection with
# no clean close frame) self-heals once this expires, rather than leaving a
# user stuck "online" forever.
ONLINE_TTL = 90


def _online_count_key(user_id):
    return f"chat:online_count:{user_id}"


def _mark_connect(user_id):
    """Increments this user's live-connection count. Returns True the first
    time a user goes from 0 -> 1 connections (i.e. they just came online)."""
    key = _online_count_key(user_id)
    cache.add(key, 0, timeout=ONLINE_TTL)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=ONLINE_TTL)
        count = 1
    cache.touch(key, ONLINE_TTL)
    return count == 1


def _mark_disconnect(user_id):
    """Decrements the connection count. Returns True once it reaches zero
    (i.e. the user's last tab/device just disconnected)."""
    key = _online_count_key(user_id)
    try:
        count = cache.decr(key)
    except ValueError:
        return True
    if count <= 0:
        cache.delete(key)
        return True
    cache.touch(key, ONLINE_TTL)
    return False


def is_user_online(user_id):
    return cache.get(_online_count_key(user_id), 0) > 0


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.user = user
        self.user_group = f"chat_user_{user.id}"
        self.conversation_groups = []

        await self.channel_layer.group_add(self.user_group, self.channel_name)
        for cid in await self._get_conversation_ids():
            group = f"chat_conversation_{cid}"
            self.conversation_groups.append(group)
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        became_online = await sync_to_async(_mark_connect)(self.user.id)
        if became_online:
            await self._broadcast_presence(True)

    async def disconnect(self, code):
        user = getattr(self, "user", None)
        if not user:
            return
        await self.channel_layer.group_discard(self.user_group, self.channel_name)
        for group in self.conversation_groups:
            await self.channel_layer.group_discard(group, self.channel_name)
        became_offline = await sync_to_async(_mark_disconnect)(user.id)
        if became_offline:
            await self._broadcast_presence(False)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get("type")
        if msg_type == "ping":
            await sync_to_async(cache.touch)(_online_count_key(self.user.id), ONLINE_TTL)
        elif msg_type == "message.send":
            await self._handle_send(content)
        elif msg_type == "typing":
            await self._handle_typing(content)
        elif msg_type == "read":
            await self._handle_read(content)

    # ── client → server ──────────────────────────────────────────────────
    async def _handle_send(self, content):
        conversation_id = content.get("conversation_id")
        body = (content.get("body") or "").strip()
        if not conversation_id or not body:
            return
        message = await self._create_message(conversation_id, body)
        if message is None:
            return  # not a participant in that conversation
        data = await database_sync_to_async(lambda: MessageSerializer(message).data)()
        await self.channel_layer.group_send(
            f"chat_conversation_{conversation_id}",
            {"type": "chat.message", "message": data},
        )

    async def _handle_typing(self, content):
        conversation_id = content.get("conversation_id")
        if not conversation_id:
            return
        await self.channel_layer.group_send(
            f"chat_conversation_{conversation_id}",
            {
                "type": "chat.typing",
                "conversation_id": conversation_id,
                "user_id": self.user.id,
                "is_typing": bool(content.get("is_typing")),
            },
        )

    async def _handle_read(self, content):
        conversation_id = content.get("conversation_id")
        if not conversation_id:
            return
        last_read_at = await self._mark_read(conversation_id)
        if last_read_at is None:
            return
        await self.channel_layer.group_send(
            f"chat_conversation_{conversation_id}",
            {
                "type": "chat.read",
                "conversation_id": conversation_id,
                "user_id": self.user.id,
                "last_read_at": last_read_at.isoformat(),
            },
        )

    async def _broadcast_presence(self, online):
        for group in self.conversation_groups:
            await self.channel_layer.group_send(
                group, {"type": "chat.presence", "user_id": self.user.id, "online": online}
            )

    # ── server → client (channel layer group handlers) ──────────────────
    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def chat_typing(self, event):
        if event["user_id"] == self.user.id:
            return
        await self.send_json({
            "type": "typing",
            "conversation_id": event["conversation_id"],
            "user_id": event["user_id"],
            "is_typing": event["is_typing"],
        })

    async def chat_read(self, event):
        await self.send_json({
            "type": "read",
            "conversation_id": event["conversation_id"],
            "user_id": event["user_id"],
            "last_read_at": event["last_read_at"],
        })

    async def chat_presence(self, event):
        if event["user_id"] == self.user.id:
            return
        await self.send_json({
            "type": "presence",
            "user_id": event["user_id"],
            "online": event["online"],
        })

    async def chat_conversation_new(self, event):
        # A new conversation was created including this user — join its group
        # immediately so subsequent messages arrive without a reconnect.
        conversation = event["conversation"]
        group = f"chat_conversation_{conversation['id']}"
        if group not in self.conversation_groups:
            self.conversation_groups.append(group)
            await self.channel_layer.group_add(group, self.channel_name)
        await self.send_json({"type": "conversation_new", "conversation": conversation})

    # ── DB helpers ────────────────────────────────────────────────────────
    @database_sync_to_async
    def _get_conversation_ids(self):
        return list(
            ConversationParticipant.objects.filter(user=self.user).values_list(
                "conversation_id", flat=True
            )
        )

    @database_sync_to_async
    def _create_message(self, conversation_id, body):
        if not ConversationParticipant.objects.filter(
            conversation_id=conversation_id, user=self.user
        ).exists():
            return None
        message = Message.objects.create(
            conversation_id=conversation_id, sender=self.user, body=body
        )
        Conversation.objects.filter(pk=conversation_id).update(updated_at=timezone.now())
        return message

    @database_sync_to_async
    def _mark_read(self, conversation_id):
        membership = ConversationParticipant.objects.filter(
            conversation_id=conversation_id, user=self.user
        ).first()
        if not membership:
            return None
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_at"])
        return membership.last_read_at
