#!/usr/bin/env bash
# Install CheckMaster sync server on Ubuntu (or Debian).
# Run from this directory after you have the repo on the machine:
#   cd /path/to/CheckMaster/server && bash install-ubuntu.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f package.json ]] || [[ ! -f src/index.js ]]; then
  echo "Error: run this script from the CheckMaster/server directory (where package.json is)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Installing Node.js 20 (needs sudo)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*$/\1/')
  if [[ "$NODE_MAJOR" -lt 18 ]]; then
    echo "Node.js version is too old (found $(node -v)). Installing Node.js 20 (needs sudo)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found after Node installation. Please check your Node.js setup."
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "MariaDB client/server not found. Installing MariaDB..."
  sudo apt-get update
  sudo apt-get install -y mariadb-server mariadb-client
fi

echo "Checking MariaDB service..."
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet mariadb; then
    echo "Starting MariaDB service..."
    sudo systemctl enable --now mariadb
  fi
else
  sudo service mariadb start || true
fi

if [[ -S /var/run/mysqld/mysqld.sock ]]; then
  export DB_SOCKET=/var/run/mysqld/mysqld.sock
fi

echo "Installing server dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

mkdir -p data
if [[ ! -f data/.env ]]; then
  echo "Generating API key..."
  node scripts/bootstrap.js
else
  echo "Keeping existing data/.env"
  echo ""
  echo "=== Current API key (from data/.env) ==="
  grep '^API_KEY=' data/.env | sed 's/^API_KEY=//' || true
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

PORT_LINE=$(grep '^PORT=' data/.env 2>/dev/null | head -1 || echo "PORT=3847")
PORT_VAL="${PORT_LINE#PORT=}"
echo ""
echo "================================================================"
echo "  CheckMaster sync server is ready."
echo "  Start:  cd \"$SCRIPT_DIR\" && npm start"
echo "  Listen: 0.0.0.0:${PORT_VAL:-3847}"
echo ""
echo "  In the app (Settings → Cloud Sync):"
echo "    Server URL: http://YOUR_SERVER_IP:${PORT_VAL:-3847}"
echo "    API key:    (value printed by bootstrap above, or:)"
echo ""
grep '^API_KEY=' data/.env | sed 's/^/    /' || true
echo "================================================================"
