ALTER TABLE consumed_domain_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

UPDATE consumed_domain_events
SET
  attempt_count = CASE WHEN attempt_count = 0 THEN 1 ELSE attempt_count END,
  first_seen_at = COALESCE(first_seen_at, processed_at),
  last_attempt_at = COALESCE(last_attempt_at, processed_at),
  completed_at = COALESCE(completed_at, processed_at),
  status = CASE WHEN status = 'processed' THEN 'processed' ELSE status END
WHERE TRUE;

CREATE INDEX IF NOT EXISTS consumed_domain_events_status_lease_idx
ON consumed_domain_events (status, lease_expires_at);
