#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose down -v --remove-orphans
cp .env.example .env

if [[ "${1:-}" == "--seed" ]]; then
  bash scripts/bootstrap.sh
fi

echo "Local disposable infrastructure reset complete."
