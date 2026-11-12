# Security of the Renawi Motors server

What is already protected, what you as the owner must do, how to change secrets, and a note on
the personal data the system holds. Setup: [deploy.md](deploy.md); backups: [restore.md](restore.md).

## What is hardened

**Server** (`deploy/provision.sh`)

- SSH with keys only: password login and root login are off; only the `deploy` user may log in.
- Firewall (ufw) open only for SSH (22), HTTP (80, redirect and certificates) and HTTPS (443);
  optionally a Hetzner Cloud Firewall in front with the same rules.
- fail2ban bans an address for an hour after 5 failed SSH logins in 10 minutes.
- Automatic Ubuntu security updates, with a reboot at 03:00 UTC when an update needs one.
- Docker from Docker's official repository; container logs are rotated (10 MB × 5 per container).

**Network and containers** (`docker-compose.prod.yml`)

- Only Caddy is reachable from the internet. The database has no published port and sits on a
  separate Docker network that Caddy and nginx are not attached to.
- HTTPS everywhere with automatically renewed certificates; HTTP redirects to HTTPS; HSTS tells
  browsers to use HTTPS only.
- The API runs as an unprivileged user; containers cannot gain new privileges; each has a memory
  limit so one runaway process cannot take the whole server down.
- The backup container mounts the documents read-only.

**Web and API**

- Security headers on every response: Content-Security-Policy (only the site's own scripts, no
  framing), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`; the server version is hidden.
- Passwords are stored as argon2id hashes. Sessions are short-lived (15 minutes) access cookies
  plus a rotating refresh cookie (30 days), `HttpOnly`, `Secure`, `SameSite=Lax`; every change request
  needs the `X-Requested-With` header (protection against cross-site requests).
- Sign-in is limited to 10 attempts per minute per address.
- Uploads: only PDF, JPEG, PNG and WebP, checked by file content, at most 20 MB; files are served
  only to signed-in users. API responses are not cached by browsers or proxies.
- Every create, change and delete of core records is written to the audit log.

**Backups**

- Nightly, off-site (Backblaze B2), private bucket with encryption at rest, with an application
  key that can reach only that bucket. 7 nights on the server, 30 days in the bucket.

**Secrets**

- Runtime secrets exist only in `/opt/renawi/.env` (mode 600). GitHub holds only the SSH key that
  can log in as `deploy`; the images in GHCR contain code, no data or secrets.

## What you must do

- [ ] Use a long, unique admin password (16+ random characters) kept in a password manager;
      never reuse it elsewhere. Sign out on shared computers.
- [ ] Keep `.env` private: never e-mail it, never commit it, keep one copy in the password
      manager. Anyone with it can read the database and the backups.
- [ ] Protect your SSH private key with a passphrase; do not copy it to other computers. If a
      laptop is lost, remove its key from `/home/deploy/.ssh/authorized_keys`.
- [ ] Give GitHub write access only to people you trust: whoever can change `main` and run the
      Deploy workflow can run code on the server.
- [ ] Turn on two-factor authentication for GitHub, Hetzner, Backblaze and your domain
      registrar (domain hijacking redirects your users).
- [ ] Do the quarterly restore rehearsal ([restore.md](restore.md)) and watch Settings → Backup
      (or the Healthchecks.io e-mails).
- [ ] When someone stops working with you, change the passwords and keys they knew (below).

## Changing secrets

All on the server in `/opt/renawi`, then check that the site works.

**Admin password**: in the app, user menu → **My account** → **Change password** (needs the
current password; every other device of that user is signed out). When it is forgotten: put the
new password in `ADMIN_PASSWORD` in `.env`, run
`docker compose run --rm admin node create-admin.cjs --reset-password` (signs out all of that
user's sessions), then remove the line again.

**JWT secrets** (after a suspected leak of `.env`, or yearly): generate two new values with
`openssl rand -base64 48`, replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`, run
`docker compose up -d api`. Every user is signed out and signs in again; nothing else changes.

**Database password** (`POSTGRES_PASSWORD` only applies when the database is first created, so
change it inside PostgreSQL too):

```bash
new=$(openssl rand -hex 32)
docker compose exec postgres psql -U renawi -d renawi -c "ALTER USER renawi PASSWORD '$new'"
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$new/" .env
docker compose up -d api backup
```

**Backblaze key**: create a new application key for the bucket, put it in `S3_ACCESS_KEY` /
`S3_SECRET_KEY`, `docker compose up -d backup`, run `docker compose exec backup backup.sh --now`,
then delete the old key in Backblaze.

**GitHub deploy key**: create a new pair (deploy.md section 11), add the new public key to
`authorized_keys`, update the `VPS_SSH_KEY` secret, run Deploy once, then remove the old public
key line from `authorized_keys`.

## Personal data

The system stores personal data of drivers, customers, sellers and leads: names, Israeli ID
numbers, phone numbers and addresses, driving-licence, permit and medical expiry dates, balances
and payments, and scans or photos of identity cards, licences and signed contracts. In Israel the
Protection of Privacy Law and its Data Security Regulations apply to a database like this (the
2025 amendment raised the penalties). This is not legal advice; ask your lawyer or accountant
which duties apply to your business. In practice:

- Upload only documents you actually need, and delete scans that are no longer needed (e.g. after
  a contract ended and the retention period your accountant requires has passed).
- Keep the number of people with an account, server access or `.env` as small as possible.
- Backups contain the same personal data: keep the bucket private and the B2 keys secret; deleted
  data disappears from the backups after 30 days.
- If you suspect a breach (lost laptop with the SSH key, leaked `.env`, unknown sign-ins in the
  audit log): change the secrets above, check the audit log, and get advice on whether you must
  report it.

## Known limits

- No two-factor sign-in, and no "forgot password" e-mail: a forgotten password is reset with the
  admin tool above (a known one is changed under **My account**).
- The API documentation (Swagger) at `/api/docs` is public; it shows the API's shape but every
  call needs a sign-in. To hide it, add `location ^~ /api/docs { return 404; }` to
  `deploy/nginx.conf` and rebuild the web image.
- One server: if it fails, the app is down until it is restored from backup (restore.md, B).
  Backups are encrypted at rest by Backblaze, not before upload.
