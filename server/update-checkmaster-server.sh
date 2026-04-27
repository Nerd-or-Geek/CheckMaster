#!/bin/bash
# CheckMaster update script
set -e

cd "$(dirname "$0")"

# Pull latest changes
echo "Updating CheckMaster server..."
git pull || true

# Install dependencies
if [ -f package.json ]; then
  echo "Installing/updating dependencies..."
  if [ -f package-lock.json ]; then
    npm ci --production
  else
    npm install --production
  fi
fi

mkdir -p data
if [ ! -f data/.env ]; then
  echo "Bootstrap data/.env because it was missing..."
  node scripts/bootstrap.js
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "MariaDB client not found."
  if [ "$(id -u)" = "0" ]; then
    echo "Installing mariadb-client..."
    apt-get update
    apt-get install -y mariadb-client
  else
    echo "Please install MariaDB client or run this script as root."
  fi
fi

echo "Checking MariaDB/MySQL service..."
if command -v systemctl >/dev/null 2>&1; then
  if [ "$(id -u)" = "0" ]; then
    systemctl enable --now mariadb 2>/dev/null || systemctl enable --now mysql 2>/dev/null || true
  fi
else
  sudo service mariadb start 2>/dev/null || sudo service mysql start 2>/dev/null || true
fi

for i in {1..10}; do
  for socket in /var/run/mysqld/mysqld.sock /var/run/mysql/mysql.sock /tmp/mysql.sock; do
    if [[ -S "$socket" ]]; then
      export DB_SOCKET="$socket"
      break 2
    fi
  done
  sleep 1
done

if [[ -z "${DB_SOCKET:-}" ]]; then
  echo "WARNING: MariaDB socket not found; database init will use TCP host/port instead."
fi

echo "Checking database setup..."
node <<'NODE'
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), 'data', '.env');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}
require('./src/db').initialize()
  .then(() => console.log('Database initialized.'))
  .catch((error) => { console.error('Database initialization failed:', error); process.exit(1); });
NODE

# Restart systemd service if available and running
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet checkmaster; then
    if [ "$(id -u)" = "0" ]; then
      echo "Restarting CheckMaster service..."
      systemctl restart checkmaster
      systemctl status checkmaster --no-pager
    else
      echo "Systemd service 'checkmaster' is active. Re-run this script with sudo to restart the service."
    fi
  fi
fi

echo "Update complete!"

# Print admin portal link
IP=$(hostname -I | awk '{print $1}')
PORT=$(grep '^PORT=' data/.env 2>/dev/null | cut -d '=' -f2)
[ -z "$PORT" ] && PORT=3847
ADMIN_URL="http://$IP:$PORT/admin"
echo "Admin portal: $ADMIN_URL"
