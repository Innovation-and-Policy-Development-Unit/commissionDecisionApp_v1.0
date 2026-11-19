"""Keep agenda numbers right whenever an agenda item is added, changed or removed."""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import AgendaItem, Meeting


def _renumber(meeting_id):
    from .agenda_document import renumber_agenda

    try:
        renumber_agenda(Meeting.objects.get(pk=meeting_id))
    except Meeting.DoesNotExist:
        pass  # the sitting itself is being deleted


@receiver(post_save, sender=AgendaItem)
def agenda_item_saved(sender, instance, created, update_fields=None, **kwargs):
    if kwargs.get("raw"):
        return
    if update_fields is not None and set(update_fields) <= {"agenda_no"}:
        return
    _renumber(instance.meeting_id)


@receiver(post_delete, sender=AgendaItem)
def agenda_item_deleted(sender, instance, **kwargs):
    _renumber(instance.meeting_id)
