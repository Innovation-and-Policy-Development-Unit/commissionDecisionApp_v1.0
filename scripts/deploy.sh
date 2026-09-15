#!/bin/sh
# Rebuild and restart SCDMS, then prune the images/build cache the rebuild
# just made obsolete. Every deploy previously left its old image layers
# behind with nothing clearing them, which ran the VM's root disk from
# ~50% to 81% used over time (2026-09 incident) before anyone noticed.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILES="-f docker-compose.yml"
if [ "${SCDMS_ENV:-prod}" = "prod" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
fi

sh scripts/sync-locale-bundles.sh

# Prune before building too, not just after: a build needs its own scratch
# space for pulled layers, and on a nearly-full disk that can fail before
# the post-deploy prune ever runs. Safe at this point — currently-running
# containers still reference the current images, so those survive.
echo "Pruning unused Docker images and build cache before build..."
docker image prune -af
docker builder prune -f

docker compose $COMPOSE_FILES build
docker compose $COMPOSE_FILES up -d

# Run only after `up -d` has switched containers onto the new images, so
# the just-replaced old images are no longer in use and safe to remove.
echo "Pruning unused Docker images and build cache..."
docker image prune -af
docker builder prune -f

echo "Deploy complete."
docker compose $COMPOSE_FILES ps
