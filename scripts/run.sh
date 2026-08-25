#!/usr/bin/env bash
# Launches the built app against a scratch database, read-only.
#
# VSCode's integrated terminal exports ELECTRON_RUN_AS_NODE, which makes the Electron binary run as
# bare node and die on the ESM entry point. Clear it before doing anything else.
set -euo pipefail
unset ELECTRON_RUN_AS_NODE

cd "$(dirname "$0")/.."

: "${ANTHEM_DB:=$HOME/.config/anthem/library.db}"
export ANTHEM_DB
mkdir -p "$(dirname "$ANTHEM_DB")"

# Pin read-only unless the caller has deliberately opted out.
if [[ "${ANTHEM_ALLOW_WRITES:-}" != "1" ]]; then
  export ANTHEM_FORCE_READ_ONLY=1
fi

ELECTRON="${ELECTRON_EXEC:-$(command -v electron || true)}"
if [[ -z "$ELECTRON" ]]; then
  ELECTRON=$(ls -d /nix/store/*-electron-43.*/bin/electron 2>/dev/null | head -1)
fi
[[ -n "$ELECTRON" ]] || { echo "no electron found; run inside 'nix develop'" >&2; exit 1; }

[[ -f out/main/index.js ]] || npx electron-vite build

echo "anthem: $ELECTRON"
echo "anthem: database $ANTHEM_DB"
exec "$ELECTRON" . --no-sandbox "$@"
