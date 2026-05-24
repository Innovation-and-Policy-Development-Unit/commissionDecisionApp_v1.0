#!/bin/sh
# Production entrypoint for Render / PaaS (Gunicorn + migrate + collectstatic).
set -e
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

mkdir -p /var/log/scdms /var/backups/scdms "${MEDIA_ROOT:-/var/scdms/media}" 2>/dev/null || true

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "${AUTO_SEED:-0}" = "1" ]; then
  python manage.py seed_tracker || echo "seed_tracker finished with warnings (non-fatal)"
fi

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
