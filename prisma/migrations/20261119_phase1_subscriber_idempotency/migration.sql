CREATE TABLE IF NOT EXISTS consumed_domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscriber_name, event_id)
);

CREATE INDEX IF NOT EXISTS consumed_domain_events_event_type_idx
ON consumed_domain_events (event_type, processed_at DESC);
