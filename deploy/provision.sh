#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 server (Hetzner Cloud CX22 or similar) for Renawi Motors.
# Run once as root; running it again is safe (every step checks what is already in place).
#
#   scp deploy/provision.sh root@SERVER_IP:/root/
#   ssh root@SERVER_IP
#   bash /root/provision.sh "ssh-ed25519 AAAA... you@laptop"
#   bash /root/provision.sh        # no argument: reuse root's authorized_keys (the SSH key you
#                                  # selected when creating the server in the Hetzner console)
#
# What it does: user `deploy` (SSH key only, passwordless sudo, docker group); SSH without
# root login and without passwords; ufw firewall (22, 80, 443); fail2ban for SSH; automatic
# security updates (reboot at 03:00 UTC when one needs it); 2 GB swap; Docker Engine + compose
# plugin from Docker's apt repository with log rotation; /opt/renawi for the app.
#
# Overrides: DEPLOY_USER=deploy APP_DIR=/opt/renawi SWAP_SIZE=2G REBOOT_TIME=03:00
# Keep this SSH session open until you have logged in as the deploy user from a second terminal.
set -Eeuo pipefail

DEPLOY_USER=${DEPLOY_USER:-deploy}
APP_DIR=${APP_DIR:-/opt/renawi}
SWAP_SIZE=${SWAP_SIZE:-2G}
REBOOT_TIME=${REBOOT_TIME:-03:00}
SSH_KEY=${1:-}

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

step() { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo bash provision.sh ...)"
# shellcheck source=/dev/null
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "this script is for Ubuntu (found ${PRETTY_NAME:-unknown})"
[[ "${VERSION_ID:-}" == "24.04" ]] || info "warning: written for Ubuntu 24.04, found ${VERSION_ID:-?}"
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "invalid DEPLOY_USER: ${DEPLOY_USER}"

# ---- Packages ------------------------------------------------------------------------------------
step "System update and base packages"
apt-get update -q
apt-get "${APT_OPTS[@]}" upgrade
apt-get "${APT_OPTS[@]}" install ca-certificates curl gnupg git ufw fail2ban python3-systemd \
  unattended-upgrades apt-listchanges

# ---- Swap ----------------------------------------------------------------------------------------
step "Swap (${SWAP_SIZE})"
if swapon --show=NAME --noheadings | grep -q .; then
  info "swap already active: $(swapon --show=NAME,SIZE --noheadings | tr '\n' ' ')"
else
  [[ -f /swapfile ]] || fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "created /swapfile"
fi
cat > /etc/sysctl.d/99-renawi.conf << 'EOF'
# Renawi Motors: use swap only under memory pressure.
vm.swappiness = 10
EOF
sysctl -q --system

# ---- Docker --------------------------------------------------------------------------------------
step "Docker Engine + compose plugin (download.docker.com)"
if ! command -v docker > /dev/null || ! docker compose version > /dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get "${APT_OPTS[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin \
    docker-compose-plugin
fi
if [[ ! -f /etc/docker/daemon.json ]]; then
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
EOF
  info "wrote /etc/docker/daemon.json (log rotation)"
  systemctl restart docker
fi
systemctl enable --now docker > /dev/null 2>&1
info "$(docker --version); $(docker compose version)"

# ---- Deploy user ---------------------------------------------------------------------------------
step "User ${DEPLOY_USER}"
if ! id "$DEPLOY_USER" > /dev/null 2>&1; then
  adduser --disabled-password --gecos "Renawi deploy" "$DEPLOY_USER" > /dev/null
  info "created"
fi
usermod -aG docker "$DEPLOY_USER"
home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "${home}/.ssh"
keys="${home}/.ssh/authorized_keys"
touch "$keys"
key_re='^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]+'
if [[ -n "$SSH_KEY" ]]; then
  [[ "$SSH_KEY" =~ $key_re ]] \
    || die "the argument does not look like a public key (ssh-ed25519 AAAA... comment)"
  grep -qxF "$SSH_KEY" "$keys" || echo "$SSH_KEY" >> "$keys"
