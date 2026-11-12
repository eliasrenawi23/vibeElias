# syntax=docker/dockerfile:1.7
#
# Renawi Motors backup sidecar: nightly pg_dump + uploads archive, copied to an S3-compatible
# bucket (Backblaze B2) with rclone; also the restore tool. Build context = deploy/backup:
#
#   docker build -t renawi-backup deploy/backup
#
# The schedule lives in `crontab` (02:30 Asia/Jerusalem); BACKUP_CRON overrides it at start.

ARG ALPINE_IMAGE=alpine:3.22
FROM ${ALPINE_IMAGE}

# postgresql17-client matches the postgres:17 server (pg_dump refuses newer servers).
RUN apk add --no-cache bash ca-certificates curl postgresql17-client rclone tzdata \
 && touch /etc/rclone.conf

COPY --chmod=0755 backup.sh restore.sh entrypoint.sh /usr/local/bin/
COPY --chmod=0644 crontab /etc/crontabs/root

# rclone gets its remote ("remote:") from RCLONE_CONFIG_REMOTE_* variables set by the scripts;
# the empty config file only keeps it from looking for ~/.config/rclone.
ENV TZ=Asia/Jerusalem \
    RCLONE_CONFIG=/etc/rclone.conf \
    BACKUP_DIR=/backups \
    UPLOADS_DIR=/data/uploads \
    BACKUP_STATUS_FILE=/data/backup/last-success.json

# /data/uploads is not created here: an image folder would be copied (root-owned) into a new
# uploads volume. Compose mounts it; docker-compose.prod.yml's volume-init sets its owner.
RUN mkdir -p /backups /data/backup

HEALTHCHECK --interval=1m --timeout=5s --retries=3 CMD pgrep crond > /dev/null || exit 1

ENTRYPOINT ["entrypoint.sh"]
CMD ["crond", "-f", "-l", "6"]
