CREATE TABLE IF NOT EXISTS platform_tier_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  stripe_price_id TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  monthly_cents INTEGER NOT NULL,
  entitlement_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tier_key, version)
);

CREATE INDEX IF NOT EXISTS platform_tier_catalog_status_idx
  ON platform_tier_catalog (status, tier_key, version DESC);

ALTER TABLE entitlements
  ADD COLUMN IF NOT EXISTS entitlement_status TEXT,
  ADD COLUMN IF NOT EXISTS grant_event_id TEXT,
  ADD COLUMN IF NOT EXISTS source_version INTEGER,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

CREATE INDEX IF NOT EXISTS entitlements_effective_lookup_idx
  ON entitlements (user_id, entitlement_key, starts_at, ends_at, revoked_at);

CREATE TABLE IF NOT EXISTS entitlement_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  entitlement_key TEXT NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  actor_user_id UUID,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entitlement_audit_event_unique
  ON entitlement_audit_events (event_id);
