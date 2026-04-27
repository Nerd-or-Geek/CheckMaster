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
