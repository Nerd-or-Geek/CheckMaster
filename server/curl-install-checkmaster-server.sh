#!/usr/bin/env bash
# One-liner-friendly installer: clones your repo, then runs install-ubuntu.sh on server/.
#
# On Ubuntu:
#   export REPO_URL="https://github.com/YOUR_USER/CheckMaster.git"
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/server/curl-install-checkmaster-server.sh | bash
#
# If you already cloned the repo locally, skip this and run:
#   cd CheckMaster/server && bash install-ubuntu.sh
#
set -euo pipefail
REPO_URL="${REPO_URL:-}"
INSTALL_ROOT="${INSTALL_ROOT:-$HOME/checkmaster-server}"

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: Set REPO_URL to your Git repository URL, then run again."
  echo ""
  echo "Example:"
  echo "  export REPO_URL=\"https://github.com/myorg/CheckMaster.git\""
  echo "  curl -fsSL .../curl-install-checkmaster-server.sh | bash"
  exit 1
fi

mkdir -p "$INSTALL_ROOT"
cd "$INSTALL_ROOT"

if [[ ! -d CheckMaster ]]; then
  echo "Cloning $REPO_URL ..."
  git clone --depth 1 "$REPO_URL" CheckMaster
fi

cd CheckMaster/server
exec bash install-ubuntu.sh
