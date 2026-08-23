#!/bin/bash
# Sets up the Isabelle reminder service on the shared snicksnack box. Runs as
# root through deploy-server.sh on every deploy and is idempotent: it never
# touches the snicksnack units, and only appends its own Caddy site block.
# Arguments: API_DOMAIN WEB_DOMAIN BACKUP_BUCKET
set -euo pipefail
API_DOMAIN=$1
WEB_DOMAIN=$2
BACKUP_BUCKET=$3

# Swap: the box runs two Python services in 1 GiB; a spike must page, not OOM-kill.
if [ ! -f /swapfile ]; then
  fallocate -l 512M /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

useradd -r -m -d /opt/isabelle isabelle || true
mkdir -p /opt/isabelle/app /var/lib/isabelle /etc/isabelle
chown -R isabelle:isabelle /opt/isabelle /var/lib/isabelle

# VAPID keys: generated once. Rotating them silently kills every subscription.
if [ ! -f /etc/isabelle/env ]; then
  VAPID_PEM=$(mktemp)
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$VAPID_PEM" 2>/dev/null
  b64url() { base64 -w0 | tr '+/' '-_' | tr -d '='; }
  cat > /etc/isabelle/env <<EOF
ISABELLE_VAPID_PRIVATE=$(openssl pkey -in "$VAPID_PEM" -outform DER | b64url)
ISABELLE_VAPID_PUBLIC=$(openssl pkey -in "$VAPID_PEM" -pubout -outform DER | tail -c 65 | b64url)
EOF
  rm -f "$VAPID_PEM"
  chgrp isabelle /etc/isabelle/env
  chmod 640 /etc/isabelle/env
fi

cat > /etc/isabelle/settings <<EOF
ISABELLE_DB=/var/lib/isabelle/isabelle.db
ISABELLE_WEB_URL=https://$WEB_DOMAIN
ISABELLE_VAPID_SUBJECT=mailto:noreply@$WEB_DOMAIN
ISABELLE_TIMEZONE=Europe/Stockholm
ISABELLE_CORS_ORIGINS=https://$WEB_DOMAIN,https://urban-eriksson.github.io
EOF
chgrp isabelle /etc/isabelle/settings
chmod 640 /etc/isabelle/settings

# Caddy: our own site block, appended once. Caddy's automatic HTTPS handles the cert.
if ! grep -q "^$API_DOMAIN" /etc/caddy/Caddyfile; then
  cat >> /etc/caddy/Caddyfile <<EOF

$API_DOMAIN {
    reverse_proxy 127.0.0.1:8001
}
EOF
  systemctl reload caddy
fi

cat > /etc/systemd/system/isabelle.service <<'EOF'
[Unit]
Description=Isabelle reminder API
After=network.target

[Service]
User=isabelle
WorkingDirectory=/opt/isabelle/app
EnvironmentFile=/etc/isabelle/env
EnvironmentFile=/etc/isabelle/settings
ExecStart=/usr/local/bin/uv run --frozen --no-dev uvicorn isabelle.main:app --host 127.0.0.1 --port 8001 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/isabelle-remind.service <<'EOF'
[Unit]
Description=Send Isabelle reminders for today's classes
After=network-online.target

[Service]
Type=oneshot
User=isabelle
WorkingDirectory=/opt/isabelle/app
EnvironmentFile=/etc/isabelle/env
EnvironmentFile=/etc/isabelle/settings
ExecStart=/usr/local/bin/uv run --frozen --no-dev python -m isabelle.remind
EOF

cat > /etc/systemd/system/isabelle-remind.timer <<'EOF'
[Unit]
Description=Isabelle morning reminders

[Timer]
OnCalendar=*-*-* 05:00:00 Europe/Stockholm
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > /usr/local/bin/isabelle-backup <<SCRIPT
#!/bin/bash
set -euo pipefail
DB=/var/lib/isabelle/isabelle.db
[ -f "\$DB" ] || exit 0
STAMP=\$(date -u +%Y%m%dT%H%M%SZ)
TMP=\$(mktemp -d)
trap 'rm -rf "\$TMP"' EXIT
sqlite3 "\$DB" ".backup '\$TMP/isabelle.db'"
gzip -9 "\$TMP/isabelle.db"
aws s3 cp "\$TMP/isabelle.db.gz" "s3://$BACKUP_BUCKET/db/isabelle-\$STAMP.db.gz" --only-show-errors
aws s3 cp "s3://$BACKUP_BUCKET/db/isabelle-\$STAMP.db.gz" "s3://$BACKUP_BUCKET/db/latest.db.gz" --only-show-errors
SCRIPT
chmod +x /usr/local/bin/isabelle-backup

cat > /etc/systemd/system/isabelle-backup.service <<'EOF'
[Unit]
Description=Back up the Isabelle database to S3
After=network-online.target

[Service]
Type=oneshot
User=isabelle
ExecStart=/usr/local/bin/isabelle-backup
EOF

cat > /etc/systemd/system/isabelle-backup.timer <<'EOF'
[Unit]
Description=Nightly Isabelle database backup

[Timer]
OnCalendar=*-*-* 03:47:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable isabelle
systemctl enable --now isabelle-remind.timer isabelle-backup.timer
