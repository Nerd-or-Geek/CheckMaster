#!/bin/bash
# CheckMaster update script
set -e

if [ "$(id -u)" != "0" ]; then
  echo "Please run as root (sudo)."
  exit 1
fi

cd "$(dirname "$0")"

# Pull latest changes
echo "Updating CheckMaster server..."
git pull || true

# Install dependencies
if [ -f package.json ]; then
  echo "Installing/updating dependencies..."
  npm install --production || npm ci --production
fi

# Restart systemd service if exists
if systemctl is-active --quiet checkmaster; then
  echo "Restarting CheckMaster service..."
  systemctl restart checkmaster
  systemctl status checkmaster --no-pager
fi

echo "Update complete!"

# Print admin portal link
IP=$(hostname -I | awk '{print $1}')
PORT=$(grep PORT .env 2>/dev/null | cut -d '=' -f2)
[ -z "$PORT" ] && PORT=3847
ADMIN_URL="http://$IP:$PORT/admin"
echo "Admin portal: $ADMIN_URL"
