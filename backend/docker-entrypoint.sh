#!/bin/sh
set -e
# If Compose/docker run passes a command (e.g. `python manage.py migrate`), run only that and exit.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Ensure security log directory exists (NCSS 2030 — centralised audit logging)
mkdir -p /var/log/scdms 2>/dev/null || true

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR:-/var/backups/scdms}" 2>/dev/null || true

# Ensure media directory exists and is writable (screenshots, uploads)
mkdir -p "${MEDIA_ROOT:-/var/scdms/media}" 2>/dev/null || true

python manage.py migrate --noinput
if [ "${AUTO_SEED:-1}" != "0" ]; then
  # Idempotent: reference data every start; dummy submissions only when none exist.
  python manage.py seed_tracker || echo "seed_tracker finished with warnings (non-fatal)"
fi
exec python manage.py runserver 0.0.0.0:8000
