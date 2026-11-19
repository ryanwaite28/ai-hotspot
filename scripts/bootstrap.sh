#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

docker compose up -d

cat <<'MSG'
Local dependencies started.
Next:
- npm install
- npm run db:migrate
- npm run dev
MSG
