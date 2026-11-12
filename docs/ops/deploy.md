# Deploying Renawi Motors

How to put the system on the internet with HTTPS, nightly off-site backups and one-click updates
from GitHub. Written for the owner; every command is meant to be copied as is. Related:
[restore.md](restore.md) (getting data back), [security.md](security.md) (what is protected and
what you must do), user guides ([English](../user-guide.en.md), [עברית](../user-guide.he.md)).

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [What you need](#2-what-you-need)
3. [Create the server](#3-create-the-server)
4. [Point the domain at the server](#4-point-the-domain-at-the-server)
5. [Prepare the server (`provision.sh`)](#5-prepare-the-server-provisionsh)
6. [Copy the files and write `.env`](#6-copy-the-files-and-write-env)
7. [First start](#7-first-start)
8. [Create the admin user and fill in the business details](#8-create-the-admin-user-and-fill-in-the-business-details)
9. [Check HTTPS](#9-check-https)
10. [Off-site backups (Backblaze B2)](#10-off-site-backups-backblaze-b2)
11. [Deploys from GitHub](#11-deploys-from-github)
12. [Everyday operations](#12-everyday-operations)
13. [Common problems](#13-common-problems)

## 1. How it fits together

One small Linux server runs everything in Docker containers, started by Docker Compose from
`/opt/renawi/docker-compose.prod.yml`:

| Container  | Job                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `caddy`    | The only one reachable from the internet (ports 80/443). Gets and renews the HTTPS certificate automatically (Let's Encrypt), redirects HTTP to HTTPS. |
| `web`      | nginx: serves the app (the pages your browser or phone loads) and forwards `/api/` to the API.                                                         |
| `api`      | The backend (NestJS). Applies database updates on start, runs the nightly rent billing, renders PDFs with a built-in Chromium.                         |
| `postgres` | The database (PostgreSQL 17). Not reachable from outside.                                                                                              |
| `backup`   | Every night at 02:30 Israel time: database dump + all uploaded documents → kept 7 nights on the server and 30 days in a Backblaze B2 bucket.           |

Code changes flow like this: push to `main` on GitHub → tests run automatically (**CI**) → you
start the **Deploy** workflow (GitHub → **Actions → Deploy → Run workflow**): it builds the three
images, stores them in GitHub's container registry (GHCR), connects to the server over SSH and runs
`deploy/deploy.sh`, which pulls the new images and restarts what changed. Deploy is started by hand
for now; section 11 shows how to make it run by itself after every green CI run. Your data stays on
the server (Docker volumes) and in the backup bucket; secrets stay in `/opt/renawi/.env` on the
server.

## 2. What you need

| What                        | Notes                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A domain                    | e.g. `renawimotors.co.il` (from an ISOC-IL accredited registrar) or a `.com`. You can start without one (section 4).                                                  |
| A Hetzner Cloud account     | <https://console.hetzner.cloud>. A CX22 (2 vCPU, 4 GB RAM, 40 GB disk) is enough; if it is no longer offered, take the current 2 vCPU / 4 GB shared plan (e.g. CX23). |
| An SSH key on your computer | Windows PowerShell: `ssh-keygen -t ed25519` (press Enter for the default file, choose a passphrase). The public half is `C:\Users\<you>\.ssh\id_ed25519.pub`.         |
| A Backblaze B2 account      | <https://www.backblaze.com/cloud-storage>. The first 10 GB are free; a few years of nightly backups of this system fit easily.                                        |
| The GitHub repository       | With Actions enabled. Only you (and people you trust) should have write access.                                                                                       |
| Optional: Healthchecks.io   | Free account that e-mails you when a nightly backup does not happen.                                                                                                  |

Keep a **password manager** entry for: the server IP, the `.env` file contents, the B2 keys, the
admin password.

## 3. Create the server

1. Hetzner Console → your project → **Add Server**.
2. Location: any EU location (Falkenstein, Nuremberg or Helsinki are fine from Israel).
3. Image: **Ubuntu 24.04**. Type: **CX22** (shared vCPU, x86).
4. SSH keys: **Add SSH key** → paste the contents of `id_ed25519.pub`. (Then no root password is
   sent by e-mail and password login never works.)
5. Optional but recommended: **Firewalls** → create one with inbound rules TCP 22, TCP 80,
   TCP 443 and UDP 443 (any source), and attach it to the server. It is a second layer in front of
   the server's own firewall.
6. Name it e.g. `renawi-prod` → **Create & Buy**. Note the **IPv4 address** (example below:
   `203.0.113.10`).

## 4. Point the domain at the server

At your domain registrar's DNS settings create an **A record**: host `@` (the bare domain, or e.g.
`app` for `app.renawimotors.co.il`) → value `203.0.113.10`, TTL 300. Do not create an AAAA (IPv6)
record. Changes usually show up within minutes; check from your computer with
`nslookup renawimotors.co.il`.

**No domain yet?** Use `203-0-113-10.sslip.io` (your IP with dashes) as `DOMAIN` below. It resolves
to your server automatically and gets a real certificate. Switch to the real domain later by
changing `DOMAIN` in `.env` and running `docker compose up -d` (old links and installed phone apps
then need the new address).

## 5. Prepare the server (`provision.sh`)

From the repository folder on your computer (PowerShell):

```powershell
scp deploy/provision.sh root@203.0.113.10:/root/
ssh root@203.0.113.10
```

On the server:

```bash
bash /root/provision.sh
```

Without an argument it reuses the key you added in the Hetzner console; to authorise a different
key pass it in quotes: `bash /root/provision.sh "ssh-ed25519 AAAA... you@laptop"`. It takes a few
minutes and is safe to run again. It creates the `deploy` user, turns off root and password login
over SSH, enables the firewall (22/80/443), fail2ban, automatic security updates (with a reboot at
03:00 UTC when an update needs one), 2 GB of swap and Docker, and creates `/opt/renawi`.

**Before closing the root session**, open a second terminal and check `ssh deploy@203.0.113.10`
works. From now on always log in as `deploy` (it can use `sudo`).

## 6. Copy the files and write `.env`

From the repository folder on your computer:

```powershell
scp docker-compose.prod.yml .env.production.example deploy@203.0.113.10:/opt/renawi/
scp deploy/Caddyfile deploy/deploy.sh deploy/create-admin.cjs deploy@203.0.113.10:/opt/renawi/deploy/
```

(Once the GitHub secrets are set up (section 11), every Deploy run refreshes these files.)

On the server (`ssh deploy@203.0.113.10`):

```bash
cd /opt/renawi
cp .env.production.example .env
chmod 600 .env
openssl rand -hex 32        # -> POSTGRES_PASSWORD
openssl rand -base64 48     # -> JWT_ACCESS_SECRET
openssl rand -base64 48     # -> JWT_REFRESH_SECRET (a different value)
nano .env
```

Fill in every `CHANGE_ME` (the comments in the file explain each line):

- `IMAGE_PREFIX=ghcr.io/<your GitHub user or organisation in lowercase>`
- `DOMAIN`, `ACME_EMAIL` (your e-mail, for certificate notices)
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` from the commands above
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16+ random characters, letters and digits), `ADMIN_NAME`
- leave `S3_BUCKET` empty for now (section 10)

Save with Ctrl+O, Enter, Ctrl+X. Store a copy of the finished file in your password manager.

## 7. First start

The images must exist in GHCR first. Either:

- **Recommended:** set up the GitHub secrets (section 11) and run **Actions → Deploy → Run
  workflow** on `main`. It builds the images, copies the files, and starts everything. Or:
- **By hand:** run the Deploy workflow without the secrets (it then only builds and pushes the
  images, and says so in the run summary), then on the server log in to GHCR with a GitHub
  **classic** personal access token that has only the `read:packages` scope, and deploy:

  ```bash
  docker login ghcr.io -u <github-user>      # paste the token as the password
  cd /opt/renawi && bash deploy/deploy.sh
  ```

`deploy.sh` ends with `healthy: {"status":"ok","db":"up",...}` and a list of the images. Check
the containers with `docker compose ps` (all `Up`, `healthy`) and the certificate with
`docker compose logs caddy | grep -i certificate` ("certificate obtained successfully").

## 8. Create the admin user and fill in the business details

```bash
cd /opt/renawi
docker compose run --rm admin
```

It prints `Admin user ... created`. Sign in at `https://<DOMAIN>` with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`, then remove the `ADMIN_PASSWORD` line from `.env` (keep the password in your
password manager). To change the password later, sign in and use **My account** in the user menu
(the avatar in the top bar) → **Change password**: it asks for the current password and signs out
every other device. A **forgotten** password: put a new one in `ADMIN_PASSWORD` in `.env` and run
`docker compose run --rm admin node create-admin.cjs --reset-password` (this also signs out every
open session), then remove the line again.

Why not `npm run db:seed` with `SEED_DEMO=false` as in development? The seed runs TypeScript
through `tsx` and imports the demo-data helpers, none of which are in the production image. The
admin tool (`deploy/create-admin.cjs`, mounted into the API container by the `admin` service)
does the same for the user with the compiled password code. Neither stores sample business
details: Settings is created on first use with the standard defaults (business name, VAT 18%,
reminder timing, who pays what) and every other detail empty, exactly as `SEED_DEMO=false` would.

**Before printing any contract or form**, open **Settings → Business details** and enter the real
business names (he/ar/en), legal ID, dealer licence number, address, phone and e-mail: the PDFs
print them. Then review **Settings → Contracts** and **Settings → Reminder timing**.

## 9. Check HTTPS

- Open `http://<DOMAIN>`: it must jump to `https://` with a padlock and no warning.
- On the phone: open the address in Chrome/Safari and use **Add to Home screen** to install it.
- From your computer: `curl -I https://<DOMAIN>` shows `strict-transport-security` and
  `content-security-policy` headers.

## 10. Off-site backups (Backblaze B2)

1. Backblaze → **B2 Cloud Storage → Buckets → Create a Bucket**: name e.g. `renawi-backups-<random>`
   (names are global), **Private**, **Default Encryption: Enable**, Object Lock: disabled.
2. Open the bucket's **Lifecycle Settings** → **Keep only the last version of the file** (so the
   backups deleted after 30 days really disappear).
3. Note the bucket's **Endpoint**, e.g. `s3.eu-central-003.backblazeb2.com`; the region is the
   middle part (`eu-central-003`).
4. **Application Keys → Add a New Application Key**: name `renawi-backup`, allow access to **this
   bucket only**, **Read and Write**. Copy the `keyID` and `applicationKey` now (the key is shown
   once).
5. In `/opt/renawi/.env`:

   ```ini
   S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
   S3_REGION=eu-central-003
   S3_BUCKET=renawi-backups-xxxx
   S3_ACCESS_KEY=<keyID>
   S3_SECRET_KEY=<applicationKey>
   ```

6. Apply and test:

   ```bash
   docker compose up -d backup
   docker compose exec backup backup.sh --now
   ```

   The log ends with `off-site: s3:renawi-backups-xxxx/renawi/`. The files appear in the bucket
   under `renawi/`, and **Settings → Backup** in the app shows the time of the last backup with
   **Off-site copy: Yes** and the bucket name.

7. Optional: at <https://healthchecks.io> create a check with schedule `30 2 * * *`, time zone
   `Asia/Jerusalem`, grace time 2 hours; put its ping URL in `HEALTHCHECK_PING_URL` and run
   `docker compose up -d backup`. You get an e-mail when a night is missed or fails.

Without `S3_BUCKET` the backups stay on the server only and are lost if the server is lost: the
backup log says so every night, and **Settings → Backup** shows an amber "local backups only — not
protected against server loss" warning (the status file the backup writes has `"offsite": false`)
until a night has copied to the bucket. Restoring: [restore.md](restore.md).

## 11. Deploys from GitHub

1. On your computer create a key pair used only by GitHub:
   `ssh-keygen -t ed25519 -f renawi-deploy -C github-actions -N '""'` (PowerShell; `-N ""` in bash).
2. Add the **public** key to the server:
   `ssh deploy@203.0.113.10 "cat >> ~/.ssh/authorized_keys" < renawi-deploy.pub`
3. GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**:

   | Secret        | Value                                                      |
   | ------------- | ---------------------------------------------------------- |
   | `VPS_HOST`    | `203.0.113.10` (or the domain)                             |
   | `VPS_USER`    | `deploy`                                                   |
   | `VPS_SSH_KEY` | the whole contents of the **private** file `renawi-deploy` |
   | `VPS_PORT`    | optional, only if SSH is not on 22                         |

   Then delete the private key file from your computer.

4. Every push to `main` runs **CI** (lint, type checks, unit and end-to-end tests, builds). When
   CI is green and you want the new version live: **Actions → Deploy → Run workflow** (branch
   `main`). It builds the images, pushes them to GHCR as `latest` and `sha-<commit>`, copies the
   compose file and scripts to `/opt/renawi`, and runs `deploy/deploy.sh sha-<commit>`. Without
   `VPS_HOST` (or with the **deploy** box unticked) the deploy step is skipped with a notice and
   only the images are pushed.
5. Optional, once the server runs well: **deploy automatically after every green CI run on
   `main`**. In `.github/workflows/deploy.yml`, un-comment the `workflow_run` block under `on:`
   (keep `workflow_dispatch`), commit and push:

   ```yaml
   on:
     workflow_run:
       workflows: [CI]
       types: [completed]
       branches: [main]
     workflow_dispatch: ...
   ```

   The workflow already checks that the CI run succeeded and came from a push to `main`.

The runtime secrets (database password, JWT secrets, B2 keys, admin password) are never stored in
GitHub; they exist only in `/opt/renawi/.env`. GHCR packages of a private repository are private;
GitHub's free plan includes limited package storage, so delete old image versions now and then
(GitHub → your profile → **Packages** → package → **Package settings**).

## 12. Everyday operations

All commands run on the server in `/opt/renawi` as `deploy` (`.env` sets `COMPOSE_FILE`, so plain
`docker compose` uses the production file).

| Task                      | Command                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| Status                    | `docker compose ps`                                                      |
| Logs (follow)             | `docker compose logs -f api` (also `web`, `caddy`, `backup`, `postgres`) |
| Release the latest `main` | **Actions → Deploy → Run workflow** (or automatic, section 11 step 5)    |
| Re-pull the newest images | `bash deploy/deploy.sh latest`                                           |
| Roll back                 | `bash deploy/deploy.sh sha-1a2b3c4` (an older tag; see below)            |
| Back to newest            | `bash deploy/deploy.sh latest` (or the next Deploy run)                  |
| Restart one service       | `docker compose restart api`                                             |
| Stop / start everything   | `docker compose stop` / `docker compose up -d`                           |
| Backup now                | `docker compose exec backup backup.sh --now`                             |
| List backups              | `docker compose run --rm restore --list`                                 |
| Disk space                | `df -h /` and `docker system df`                                         |
| Memory / CPU              | `docker stats --no-stream`                                               |

**Rolling back.** Every release has a tag `sha-<first 7 characters of the commit>`; find them in
the GitHub commit list, in the Deploy run summaries, or with
`docker image ls ghcr.io/<owner>/renawi-api` (the last three releases stay on the server).
`deploy.sh <tag>` writes `IMAGE_TAG=<tag>` into `.env` and deploys it. Database migrations only
move forward: rolling back the code across a release that changed the database can fail; then
restore the backup taken before that release instead ([restore.md](restore.md)).

**Building on the server** (instead of GHCR, e.g. without GitHub Actions): clone the repository to
`/opt/renawi` (it must contain `.env`), set `COMPOSE_FILE=docker-compose.prod.yml:docker-compose.build.yml`
and `IMAGE_PREFIX=renawi` in `.env`, then `git pull && bash deploy/deploy.sh`. Building the API image
takes several minutes on the small server.

**Server updates** install themselves; when one needs a reboot the server restarts at 03:00 UTC
(05:00–06:00 in Israel) and the containers come back by themselves. Check pending reboots with
`cat /var/run/reboot-required 2>/dev/null`.

## 13. Common problems

| Symptom                                                               | Cause and fix                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser warns about the certificate, or Caddy logs `challenge failed` | DNS does not point at the server yet (`nslookup <DOMAIN>`), or ports 80/443 are blocked (Hetzner firewall). Fix and run `docker compose restart caddy`. After many failures Let's Encrypt pauses for an hour. |
| `502 Bad Gateway`                                                     | The API is starting (migrations, up to a minute) or crashed: `docker compose logs --tail 100 api`.                                                                                                            |
| API restarts with `Invalid environment configuration`                 | A required `.env` value is missing or too short (JWT secrets need 32+ characters). A misspelt `TRUST_PROXY` is reported there too (valid: `loopback,uniquelocal`, `true` = 2 hops, a hop count, `false`).     |
| Sign-in works but you are signed out at once                          | You opened the site over `http://` or by IP: with `COOKIE_SECURE=true` the browser only keeps the cookies over HTTPS. Use `https://<DOMAIN>`.                                                                 |
| `deploy.sh`: `pull access denied` / `denied`                          | `IMAGE_PREFIX` is wrong (must be lowercase) or the server is not logged in to GHCR (manual pulls need `docker login ghcr.io`, section 7).                                                                     |
| `deploy.sh`: `not healthy after 300 s`                                | Read the printed logs; roll back with `bash deploy/deploy.sh <previous tag>`.                                                                                                                                 |
| Upload fails with "file too large"                                    | The limit is `MAX_UPLOAD_MB` (20 MB). Photos from phones are usually far smaller; scan multi-page PDFs at 200–300 dpi.                                                                                        |
| Generating a PDF fails or is slow                                     | The first PDF after a restart starts Chromium (a few seconds). Repeated failures: `docker compose logs api                                                                                                    | grep -i pdf`and memory in`docker stats --no-stream`. |
| Settings → Backup shows an old date                                   | `docker compose logs --tail 50 backup`. Typical: wrong B2 key, bucket name or endpoint; disk full. Fix `.env`, `docker compose up -d backup`, then `docker compose exec backup backup.sh --now`.              |
| Settings → Backup says "local backups only"                           | `S3_BUCKET` is empty, so nothing was copied off the server. Set up the bucket (section 10), `docker compose up -d backup`, then `docker compose exec backup backup.sh --now`.                                 |
| Disk almost full                                                      | `docker system df`; old images: `docker image prune -a` (keeps images in use); local backups are capped at 7 nights.                                                                                          |
| Forgot the admin password                                             | Section 8: `--reset-password`.                                                                                                                                                                                |
| Need to change the domain                                             | Point DNS, set `DOMAIN` (and `CORS_ORIGIN` if you set it explicitly) in `.env`, `docker compose up -d`.                                                                                                       |
