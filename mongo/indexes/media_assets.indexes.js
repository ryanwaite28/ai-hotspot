const mediaAssetsIndexes = [
  {
    key: { owner_user_id: 1, created_at: -1 },
    name: 'media_assets_owner_created_idx',
  },
  {
    key: { processing_status: 1, created_at: -1 },
    name: 'media_assets_processing_status_idx',
  },
  {
    key: { source_media_asset_id: 1 },
    name: 'media_assets_source_idx',
    sparse: true,
  },
  {
    key: { visibility: 1, created_at: -1 },
    name: 'media_assets_visibility_created_idx',
  },
];

const mediaCommentsIndexes = [
  {
    key: { media_asset_id: 1, created_at: 1 },
    name: 'media_comments_asset_created_idx',
  },
  {
    key: { author_user_id: 1, created_at: -1 },
    name: 'media_comments_author_created_idx',
  },
  {
    key: { parent_comment_id: 1, created_at: 1 },
    name: 'media_comments_parent_created_idx',
    sparse: true,
  },
];

module.exports = {
  mediaAssetsIndexes,
  mediaCommentsIndexes,
};
