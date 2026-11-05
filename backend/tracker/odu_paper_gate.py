"""What ODU must have in place before the restructure Commission paper leaves the drafter.

The Commission reads ODU's paper, not the ministry's request. Three analyses sit behind
it - DSSPAC, GRT and Finance. ODU attaches each full analysis to the submission as a
required document and summarises each one in the paper itself, so the paper is complete
only when all three attachments and all three summaries are there.
"""

from __future__ import annotations

ANALYSES = (
    # (required-document name, paper field, label)
    ("DSSPAC Analysis", "dsspac_summary", "DSSPAC"),
    ("GRT Analysis", "grt_summary", "GRT"),
    ("Finance Analysis", "finance_summary", "Finance"),
)


def paper_gaps(paper) -> list[str]:
    """Plain-English list of what is still missing, empty when the paper may go on."""
    from .models import SubmissionDocument

    submission = paper.submission
    attached = set(
        SubmissionDocument.objects.filter(
            submission=submission, archived_at__isnull=True,
            required_document__name__in=[a[0] for a in ANALYSES],
        ).values_list("required_document__name", flat=True)
    )
    gaps = []
    for doc_name, field, label in ANALYSES:
        if doc_name not in attached:
            gaps.append(f"attach the {label} analysis")
        if not (getattr(paper, field, "") or "").strip():
            gaps.append(f"summarise the {label} analysis in the paper")
    return gaps


def gap_message(paper) -> str:
    gaps = paper_gaps(paper)
    if not gaps:
        return ""
    return "Before this paper can go on, " + "; ".join(gaps) + "."
