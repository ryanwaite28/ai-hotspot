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

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
  -U "${POSTGRES_USER:-hotspot}" -d "${POSTGRES_DB:-hotspot}" <<'SQL'
INSERT INTO users (
  id, handle, display_name, email, password_hash, status,
  identity_verification_status, trial_activated_once,
  created_at, updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'hotspot_admin', 'HotSpot Admin', 'admin@hotspot.local', NULL, 'active', 'approved', TRUE, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000002', 'demo_creator', 'Demo Creator', 'creator@hotspot.local', NULL, 'active', 'approved', TRUE, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000003', 'demo_user', 'Demo User', 'user@hotspot.local', NULL, 'active', 'approved', TRUE, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  handle = EXCLUDED.handle,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  status = EXCLUDED.status,
  identity_verification_status = EXCLUDED.identity_verification_status,
  updated_at = NOW();

DO $do$
BEGIN
  IF to_regclass('public.profile_settings') IS NOT NULL THEN
    INSERT INTO profile_settings (
      user_id, bio, links, visibility, follower_list_visibility,
      created_at, updated_at
    )
    VALUES
      ('00000000-0000-4000-8000-000000000001', 'Local HotSpot administrator.', '[]'::jsonb, 'public', 'public', NOW(), NOW()),
      ('00000000-0000-4000-8000-000000000002', 'Deterministic local creator account.', '[]'::jsonb, 'public', 'public', NOW(), NOW()),
      ('00000000-0000-4000-8000-000000000003', 'Deterministic local viewer account.', '[]'::jsonb, 'public', 'public', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      bio = EXCLUDED.bio,
      links = EXCLUDED.links,
      visibility = EXCLUDED.visibility,
      follower_list_visibility = EXCLUDED.follower_list_visibility,
      updated_at = NOW();
  END IF;
END
$do$;
SQL

echo "Deterministic local seed complete: admin, creator, viewer"
