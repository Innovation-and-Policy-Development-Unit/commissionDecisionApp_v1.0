#!/usr/bin/env bash
# Deployment-verification smoke test for P0-01 (SCDMS Pre-Production Readiness
# Audit — Findings Register): confidential submission documents must never be
# reachable via the direct /media/ static path — only through the
# authenticated /api/submissions/{id}/documents/{doc_id}/ endpoint, which
# applies the same RBAC scoping as the rest of the submission API.
#
# This has no Django-test-suite equivalent because the vulnerability was
# entirely at the nginx layer, invisible to any test that goes through
# Django's own test client. Run this after every deploy that touches nginx
# config, and ideally wire it into CI once one exists (see the audit's
# enhancement roadmap).
#
# Usage: ./scripts/verify-media-auth.sh [base_url]
#   base_url defaults to https://127.0.0.1 (run from the host, against the
#   locally running web container).

set -euo pipefail

BASE_URL="${1:-https://127.0.0.1}"
CURL_OPTS=(-sk -o /dev/null -w "%{http_code}")
FAIL=0

echo "Verifying media-serving access control against: $BASE_URL"

# 1. Submission documents must be denied outright, unauthenticated, for any
#    path under the prefix -- no file needs to exist for this to matter,
#    since the fix is a blanket `deny all` on the whole subtree.
status=$(curl "${CURL_OPTS[@]}" "$BASE_URL/media/submission_documents/1/whatever.pdf")
if [ "$status" = "403" ]; then
    echo "  [OK] /media/submission_documents/... correctly denied (403)"
else
    echo "  [FAIL] /media/submission_documents/... returned $status, expected 403"
    echo "         Confidential documents may be directly downloadable without authentication."
    FAIL=1
fi

# 2. The general /media/ location must still be reachable for legitimate,
#    non-sensitive content (profile pictures, signatures) -- confirms the
#    fix is scoped to submission_documents/ and didn't break media serving
#    wholesale. A 404 for a nonexistent file proves the location block is
#    still active and evaluating normally (a fully broken/misconfigured
#    block would typically 500 or fail to route at all).
status=$(curl "${CURL_OPTS[@]}" "$BASE_URL/media/profile_pics/__verify_media_auth_nonexistent__.jpg")
if [ "$status" = "404" ]; then
    echo "  [OK] /media/... (non-submission-document path) still serves normally (404 for missing file)"
else
    echo "  [FAIL] /media/... (non-submission-document path) returned $status, expected 404"
    echo "         The general media location may be broken, not just the submission-documents fix."
    FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
    echo "PASS: media access control verified."
    exit 0
else
    echo "FAIL: media access control regression detected."
    exit 1
fi
