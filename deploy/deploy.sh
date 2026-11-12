#!/usr/bin/env bash
# Deploys (or rolls back) Renawi Motors on the server: pulls the images, recreates the
# containers that changed, waits until everything is healthy, then removes dangling images.
# Run on the server as the deploy user (GitHub Actions runs it over SSH after every release):
#
#   cd /opt/renawi
#   bash deploy/deploy.sh                 deploy IMAGE_TAG from .env (latest by default)
#   bash deploy/deploy.sh sha-1a2b3c4     pin IMAGE_TAG=sha-1a2b3c4 in .env, then deploy
#                                         (this is also how you roll back to an older release)
#   bash deploy/deploy.sh latest          follow the newest images again
#
# Compose files come from COMPOSE_FILE in .env (docker-compose.prod.yml; add
# docker-compose.build.yml to build on the server - then `git pull` first).
# Environment: APP_DIR (default: the folder above this script), HEALTH_TIMEOUT (seconds, 300),
# KEEP_RELEASES (images of older releases kept for rollbacks, 3), PRUNE_IMAGES (true).
set -Eeuo pipefail

log() { printf '%s [deploy] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

APP_DIR=${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-300}
cd "$APP_DIR"
[[ -f .env ]] || die "no .env in ${APP_DIR} (cp .env.production.example .env, then edit it)"
command -v docker > /dev/null || die "docker is not installed (run deploy/provision.sh)"
if [[ -z "${COMPOSE_FILE:-}" ]] && ! grep -qE '^COMPOSE_FILE=' .env; then
  export COMPOSE_FILE=docker-compose.prod.yml
fi

# One deploy at a time.
exec 9> /tmp/renawi-deploy.lock
flock -n 9 || die "another deploy is running"

# ---- Optional tag argument: pin it in .env so later `docker compose` commands agree -----------
if (($# > 1)); then die "usage: deploy.sh [image-tag]"; fi
if (($# == 1)); then
  tag=$1
  [[ "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || die "invalid image tag: ${tag}"
  if grep -qE '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${tag}/" .env
  else
    printf '\nIMAGE_TAG=%s\n' "$tag" >> .env
  fi
  log "IMAGE_TAG=${tag} written to .env"
fi
tag=$(grep -E '^IMAGE_TAG=' .env | tail -n 1 | cut -d= -f2- | tr -d "\"' ")
log "deploying ${APP_DIR} (COMPOSE_FILE=${COMPOSE_FILE:-from .env}, tag ${tag:-latest})"

# Fail early on a broken .env / compose file (missing required variables, typos).
docker compose config --quiet

# ---- Pull, then (re)create ----------------------------------------------------------------------
# Images with a build section (docker-compose.build.yml) are built instead of pulled.
docker compose pull --ignore-buildable --quiet
docker compose up -d --build --remove-orphans

# ---- Wait for health ----------------------------------------------------------------------------
health_of() {
  local id
  id=$(docker compose ps -q "$1" 2> /dev/null | head -n 1)
  [[ -n "$id" ]] || { echo "missing"; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

services=(postgres api web backup)
deadline=$((SECONDS + HEALTH_TIMEOUT))
while :; do
  pending=()
  for s in "${services[@]}"; do
    state=$(health_of "$s")
    [[ "$state" == "healthy" ]] || pending+=("${s}=${state}")
  done
  ((${#pending[@]} == 0)) && break
  if ((SECONDS >= deadline)); then
    log "not healthy after ${HEALTH_TIMEOUT} s: ${pending[*]}"
    docker compose ps
    docker compose logs --tail 80 api web
    die "deploy failed - fix the cause or roll back: bash deploy/deploy.sh <previous tag>"
  fi
  sleep 5
done

# End to end through nginx: the app answers and the API reaches the database.
health=$(docker compose exec -T web wget -q -O - http://127.0.0.1/api/health) \
  || die "GET /api/health through nginx failed"
[[ "$health" == *'"db":"up"'* ]] || die "API reports the database down: ${health}"
log "healthy: ${health}"

# ---- Clean up -------------------------------------------------------------------------------------
# Dangling layers, then all but the newest KEEP_RELEASES releases of each image (kept locally
# for quick rollbacks; images in use are never removed). PRUNE_IMAGES=false skips this.
keep=${KEEP_RELEASES:-3}
prefix=$(grep -E '^IMAGE_PREFIX=' .env | tail -n 1 | cut -d= -f2- | tr -d "\"' ")
if [[ "${PRUNE_IMAGES:-true}" == "true" ]]; then
  docker image prune -f > /dev/null
else
  prefix=""
fi
if [[ -n "$prefix" && "$keep" =~ ^[0-9]+$ ]]; then
  for repo in renawi-api renawi-web renawi-backup; do
    # Newest first; several tags (latest, sha-...) can share one image ID.
    docker image ls "${prefix}/${repo}" --format '{{.ID}} {{.Repository}}:{{.Tag}}' \
      | awk -v k="$keep" '!seen[$1]++ { n++ } n > k && $2 !~ /:<none>$/ { print $2 }' \
      | while read -r ref; do
          if docker image rm "$ref" > /dev/null 2>&1; then log "removed old image ${ref}"; fi
        done
  done
fi
docker compose images
log "done"
