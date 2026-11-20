CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category, channel)
);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_moderator_id UUID REFERENCES users(id),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  appeal_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  actor_user_id UUID REFERENCES users(id),
  case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_cases_status_idx
  ON moderation_cases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_cases_target_idx
  ON moderation_cases (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
  ON notification_preferences (user_id, category);
