CREATE TABLE IF NOT EXISTS media_asset_derivatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  destination_media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  derivative_type TEXT NOT NULL,
  assembly_json JSONB NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_media_asset_id, destination_media_asset_id, derivative_type)
);

CREATE INDEX IF NOT EXISTS media_asset_derivatives_source_idx
  ON media_asset_derivatives (source_media_asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_asset_derivatives_destination_idx
  ON media_asset_derivatives (destination_media_asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_asset_derivatives_owner_idx
  ON media_asset_derivatives (owner_user_id, created_at DESC);
