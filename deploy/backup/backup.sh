#!/usr/bin/env bash
# Renawi Motors backup: PostgreSQL dump + uploads archive -> local folder (newest N kept) ->
# S3-compatible bucket (older than BACKUP_RETENTION_DAYS deleted) -> status file read by
# GET /api/settings/backup-status.
#
#   backup.sh --now     run a backup now (by hand: docker compose exec backup backup.sh --now)
#   backup.sh --cron    the same, started by crond (loads the saved container environment)
#
# Environment (see .env.production.example):
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE    database to dump
#   S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY [S3_PREFIX=renawi/] [S3_PROVIDER=Other]
#                                                 empty S3_BUCKET = local backups only
#   BACKUP_RETENTION_DAYS=30  BACKUP_LOCAL_KEEP=7  HEALTHCHECK_PING_URL (optional)
#   BACKUP_DIR=/backups  UPLOADS_DIR=/data/uploads  BACKUP_STATUS_FILE=/data/backup/last-success.json
#
# Exit status 0 = backup complete (status file written, success ping sent); non-zero = failed
# (nothing written to the status file, "/fail" ping sent).
set -Eeuo pipefail

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:---now}" in
  --now | --cron) ;;
  -h | --help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

# crond starts jobs with a reduced environment: load what the entrypoint saved.
ENV_FILE=/run/renawi-backup.env
if [[ -z "${PGHOST:-}" && -r "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

BACKUP_DIR=${BACKUP_DIR:-/backups}
UPLOADS_DIR=${UPLOADS_DIR:-/data/uploads}
STATUS_FILE=${BACKUP_STATUS_FILE:-/data/backup/last-success.json}
LOCAL_KEEP=${BACKUP_LOCAL_KEEP:-7}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
PING_URL=${HEALTHCHECK_PING_URL:-}
S3_PREFIX=${S3_PREFIX:-renawi/}
[[ -z "$S3_PREFIX" || "$S3_PREFIX" == */ ]] || S3_PREFIX="${S3_PREFIX}/"
S3_PREFIX=${S3_PREFIX#/}

log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"; }

# Healthchecks.io-style ping: <url>, <url>/start, <url>/fail (optional body).
ping_hc() {
  [[ -n "$PING_URL" ]] || return 0
  local suffix=$1 body=${2:-}
  curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$body" "${PING_URL%/}${suffix}" \
    || log "warning: healthcheck ping ${suffix:-/} failed"
}

human_size() { du -h "$1" | cut -f1; }

PARTIALS=()
on_error() {
  local rc=$? line=$1
  trap - ERR
  log "FAILED (exit ${rc} at line ${line}); the status file was not updated"
  if ((${#PARTIALS[@]})); then rm -f -- "${PARTIALS[@]}"; fi
  ping_hc /fail "Renawi backup failed on $(hostname) (exit ${rc} at line ${line})"
  exit "$rc"
}
trap 'on_error $LINENO' ERR

for n in "$LOCAL_KEEP" "$RETENTION_DAYS"; do
  [[ "$n" =~ ^[0-9]+$ && "$n" -ge 1 ]] || { log "BACKUP_LOCAL_KEEP / BACKUP_RETENTION_DAYS must be positive integers"; false; }
done
for v in PGHOST PGUSER PGPASSWORD PGDATABASE; do
  [[ -n "${!v:-}" ]] || { log "${v} is not set"; false; }
done
[[ -d "$UPLOADS_DIR" ]] || { log "uploads folder ${UPLOADS_DIR} is missing"; false; }
mkdir -p "$BACKUP_DIR"

# One backup at a time (a manual run during the nightly one waits for nothing: it fails).
exec 9> "${BACKUP_DIR}/.backup.lock"
flock -n 9 || { log "another backup is running"; false; }

STAMP=$(date '+%Y%m%d-%H%M')
DB_FILE="db-${STAMP}.dump"
UP_FILE="uploads-${STAMP}.tgz"
started=$(date +%s)
log "starting (${1:---now}): ${PGDATABASE}@${PGHOST} and ${UPLOADS_DIR} -> ${BACKUP_DIR}"
ping_hc /start

# ---- 1. Database ------------------------------------------------------------------------------
PARTIALS+=("${BACKUP_DIR}/${DB_FILE}.partial")
pg_dump --format=custom --compress=6 --file="${BACKUP_DIR}/${DB_FILE}.partial"
# A readable table of contents proves the archive is complete.
pg_restore --list "${BACKUP_DIR}/${DB_FILE}.partial" > /dev/null
mv -f "${BACKUP_DIR}/${DB_FILE}.partial" "${BACKUP_DIR}/${DB_FILE}"
log "database dump ${DB_FILE} ($(human_size "${BACKUP_DIR}/${DB_FILE}"))"

# ---- 2. Uploaded documents ---------------------------------------------------------------------
PARTIALS+=("${BACKUP_DIR}/${UP_FILE}.partial")
tar -czf "${BACKUP_DIR}/${UP_FILE}.partial" -C "$UPLOADS_DIR" .
tar -tzf "${BACKUP_DIR}/${UP_FILE}.partial" > /dev/null
mv -f "${BACKUP_DIR}/${UP_FILE}.partial" "${BACKUP_DIR}/${UP_FILE}"
files=$(find "$UPLOADS_DIR" -type f | wc -l)
log "uploads archive ${UP_FILE} ($(human_size "${BACKUP_DIR}/${UP_FILE}"), ${files} files)"
PARTIALS=()

# ---- 3. Off-site copy ----------------------------------------------------------------------------
offsite="none"
if [[ -n "${S3_BUCKET:-}" ]]; then
  for v in S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY; do
    [[ -n "${!v:-}" ]] || { log "${v} is not set (needed because S3_BUCKET is set)"; false; }
  done
  export RCLONE_CONFIG_REMOTE_TYPE=s3
  export RCLONE_CONFIG_REMOTE_PROVIDER="${S3_PROVIDER:-Other}"
  export RCLONE_CONFIG_REMOTE_ENDPOINT="$S3_ENDPOINT"
  export RCLONE_CONFIG_REMOTE_REGION="${S3_REGION:-}"
  export RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export RCLONE_CONFIG_REMOTE_ENV_AUTH=false
  # Bucket-scoped keys (B2 application keys) may not list or create buckets.
  export RCLONE_CONFIG_REMOTE_NO_CHECK_BUCKET=true
  dest="remote:${S3_BUCKET}/${S3_PREFIX}"
  rclone copy "$BACKUP_DIR" "$dest" --include "/${DB_FILE}" --include "/${UP_FILE}" \
    --retries 3 --low-level-retries 10 --stats-one-line --stats 0
  # rclone verifies size and checksum while copying; make sure both objects are listed.
  listed=$(rclone lsf "$dest" --include "/${DB_FILE}" --include "/${UP_FILE}" | wc -l)
  [[ "$listed" -eq 2 ]] || { log "uploaded files not found in ${dest}"; false; }
  log "copied to s3:${S3_BUCKET}/${S3_PREFIX}"
  rclone delete "$dest" --min-age "${RETENTION_DAYS}d" \
    --include "/db-*.dump" --include "/uploads-*.tgz" --retries 3
  log "removed bucket copies older than ${RETENTION_DAYS} days"
  offsite="s3:${S3_BUCKET}/${S3_PREFIX}"
else
  log "S3_BUCKET is empty: LOCAL BACKUP ONLY - nothing was copied off this server"
fi

# ---- 4. Local retention ------------------------------------------------------------------------
# File names sort chronologically; keep the newest LOCAL_KEEP of each kind.
for pattern in 'db-*.dump' 'uploads-*.tgz'; do
  mapfile -t all < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$pattern" | sort)
  excess=$((${#all[@]} - LOCAL_KEEP))
  if ((excess > 0)); then
    rm -f -- "${all[@]:0:excess}"
    log "removed ${excess} old local file(s) (${pattern})"
  fi
done

# ---- 5. Status for the app (shape read by apps/api/src/settings/backup-status.ts) -----------------
mkdir -p "$(dirname "$STATUS_FILE")"
printf '{"lastSuccessAt":"%s","lastFile":"%s"}\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$DB_FILE" \
  > "${STATUS_FILE}.tmp"
chmod 0644 "${STATUS_FILE}.tmp"
mv -f "${STATUS_FILE}.tmp" "$STATUS_FILE"

summary="done in $(($(date +%s) - started)) s: ${DB_FILE} + ${UP_FILE}, off-site: ${offsite}, free on ${BACKUP_DIR}: $(df -h "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
log "$summary"
ping_hc "" "$summary"
