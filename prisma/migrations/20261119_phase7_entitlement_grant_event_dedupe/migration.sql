ALTER TABLE entitlements
  ADD COLUMN IF NOT EXISTS grant_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_grant_event_unique
  ON entitlements (grant_event_id)
  WHERE grant_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS entitlements_user_effective_idx
  ON entitlements (user_id, entitlement_key, revoked_at, starts_at, ends_at);
