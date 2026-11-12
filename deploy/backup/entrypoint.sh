#!/usr/bin/env bash
# Entrypoint of the backup sidecar. Saves the container environment for the cron job (crond
# starts jobs with a reduced environment), applies BACKUP_CRON if set, then runs the command
# (crond in the foreground by default).
set -Eeuo pipefail

ENV_FILE=/run/renawi-backup.env

umask 077
export -p > "$ENV_FILE"

if [[ -n "${BACKUP_CRON:-}" ]]; then
  # Five cron fields, e.g. "30 2 * * *".
  read -r -a fields <<< "$BACKUP_CRON"
  if [[ ${#fields[@]} -ne 5 ]]; then
    echo "entrypoint: BACKUP_CRON must have 5 fields (got: '$BACKUP_CRON')" >&2
    exit 1
  fi
  printf '%s /usr/local/bin/backup.sh --cron > /proc/1/fd/1 2> /proc/1/fd/2\n' \
    "$BACKUP_CRON" > /etc/crontabs/root
fi

schedule=$(grep -v '^[[:space:]]*#' /etc/crontabs/root | grep -m1 'backup.sh' | cut -d' ' -f1-5)
if [[ -n "${S3_BUCKET:-}" ]]; then
  target="local + s3:${S3_BUCKET}/${S3_PREFIX:-renawi/}"
else
  target="local only (S3_BUCKET is empty)"
fi
echo "$(date '+%Y-%m-%d %H:%M:%S %Z') [backup] sidecar ready: schedule '${schedule}' (TZ=${TZ:-UTC}), target ${target}"

exec "$@"
