# Restoring Renawi Motors from a backup

What the backups contain, how to get data back after a mistake or after losing the server, and a
quarterly rehearsal so you know it works before you need it. Setup of the backups:
[deploy.md, section 10](deploy.md#10-off-site-backups-backblaze-b2).

## What is backed up

Every night at 02:30 Israel time the `backup` container writes two files, named by date and time:

| File                        | Contents                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `db-YYYYMMDD-HHMM.dump`     | The whole database (PostgreSQL custom format): vehicles, drivers, contracts, ledger, deals, settings, users, audit log. |
| `uploads-YYYYMMDD-HHMM.tgz` | Every uploaded document and photo and every generated PDF (the files the database points to).                           |

The newest 7 nights stay on the server in `/opt/renawi/backups`; 30 days are kept in the B2
bucket under `renawi/` (only when `S3_BUCKET` is set: **Settings → Backup** shows whether the last
backup was copied off the server). **Not** in the backup: `/opt/renawi/.env` (keep it in your password
manager) and the HTTPS certificates (Caddy simply gets new ones).

A database dump and an uploads archive with the same time stamp belong together. Restore both, or
documents uploaded after the dump will be missing from the database (and vice versa).

## Before you start

- Work on the server as `deploy`, in `/opt/renawi`.
- See which backups exist (server and bucket):

  ```bash
  docker compose run --rm restore --list
  ```

- A restore **replaces** the current database and documents. Anything entered after the backup's
  time is lost, so first take a fresh backup of the current state if it may still be useful:
  `docker compose exec backup backup.sh --now`.
- The restore asks you to type `yes`; `--yes` skips the question.

## A. Restore on the same server (mistake, corrupted data)

```bash
cd /opt/renawi
docker compose run --rm restore --list                         # pick a time stamp
docker compose stop api                                        # nobody writes while restoring
docker compose run --rm restore db-20261112-0230.dump uploads-20261112-0230.tgz
docker compose start api
```

The tool checks both files, shows what will be replaced, asks for `yes`, recreates the database,
loads the dump, replaces the documents and prints row counts (users, vehicles, drivers, contracts,
ledger entries, deals, documents). Files that are only in the bucket are downloaded first.

Then sign in and check a few records you know, open a document and a generated PDF, and look at
**Settings → Backup**.

## B. Restore on a new server (server lost or replaced)

1. Create and prepare a new server: [deploy.md](deploy.md) sections 3, 5 and 6. Use the **same
   `.env`** from your password manager (above all the same `S3_*` values; `POSTGRES_PASSWORD` and the
   JWT secrets may also be new values).
2. Start only the database and find the backup in the bucket:

   ```bash
   cd /opt/renawi
   docker login ghcr.io -u <github-user>          # if the images are private (deploy.md section 7)
   docker compose pull
   docker compose up -d postgres
   docker compose run --rm restore --list
   ```

3. Restore (the files are downloaded from the bucket):

   ```bash
   docker compose run --rm restore db-20261112-0230.dump uploads-20261112-0230.tgz
   ```

4. Start everything: `bash deploy/deploy.sh`. The API applies any database migrations newer than
   the backup on start.
5. Point the domain's A record at the new IP (deploy.md section 4) and wait for the certificate
   (`docker compose logs caddy`).
6. Check as in A, and update the `VPS_HOST` secret in GitHub.

## C. Getting back one record or one document

Restore into a **separate** database and folder (the live system is not touched), look up what
you need, then copy it by hand in the app:

```bash
docker compose run --rm restore --db renawi_lookup --uploads-dir /backups/lookup \
  db-20261110-0230.dump uploads-20261110-0230.tgz
docker compose exec postgres psql -U renawi -d renawi_lookup     # \q to quit
```

The extracted files are in `/opt/renawi/backups/lookup/<yyyy>/<mm>/` on the server (download with
`scp`); the `Document` table maps them to records (`fileKey`, `fileName`, `vehicleId`,
`driverId`, ...). Clean up afterwards:

```bash
docker compose exec postgres dropdb -U renawi renawi_lookup
sudo rm -r /opt/renawi/backups/lookup
```

## Without the restore tool

The files are standard formats. On any machine with PostgreSQL 17 client tools:
`pg_restore --no-owner --no-privileges -d <empty database> db-....dump`, and
`tar -xzf uploads-....tgz -C <folder>` for the documents (the API expects them under its
`UPLOAD_DIR`, owned by uid 1000). Downloading from B2 works in the B2 web console too.

## Quarterly restore rehearsal

Takes about 15 minutes; do it every three months and after big changes. It restores the newest
**bucket** backup into a scratch database and folder on the production server, so the live
system is not touched.

- [ ] `docker compose run --rm restore --list`: last night's files are in the bucket, sizes look
      normal (similar to previous nights, not tiny).
- [ ] Settings → Backup in the app shows last night's time and **Off-site copy: Yes** (an amber
      "local backups only" warning means the bucket is not set up: nothing below would work).
- [ ] Remove the local copies of that night so the files really come from the bucket:
      `sudo rm /opt/renawi/backups/db-<stamp>.dump /opt/renawi/backups/uploads-<stamp>.tgz`
- [ ] Restore into scratch:

      ```bash
      docker compose run --rm restore --yes --db renawi_restore_test \
        --uploads-dir /backups/restore-test db-<stamp>.dump uploads-<stamp>.tgz
      ```

- [ ] Compare the printed row counts with the live database:

      ```bash
      for db in renawi renawi_restore_test; do
        docker compose exec -T postgres psql -U renawi -d "$db" -tAc \
          'SELECT (SELECT count(*) FROM "Vehicle"), (SELECT count(*) FROM "LedgerEntry"), (SELECT count(*) FROM "Document")'
      done
      ```

      They match, or the live numbers are only higher by what was entered today.

- [ ] Number of files: `sudo find /opt/renawi/backups/restore-test -type f | wc -l` is close to
      `docker compose exec api find /data/uploads -type f | wc -l`.
- [ ] Open one restored PDF from `/opt/renawi/backups/restore-test` (download with `scp`).
- [ ] Clean up: `docker compose exec postgres dropdb -U renawi renawi_restore_test` and
      `sudo rm -r /opt/renawi/backups/restore-test`; run `docker compose exec backup backup.sh --now`
      to put tonight's local copy back.
- [ ] Write down the date, the backup used, the time it took and any problem.
- [ ] Once a year: rehearse section B on a temporary Hetzner server (a few cents per hour),
      then delete that server.

For developers: the API end-to-end suite can run against a restored copy to prove the schema is
intact (`TEST_DATABASE_URL` pointing at a database whose name contains `test`, e.g.
`renawi_restore_test`; the suite erases that copy's data).
