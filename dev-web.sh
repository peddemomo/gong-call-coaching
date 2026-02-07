#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/web"

# Use npm from a known location so we don't depend on PATH
if [ -x "/opt/homebrew/bin/npm" ]; then
  NPM="/opt/homebrew/bin/npm"
elif [ -x "/usr/local/bin/npm" ]; then
  NPM="/usr/local/bin/npm"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  NPM="npm"
else
  echo "Node/npm not found. Install from https://nodejs.org or: brew install node"
  exit 1
fi
"$NPM" install
"$NPM" run dev
