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
