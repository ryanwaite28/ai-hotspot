ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS period_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE subscriptions
SET
  status = COALESCE(status, 'pending'),
  period_start_at = COALESCE(period_start_at, created_at),
  period_end_at = COALESCE(period_end_at, created_at + INTERVAL '30 days'),
  refund_status = COALESCE(refund_status, 'none'),
  updated_at = COALESCE(updated_at, created_at)
WHERE status IS NULL
   OR period_start_at IS NULL
   OR period_end_at IS NULL
   OR refund_status IS NULL
   OR updated_at IS NULL;

ALTER TABLE subscriptions
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN period_start_at SET NOT NULL,
  ALTER COLUMN period_end_at SET NOT NULL,
  ALTER COLUMN refund_status SET DEFAULT 'none',
  ALTER COLUMN refund_status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_creator_status_idx
  ON subscriptions (creator_id, status, period_end_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_subscriber_status_idx
  ON subscriptions (subscriber_id, status, period_end_at DESC);
