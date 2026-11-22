#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Run: cp .env.example .env" >&2
  exit 1
fi

set -a
source .env
set +a

if ! docker compose ps --status running postgres >/dev/null 2>&1; then
  echo "PostgreSQL is not running. Run: bash scripts/bootstrap.sh" >&2
  exit 1
fi

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
  -U "${POSTGRES_USER:-hotspot}" -d "${POSTGRES_DB:-hotspot}" \
  -c "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" >/dev/null

applied=0

migration_dirs=(
  "prisma/migrations/20261119_phase1_identity_init"
  "prisma/migrations/20261119_phase1_outbox_foundation"
  "prisma/migrations/20261119_phase1_identity_callbacks"
  "prisma/migrations/20261119_phase1_passkey_foundation"
  "prisma/migrations/20261119_phase1_subscriber_idempotency"
  "prisma/migrations/20261119_phase1_subscriber_idempotency_lifecycle"
  "prisma/migrations/20261119_phase1_trial_and_account_lifecycle"
  "prisma/migrations/20261119_phase1_user_mutation_event_fields"
)

for migration_dir in "${migration_dirs[@]}"; do
  name=$(basename "$migration_dir")
  migration_file="$migration_dir/migration.sql"
  [[ -f "$migration_file" ]] || continue

  already_applied=$(docker compose exec -T postgres psql -tA \
    -U "${POSTGRES_USER:-hotspot}" -d "${POSTGRES_DB:-hotspot}" \
    -c "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '$name');")

  if [[ "${already_applied//[[:space:]]/}" == "t" ]]; then
    echo "SKIP $name"
    continue
  fi

  echo "APPLY $name"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-hotspot}" -d "${POSTGRES_DB:-hotspot}" \
    -f /dev/stdin < "$migration_file"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-hotspot}" -d "${POSTGRES_DB:-hotspot}" \
    -c "INSERT INTO schema_migrations (name) VALUES ('$name');" >/dev/null
  applied=$((applied + 1))
done

echo "Migrations complete: $applied applied"