elif [[ -s /root/.ssh/authorized_keys ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    grep -qxF "$line" "$keys" || echo "$line" >> "$keys"
  done < /root/.ssh/authorized_keys
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$keys"
chmod 600 "$keys"
grep -qE '^(ssh-|ecdsa-|sk-)' "$keys" \
  || die "no SSH public key for ${DEPLOY_USER}: pass one as the argument (cat ~/.ssh/id_ed25519.pub on your computer)"
info "$(grep -cE '^(ssh-|ecdsa-|sk-)' "$keys") key(s) in ${keys}"
# Passwordless sudo: the account has no password, and root cannot log in over SSH.
# (Membership of the docker group is root-equivalent anyway.)
echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-${DEPLOY_USER}"
chmod 440 "/etc/sudoers.d/90-${DEPLOY_USER}"
visudo -cqf "/etc/sudoers.d/90-${DEPLOY_USER}" || die "invalid sudoers file"

# ---- SSH hardening -------------------------------------------------------------------------------
step "SSH: keys only, no root login"
# 00- so these values win over 50-cloud-init.conf (sshd keeps the first value it reads).
cat > /etc/ssh/sshd_config.d/00-renawi.conf << EOF
# Renawi Motors hardening (deploy/provision.sh)
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowUsers ${DEPLOY_USER}
EOF
sshd -t || die "sshd configuration test failed (see above); nothing was reloaded"
systemctl reload ssh 2> /dev/null || systemctl restart ssh
info "root login and password login are now disabled; log in as ${DEPLOY_USER}"

# ---- Firewall ------------------------------------------------------------------------------------
step "Firewall (ufw): 22/tcp, 80/tcp, 443/tcp+udp"
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow 22/tcp comment 'SSH' > /dev/null
ufw allow 80/tcp comment 'HTTP (redirect + certificates)' > /dev/null
ufw allow 443/tcp comment 'HTTPS' > /dev/null
ufw allow 443/udp comment 'HTTP/3' > /dev/null
ufw --force enable > /dev/null
info "$(ufw status | head -n 1)"

# ---- fail2ban ------------------------------------------------------------------------------------
step "fail2ban (SSH)"
cat > /etc/fail2ban/jail.d/renawi.local << 'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable fail2ban > /dev/null 2>&1
systemctl restart fail2ban
info "$(fail2ban-client status sshd 2> /dev/null | grep -m1 'Currently banned' | xargs || echo 'sshd jail configured')"

# ---- Automatic security updates ------------------------------------------------------------------
step "Unattended security upgrades (reboot at ${REBOOT_TIME} UTC when required)"
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52renawi-unattended-upgrades << EOF
// Renawi Motors (deploy/provision.sh). Containers restart by themselves after a reboot.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "${REBOOT_TIME}";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades > /dev/null 2>&1

# ---- App folder ----------------------------------------------------------------------------------
step "App folder ${APP_DIR}"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR" "${APP_DIR}/deploy" "${APP_DIR}/backups"
info "$(ls -ld "$APP_DIR")"

ip=$(hostname -I | cut -d' ' -f1)
cat << EOF

Done. Next steps (details: docs/ops/deploy.md):
  1. In a NEW terminal, check that you can log in:   ssh ${DEPLOY_USER}@${ip}
     (keep this root session open until that works; root login is now disabled)
  2. From your computer, copy the deployment files:
       scp docker-compose.prod.yml .env.production.example ${DEPLOY_USER}@${ip}:${APP_DIR}/
       scp deploy/Caddyfile deploy/deploy.sh deploy/create-admin.cjs ${DEPLOY_USER}@${ip}:${APP_DIR}/deploy/
  3. On the server: cd ${APP_DIR} && cp .env.production.example .env && chmod 600 .env && nano .env
  4. Log in to GHCR once (private images): docker login ghcr.io -u <github-user>
  5. bash deploy/deploy.sh, then: docker compose run --rm admin
  DNS: point the A record of your domain at ${ip} (or use DOMAIN=${ip//./-}.sslip.io).
EOF
