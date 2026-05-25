"""Knowledge Base role guides (HR / Unit Manager / Secretary)."""

from django.db import migrations, models


def seed_role_guides(apps, schema_editor):
    from tracker.knowledge_guides import GUIDES_CATEGORY, ROLE_GUIDE_ARTICLES

    KnowledgeCategory = apps.get_model("tracker", "KnowledgeCategory")
    KnowledgeArticle = apps.get_model("tracker", "KnowledgeArticle")

    category, _ = KnowledgeCategory.objects.get_or_create(
        title=GUIDES_CATEGORY["title"],
        defaults={
            "description": GUIDES_CATEGORY["description"],
            "icon_name": GUIDES_CATEGORY["icon_name"],
            "display_order": GUIDES_CATEGORY["display_order"],
        },
    )

    for row in ROLE_GUIDE_ARTICLES:
        KnowledgeArticle.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "category": category,
                "title": row["title"],
                "content": row["content"],
                "content_type": "html_iframe",
                "html_asset": row["html_asset"],
                "allowed_roles": row["allowed_roles"],
                "is_published": True,
                "is_internal": row["is_internal"],
            },
        )


def unseed_role_guides(apps, schema_editor):
    from tracker.knowledge_guides import ROLE_GUIDE_ARTICLES

    KnowledgeArticle = apps.get_model("tracker", "KnowledgeArticle")
    slugs = [row["slug"] for row in ROLE_GUIDE_ARTICLES]
    KnowledgeArticle.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0082_meeting_transcript_pipeline"),
    ]

    operations = [
        migrations.AddField(
            model_name="knowledgearticle",
            name="allowed_roles",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="PSC profile roles allowed to view; empty list = all authenticated users.",
            ),
        ),
        migrations.AddField(
            model_name="knowledgearticle",
            name="content_type",
            field=models.CharField(
                choices=[("markdown", "Markdown"), ("html_iframe", "Embedded HTML guide")],
                default="markdown",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="knowledgearticle",
            name="html_asset",
            field=models.CharField(
                blank=True,
                help_text="Filename under frontend public/guides/ for html_iframe articles.",
                max_length=128,
            ),
        ),
        migrations.AlterField(
            model_name="knowledgearticle",
            name="content",
            field=models.TextField(
                blank=True,
                help_text="Markdown body, or short summary when content_type is html_iframe.",
            ),
        ),
        migrations.RunPython(seed_role_guides, unseed_role_guides),
    ]
