#!/usr/bin/env bash
# Ensure Node/npm are on PATH (Homebrew + nvm)
export PATH="/opt/homebrew/bin:$PATH"
[[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/web"
npm install
npm run dev
