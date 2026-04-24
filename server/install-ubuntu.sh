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
fi

echo "npm install..."
npm install --omit=dev

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

PORT_LINE=$(grep '^PORT=' data/.env 2>/dev/null | head -1 || echo "PORT=3847")
PORT_VAL="${PORT_LINE#PORT=}"
echo ""

# --- Systemd service setup ---
SERVICE_FILE="/etc/systemd/system/checkmaster-server.service"
if [[ $EUID -ne 0 ]]; then
  SUDO=sudo
else
  SUDO=""
fi

if [[ ! -f "$SERVICE_FILE" ]]; then
  echo "Creating systemd service..."
  $SUDO tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=CheckMaster Sync Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(command -v npm) start
Restart=always
User=$USER
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable checkmaster-server
fi

echo "Restarting CheckMaster server..."
$SUDO systemctl restart checkmaster-server || true

# --- Print admin portal link ---
IP=$(hostname -I | awk '{print $1}')
ADMIN_PORT=$PORT_VAL
echo "================================================================"
echo "  CheckMaster sync server is ready (install/update complete)."
echo "  Service: checkmaster-server (systemd)"
echo "  Listen: 0.0.0.0:${ADMIN_PORT:-3847}"
echo ""
echo "  Admin Portal: http://$IP:${ADMIN_PORT:-3847}/admin"
echo "  In the app (Settings → Cloud Sync):"
echo "    Server URL: http://$IP:${ADMIN_PORT:-3847}"
echo "    API key:    (value printed by bootstrap above, or:) "
grep '^API_KEY=' data/.env | sed 's/^/    /' || true
echo "================================================================"
