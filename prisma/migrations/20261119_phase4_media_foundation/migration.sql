CREATE TABLE IF NOT EXISTS media_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  upload_url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  chunk_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (object_key)
);

CREATE INDEX IF NOT EXISTS media_upload_sessions_user_created_idx
  ON media_upload_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_upload_sessions_status_expiry_idx
  ON media_upload_sessions (status, expires_at ASC);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upload_session_id UUID NOT NULL REFERENCES media_upload_sessions(id) ON DELETE RESTRICT,
  media_kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  allow_remix BOOLEAN NOT NULL DEFAULT FALSE,
  source_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (object_key)
);

CREATE INDEX IF NOT EXISTS media_assets_owner_created_idx
  ON media_assets (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_processing_status_idx
  ON media_assets (processing_status, created_at DESC);

CREATE TABLE IF NOT EXISTS media_asset_carousel_items (
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  child_media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY (media_asset_id, position)
);

CREATE INDEX IF NOT EXISTS media_asset_carousel_child_idx
  ON media_asset_carousel_items (child_media_asset_id);

CREATE TABLE IF NOT EXISTS media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES media_comments(id) ON DELETE SET NULL,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS media_comments_asset_created_idx
  ON media_comments (media_asset_id, created_at ASC);

CREATE INDEX IF NOT EXISTS media_comments_author_created_idx
  ON media_comments (author_user_id, created_at DESC);
