#!/usr/bin/env bash
# Renawi Motors restore: loads a database dump made by backup.sh (replacing the target database)
# and, optionally, the matching uploads archive (replacing the uploads folder).
#
#   restore.sh [options] <db-YYYYMMDD-HHMM.dump> [uploads-YYYYMMDD-HHMM.tgz]
#   restore.sh --list
#
# Run it through the "restore" tool service, which mounts the uploads volume read-write:
#   docker compose run --rm restore --list
#   docker compose stop api
#   docker compose run --rm restore db-20261112-0230.dump uploads-20261112-0230.tgz
#   docker compose start api
#
# Options:
#   --list             list the backups on this server and in the bucket, then exit
#   --yes              do not ask for confirmation
#   --db NAME          restore into database NAME instead of $PGDATABASE (created if missing);
#                      use a scratch name such as renawi_restore_test for a rehearsal
#   --uploads-dir DIR  extract the uploads archive into DIR instead of $UPLOADS_DIR
#   -h, --help         this help
#
# A file argument is a path, or a file name in $BACKUP_DIR. A name that is not there is
# downloaded from the bucket (S3_* settings, prefix S3_PREFIX) first.
set -Eeuo pipefail

# The comment block at the top of this file.
usage() { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; }
# Messages go to stderr: resolve_file runs in $(...) and must not capture them.
log() { printf '%s [restore] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

BACKUP_DIR=${BACKUP_DIR:-/backups}
UPLOADS_DIR=${UPLOADS_DIR:-/data/uploads}
# Owner of the uploaded files: the `node` user of the API image.
UPLOADS_UID=${UPLOADS_UID:-1000}
UPLOADS_GID=${UPLOADS_GID:-1000}
S3_PREFIX=${S3_PREFIX:-renawi/}
[[ -z "$S3_PREFIX" || "$S3_PREFIX" == */ ]] || S3_PREFIX="${S3_PREFIX}/"
S3_PREFIX=${S3_PREFIX#/}

remote_ready() {
  [[ -n "${S3_BUCKET:-}" && -n "${S3_ENDPOINT:-}" && -n "${S3_ACCESS_KEY:-}" && -n "${S3_SECRET_KEY:-}" ]] || return 1
  export RCLONE_CONFIG_REMOTE_TYPE=s3
  export RCLONE_CONFIG_REMOTE_PROVIDER="${S3_PROVIDER:-Other}"
  export RCLONE_CONFIG_REMOTE_ENDPOINT="$S3_ENDPOINT"
  export RCLONE_CONFIG_REMOTE_REGION="${S3_REGION:-}"
  export RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  export RCLONE_CONFIG_REMOTE_ENV_AUTH=false
  export RCLONE_CONFIG_REMOTE_NO_CHECK_BUCKET=true
}

list_backups() {
  echo "On this server (${BACKUP_DIR}):"
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tgz' \) \
    -exec du -h {} + 2> /dev/null | sort -k2 | awk '{printf "    %-34s %s\n", substr($2, length(d) + 2), $1}' d="$BACKUP_DIR"
  if remote_ready; then
    echo "In the bucket (s3:${S3_BUCKET}/${S3_PREFIX}):"
    rclone lsl "remote:${S3_BUCKET}/${S3_PREFIX}" --max-depth 1 \
      --include '/db-*.dump' --include '/uploads-*.tgz' \
      | sort -k4 | awk '{printf "    %-34s %8.1f MB  %s %s\n", $4, $1 / 1048576, $2, substr($3, 1, 5)}'
  else
    echo "Bucket: not configured (S3_BUCKET / S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY)."
  fi
}

assume_yes=false
target_db=${PGDATABASE:-}
uploads_target=$UPLOADS_DIR
args=()
while (($#)); do
  case "$1" in
    --list) list_backups; exit 0 ;;
    --yes | -y) assume_yes=true ;;
    --db) [[ $# -ge 2 ]] || die "--db needs a name"; target_db=$2; shift ;;
    --db=*) target_db=${1#--db=} ;;
    --uploads-dir) [[ $# -ge 2 ]] || die "--uploads-dir needs a folder"; uploads_target=$2; shift ;;
    --uploads-dir=*) uploads_target=${1#--uploads-dir=} ;;
    -h | --help) usage; exit 0 ;;
    -*) usage >&2; exit 2 ;;
    *) args+=("$1") ;;
  esac
  shift
done
((${#args[@]} >= 1 && ${#args[@]} <= 2)) || { usage >&2; exit 2; }

for v in PGHOST PGUSER PGPASSWORD; do
  [[ -n "${!v:-}" ]] || die "${v} is not set"
done
[[ -n "$target_db" ]] || die "no target database (set PGDATABASE or pass --db)"
[[ "$target_db" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "invalid database name: ${target_db}"

# Prints the local path of a backup file, downloading it from the bucket when needed.
resolve_file() {
  local arg=$1 name
  if [[ -f "$arg" ]]; then printf '%s\n' "$arg"; return; fi
  name=$(basename -- "$arg")
  if [[ -f "${BACKUP_DIR}/${name}" ]]; then printf '%s\n' "${BACKUP_DIR}/${name}"; return; fi
  remote_ready || die "${arg} not found (not a path, not in ${BACKUP_DIR}, and S3 is not configured)"
  log "downloading ${name} from s3:${S3_BUCKET}/${S3_PREFIX}"
  mkdir -p "$BACKUP_DIR"
  rclone copyto "remote:${S3_BUCKET}/${S3_PREFIX}${name}" "${BACKUP_DIR}/${name}" --retries 3 >&2
  # rclone exits 0 when the object does not exist.
  [[ -f "${BACKUP_DIR}/${name}" ]] \
    || die "${name} is not in s3:${S3_BUCKET}/${S3_PREFIX} (see: docker compose run --rm restore --list)"
  printf '%s\n' "${BACKUP_DIR}/${name}"
}

dump=$(resolve_file "${args[0]}")
uploads_archive=""
if ((${#args[@]} == 2)); then uploads_archive=$(resolve_file "${args[1]}"); fi

log "checking ${dump}"
toc=$(pg_restore --list "$dump") || die "${dump} is not a readable pg_dump archive"
if [[ -n "$uploads_archive" ]]; then
  log "checking ${uploads_archive}"
  tar -tzf "$uploads_archive" > /dev/null || die "${uploads_archive} is not a readable .tgz archive"
fi

psql_admin() { psql -X -v ON_ERROR_STOP=1 -d postgres -tA "$@"; }
exists=$(psql_admin -c "SELECT count(*) FROM pg_database WHERE datname = '${target_db}'")
sessions=0
if [[ "$exists" == "1" ]]; then
  sessions=$(psql_admin -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '${target_db}' AND pid <> pg_backend_pid()")
fi

echo
echo "  Database : ${target_db} on ${PGHOST} ($([[ "$exists" == "1" ]] && echo "EXISTS - will be DROPPED and recreated" || echo "new"))"
echo "  From     : ${dump}"
if [[ -n "$uploads_archive" ]]; then
  echo "  Uploads  : ${uploads_target} (current contents will be DELETED) <- ${uploads_archive}"
else
  echo "  Uploads  : not restored (no archive given)"
fi
if [[ "$sessions" != "0" ]]; then
  echo "  WARNING  : ${sessions} open connection(s) to ${target_db} will be terminated."
  echo "             Stop the API first: docker compose stop api"
fi
echo
if ! $assume_yes; then
  [[ -t 0 ]] || die "not a terminal: pass --yes to restore without confirmation"
  read -r -p "Type 'yes' to continue: " answer
  [[ "$answer" == "yes" ]] || die "cancelled"
fi

started=$(date +%s)

# ---- Database ------------------------------------------------------------------------------------
log "recreating database ${target_db}"
dropdb --if-exists --force --maintenance-db=postgres "$target_db"
createdb --maintenance-db=postgres --owner="$PGUSER" --template=template0 --encoding=UTF8 "$target_db"
# A dump of a database whose public schema was recreated (e.g. by `prisma migrate reset`) contains
# CREATE SCHEMA public; the fresh database already has one.
if grep -qE '^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public ' <<< "$toc"; then
  psql -X -v ON_ERROR_STOP=1 -q -d "$target_db" -c 'DROP SCHEMA public CASCADE'
fi
log "restoring ${dump}"
pg_restore --dbname="$target_db" --no-owner --no-privileges --exit-on-error --jobs=2 "$dump"

# ---- Uploads -------------------------------------------------------------------------------------
if [[ -n "$uploads_archive" ]]; then
  mkdir -p "$uploads_target"
  log "replacing the contents of ${uploads_target}"
  find "$uploads_target" -mindepth 1 -delete
  tar -xzf "$uploads_archive" -C "$uploads_target"
  chown -R "${UPLOADS_UID}:${UPLOADS_GID}" "$uploads_target"
  log "uploads restored: $(find "$uploads_target" -type f | wc -l) files"
fi

# ---- Summary -------------------------------------------------------------------------------------
log "row counts in ${target_db}:"
for table in _prisma_migrations User Settings Contact Vehicle TaxiLicense Driver LeaseContract LedgerEntry Deal Document; do
  count=$(psql -X -tA -d "$target_db" -c "SELECT count(*) FROM \"${table}\"" 2> /dev/null || echo "n/a")
  printf '    %-20s %s\n' "$table" "$count"
done
log "done in $(($(date +%s) - started)) s"
if [[ "$target_db" == "${PGDATABASE:-}" ]]; then
  log "next: docker compose start api   (then sign in and check a few records and documents)"
fi
