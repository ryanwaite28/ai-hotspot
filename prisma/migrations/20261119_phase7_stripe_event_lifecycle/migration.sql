ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

UPDATE stripe_events
SET
  status = COALESCE(status, processed_status),
  failure_reason = COALESCE(failure_reason, processed_status),
  received_at = COALESCE(received_at, NOW()),
  processed_at = COALESCE(processed_at, NOW())
WHERE status IS NULL;

ALTER TABLE stripe_events
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'received',
  ALTER COLUMN received_at SET NOT NULL,
  ALTER COLUMN received_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS stripe_events_status_lease_idx
  ON stripe_events (status, lease_expires_at);
