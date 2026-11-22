ALTER TABLE media_asset_derivatives
  ADD COLUMN IF NOT EXISTS source_owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS destination_owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS takedown_reason TEXT;

UPDATE media_asset_derivatives deriv
SET
  source_owner_user_id = source_asset.owner_user_id,
  destination_owner_user_id = destination_asset.owner_user_id,
  created_by_user_id = COALESCE(deriv.created_by_user_id, deriv.owner_user_id)
FROM media_assets source_asset,
     media_assets destination_asset
WHERE source_asset.id = deriv.source_media_asset_id
  AND destination_asset.id = deriv.destination_media_asset_id;

ALTER TABLE media_asset_derivatives
  ALTER COLUMN source_owner_user_id SET NOT NULL,
  ALTER COLUMN destination_owner_user_id SET NOT NULL,
  ALTER COLUMN created_by_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS media_asset_derivatives_status_idx
  ON media_asset_derivatives (status, updated_at DESC);
