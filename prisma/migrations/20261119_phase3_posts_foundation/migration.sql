CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  pinned_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_author_created_idx
  ON posts (author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_status_published_idx
  ON posts (status, published_at DESC);
