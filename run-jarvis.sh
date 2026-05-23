#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "[J.A.R.V.I.S] Launching via bash wrapper..."

echo "[J.A.R.V.I.S] Syncing environment variables..."
npm run sync-env

if command -v powershell.exe >/dev/null 2>&1; then
  echo "[J.A.R.V.I.S] Detected PowerShell. Executing run-jarvis.ps1..."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ROOT/run-jarvis.ps1" "$@"
else
  echo "[ERROR] powershell.exe not found in PATH."
  echo "Please run the PowerShell helper from a PowerShell prompt instead:"
  echo "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File run-jarvis.ps1"
  exit 1
fi
