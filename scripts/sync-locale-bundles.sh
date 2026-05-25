#!/bin/sh
# Copy frontend i18n JSON into backend/locale_bundles for Docker (backend-only context).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backend/locale_bundles"
cp "$ROOT/frontend/src/i18n/locales/"*.json "$ROOT/backend/locale_bundles/"
echo "Synced locale bundles to backend/locale_bundles/"
