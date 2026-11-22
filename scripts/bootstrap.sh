#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

docker compose up -d

for service in postgres mongodb redis rabbitmq; do
  for attempt in $(seq 1 30); do
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "hotspot-${service}-1" 2>/dev/null || true)
    if [[ "$state" == "healthy" ]]; then
      break
    fi
    if [[ "$attempt" == 30 ]]; then
      echo "Dependency did not become healthy: $service" >&2
      docker compose ps
      exit 1
    fi
    sleep 2
  done
done

npm run db:migrate
npm run db:seed

cat <<'MSG'
Local dependencies and database migrations are ready.
Next:
- npm run dev
- npm run worker:media
- npm run worker:cleanup
MSG
