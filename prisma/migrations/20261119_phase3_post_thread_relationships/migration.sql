ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thread_root_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_thread_root_created_idx
  ON posts (thread_root_post_id, created_at ASC);
