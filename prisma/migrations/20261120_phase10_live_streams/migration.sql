ALTER TABLE live_streams
  ADD COLUMN IF NOT EXISTS room_ref TEXT,
  ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE live_streams
SET
  room_ref = COALESCE(room_ref, 'live-' || id::text),
  recording_enabled = COALESCE(recording_enabled, FALSE),
  updated_at = COALESCE(updated_at, created_at)
WHERE room_ref IS NULL
   OR recording_enabled IS NULL
   OR updated_at IS NULL;

ALTER TABLE live_streams
  ALTER COLUMN room_ref SET NOT NULL,
  ALTER COLUMN recording_enabled SET DEFAULT FALSE,
  ALTER COLUMN recording_enabled SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS live_streams_status_schedule_idx
  ON live_streams (status, scheduled_at);
CREATE INDEX IF NOT EXISTS live_chat_stream_created_idx
  ON live_chat_messages (live_stream_id, created_at ASC);
