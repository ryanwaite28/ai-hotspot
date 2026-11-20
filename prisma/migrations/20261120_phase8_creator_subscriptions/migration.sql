ALTER TABLE creator_tiers
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS recurring_interval TEXT,
  ADD COLUMN IF NOT EXISTS subscriber_limit INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE creator_tiers
SET
  recurring_interval = COALESCE(recurring_interval, 'monthly'),
  updated_at = COALESCE(updated_at, created_at)
WHERE recurring_interval IS NULL OR updated_at IS NULL;

ALTER TABLE creator_tiers
  ALTER COLUMN recurring_interval SET DEFAULT 'monthly',
  ALTER COLUMN recurring_interval SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_tier_stripe_price_unique
  ON creator_tiers (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_tiers_creator_status_idx
  ON creator_tiers (creator_id, status, created_at DESC);
