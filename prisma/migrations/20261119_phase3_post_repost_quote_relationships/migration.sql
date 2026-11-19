ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS repost_of_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_of_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_repost_quote_idx
  ON posts (repost_of_post_id, quote_of_post_id, created_at DESC);
