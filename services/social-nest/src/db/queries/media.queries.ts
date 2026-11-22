import type { DbRow, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface MediaUploadSessionRow extends DbRow {
  upload_session_id: string;
  media_asset_id: string;
  owner_user_id: string;
  media_kind: 'photo' | 'video';
  provider: string;
  upload_url: string;
  object_key: string;
  mime_type: string;
  file_size_bytes: number;
  chunk_size_bytes: number;
  upload_status: 'created' | 'completed' | 'expired';
  processing_status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
  visibility: 'public' | 'followers' | 'private';
  caption: string | null;
  alt_text: string | null;
  allow_remix: boolean;
  source_media_asset_id: string | null;
  ready_at: string | null;
  expires_at: string;
  session_created_at: string;
  asset_created_at: string;
  asset_updated_at: string;
}

export interface MediaAssetRow extends DbRow {
  id: string;
  owner_user_id: string;
  upload_session_id: string;
  media_kind: 'photo' | 'video';
  mime_type: string;
  object_key: string;
  processing_status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
  visibility: 'public' | 'followers' | 'private';
  caption: string | null;
  alt_text: string | null;
  allow_remix: boolean;
  source_media_asset_id: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaCommentRow extends DbRow {
  id: string;
  media_asset_id: string;
  parent_comment_id: string | null;
  author_user_id: string;
  body_text: string;
  status: 'published' | 'deleted';
  created_at: string;
  deleted_at: string | null;
}

export interface MediaDerivativeRelationshipRow extends DbRow {
  id: string;
  source_media_asset_id: string;
  destination_media_asset_id: string;
  derivative_type: 'stitch' | 'duet';
  assembly_json: string;
  owner_user_id: string;
  source_owner_user_id: string;
  destination_owner_user_id: string;
  created_by_user_id: string;
  status: 'created' | 'processing' | 'ready' | 'rejected' | 'takedown';
  takedown_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const mediaQueries = {
  insertUploadSessionAndAssetWithOutbox: `
    WITH inserted_session AS (
      INSERT INTO media_upload_sessions (
        user_id,
        provider,
        upload_url,
        object_key,
        mime_type,
        file_size_bytes,
        chunk_size_bytes,
        status,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'created',
        to_timestamp($8)
      )
      RETURNING id, user_id, provider, upload_url, object_key, mime_type, file_size_bytes,
        chunk_size_bytes, status, expires_at, created_at
    ),
    inserted_asset AS (
      INSERT INTO media_assets (
        owner_user_id,
        upload_session_id,
        media_kind,
        mime_type,
        object_key,
        processing_status,
        visibility,
        caption,
        alt_text,
        allow_remix,
        source_media_asset_id
      )
      SELECT
        ises.user_id,
        ises.id,
        $9,
        ises.mime_type,
        ises.object_key,
        'uploading',
        $10,
        $11,
        $12,
        $13,
        NULL
      FROM inserted_session ises
      RETURNING id, owner_user_id, upload_session_id, media_kind, mime_type, object_key,
        processing_status, visibility, caption, alt_text, allow_remix, source_media_asset_id,
        ready_at, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $14,
        'media_asset',
        ia.id,
        NULL,
        'media.created',
        jsonb_build_object(
          'mediaAssetId', ia.id,
          'ownerUserId', ia.owner_user_id,
          'mediaKind', ia.media_kind,
          'processingStatus', ia.processing_status,
          'visibility', ia.visibility
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($15)
      FROM inserted_asset ia
      RETURNING id
    )
    SELECT
      ises.id AS upload_session_id,
      ia.id AS media_asset_id,
      ia.owner_user_id,
      ia.media_kind,
      ises.provider,
      ises.upload_url,
      ia.object_key,
      ia.mime_type,
      ises.file_size_bytes,
      ises.chunk_size_bytes,
      ises.status AS upload_status,
      ia.processing_status,
      ia.visibility,
      ia.caption,
      ia.alt_text,
      ia.allow_remix,
      ia.source_media_asset_id,
      ia.ready_at,
      ises.expires_at,
      ises.created_at AS session_created_at,
      ia.created_at AS asset_created_at,
      ia.updated_at AS asset_updated_at
    FROM inserted_session ises
    JOIN inserted_asset ia ON ia.upload_session_id = ises.id
  `,

  insertCarouselItem: `
    INSERT INTO media_asset_carousel_items (
      media_asset_id,
      position,
      child_media_asset_id
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (media_asset_id, position) DO UPDATE
      SET child_media_asset_id = EXCLUDED.child_media_asset_id
  `,

  selectMediaAssetById: `
    SELECT
      id,
      owner_user_id,
      upload_session_id,
      media_kind,
      mime_type,
      object_key,
      processing_status,
      visibility,
      caption,
      alt_text,
      allow_remix,
      source_media_asset_id,
      ready_at,
      created_at,
      updated_at
    FROM media_assets
    WHERE id = $1
    LIMIT 1
  `,

  selectMediaAssetByUploadSessionId: `
    SELECT
      id,
      owner_user_id,
      upload_session_id,
      media_kind,
      mime_type,
      object_key,
      processing_status,
      visibility,
      caption,
      alt_text,
      allow_remix,
      source_media_asset_id,
      ready_at,
      created_at,
      updated_at
    FROM media_assets
    WHERE upload_session_id = $1
    LIMIT 1
  `,

  markUploadSessionCompletedAndSelectAsset: `
    WITH updated_session AS (
      UPDATE media_upload_sessions
      SET
        status = 'completed',
        updated_at = NOW()
      WHERE id = $1
        AND status IN ('created', 'completed')
      RETURNING id
    )
    SELECT
      ma.id,
      ma.owner_user_id,
      ma.upload_session_id,
      ma.media_kind,
      ma.mime_type,
      ma.object_key,
      ma.processing_status,
      ma.visibility,
      ma.caption,
      ma.alt_text,
      ma.allow_remix,
      ma.source_media_asset_id,
      ma.ready_at,
      ma.created_at,
      ma.updated_at
    FROM media_assets ma
    JOIN updated_session us ON us.id = ma.upload_session_id
    LIMIT 1
  `,

  updateMediaStatusWithOutbox: `
    WITH updated_asset AS (
      UPDATE media_assets
      SET
        processing_status = $2,
        ready_at = CASE WHEN $2 = 'ready' THEN NOW() ELSE ready_at END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, owner_user_id, upload_session_id, media_kind, mime_type, object_key,
        processing_status, visibility, caption, alt_text, allow_remix, source_media_asset_id,
        ready_at, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $3,
        'media_asset',
        ua.id,
        NULL,
        CASE
          WHEN ua.processing_status = 'uploaded' THEN 'media.uploaded'
          WHEN ua.processing_status = 'processing' THEN 'media.processing.requested'
          WHEN ua.processing_status = 'ready' THEN 'media.ready'
          WHEN ua.processing_status = 'rejected' THEN 'media.rejected'
          ELSE 'media.updated'
        END,
        jsonb_build_object(
          'mediaAssetId', ua.id,
          'ownerUserId', ua.owner_user_id,
          'processingStatus', ua.processing_status
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_asset ua
      RETURNING id
    )
    SELECT id, owner_user_id, upload_session_id, media_kind, mime_type, object_key,
      processing_status, visibility, caption, alt_text, allow_remix, source_media_asset_id,
      ready_at, created_at, updated_at
    FROM updated_asset
  `,

  insertMediaCommentWithOutbox: `
    WITH inserted_comment AS (
      INSERT INTO media_comments (
        media_asset_id,
        parent_comment_id,
        author_user_id,
        body_text,
        status
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        'published'
      WHERE EXISTS (SELECT 1 FROM media_assets WHERE id = $1)
      RETURNING id, media_asset_id, parent_comment_id, author_user_id, body_text, status, created_at, deleted_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $5,
        'media_asset',
        ic.media_asset_id,
        NULL,
        'media.comment.created',
        jsonb_build_object(
          'commentId', ic.id,
          'mediaAssetId', ic.media_asset_id,
          'authorUserId', ic.author_user_id,
          'parentCommentId', ic.parent_comment_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($6)
      FROM inserted_comment ic
      RETURNING id
    )
    SELECT id, media_asset_id, parent_comment_id, author_user_id, body_text, status, created_at, deleted_at
    FROM inserted_comment
  `,

  selectMediaCommentsByAsset: `
    SELECT
      id,
      media_asset_id,
      parent_comment_id,
      author_user_id,
      body_text,
      status,
      created_at,
      deleted_at
    FROM media_comments
    WHERE media_asset_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT $2
  `,

  insertMediaDerivativeRelationshipWithOutbox: `
    WITH eligible_assets AS (
      SELECT
        source_asset.id AS source_id,
        source_asset.owner_user_id AS source_owner_id,
        destination_asset.id AS destination_id,
        destination_asset.owner_user_id AS destination_owner_id
      FROM media_assets source_asset
      JOIN media_assets destination_asset ON destination_asset.id = $2
      WHERE source_asset.id = $1
        AND source_asset.processing_status = 'ready'
        AND source_asset.allow_remix = TRUE
        AND destination_asset.processing_status = 'ready'
        AND destination_asset.allow_remix = TRUE
    ),
    inserted_relationship AS (
      INSERT INTO media_asset_derivatives (
        source_media_asset_id,
        destination_media_asset_id,
        derivative_type,
        assembly_json,
        owner_user_id,
        source_owner_user_id,
        destination_owner_user_id,
        created_by_user_id,
        status
      )
      SELECT
        source_id,
        destination_id,
        $3,
        $4::jsonb,
        $5,
        source_owner_id,
        destination_owner_id,
        $5,
        'created'
      FROM eligible_assets
      WHERE source_owner_id = $5 OR destination_owner_id = $5
      ON CONFLICT (source_media_asset_id, destination_media_asset_id, derivative_type)
      DO NOTHING
      RETURNING id, source_media_asset_id, destination_media_asset_id,
        derivative_type, assembly_json, owner_user_id, status, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id,
        aggregate_type,
        aggregate_id,
        aggregate_version,
        event_type,
        payload,
        headers,
        occurred_at
      )
      SELECT
        $6,
        'media_asset',
        imr.destination_media_asset_id,
        NULL,
        'media.derivative.created',
        jsonb_build_object(
          'relationshipId', imr.id,
          'sourceMediaAssetId', imr.source_media_asset_id,
          'destinationMediaAssetId', imr.destination_media_asset_id,
          'derivativeType', imr.derivative_type,
          'ownerUserId', imr.owner_user_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($7)
      FROM inserted_relationship imr
      RETURNING id
    )
    SELECT id, source_media_asset_id, destination_media_asset_id,
      derivative_type, assembly_json::text, owner_user_id, status, created_at, updated_at
    FROM inserted_relationship
  `,

  updateMediaDerivativeStatusWithOutbox: `
    WITH updated_derivative AS (
      UPDATE media_asset_derivatives
      SET
        status = $2,
        takedown_reason = CASE WHEN $2 = 'takedown' THEN $3 ELSE takedown_reason END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, source_media_asset_id, destination_media_asset_id,
        derivative_type, assembly_json, owner_user_id,
        source_owner_user_id, destination_owner_user_id, created_by_user_id,
        status, takedown_reason, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type,
        payload, headers, occurred_at
      )
      SELECT
        $4,
        'media_asset',
        ud.destination_media_asset_id,
        NULL,
        CASE WHEN $2 = 'takedown' THEN 'media.derivative.takedown' ELSE 'media.derivative.status.changed' END,
        jsonb_build_object(
          'relationshipId', ud.id,
          'sourceMediaAssetId', ud.source_media_asset_id,
          'destinationMediaAssetId', ud.destination_media_asset_id,
          'derivativeType', ud.derivative_type,
          'status', ud.status,
          'takedownReason', ud.takedown_reason,
          'sourceOwnerUserId', ud.source_owner_user_id,
          'destinationOwnerUserId', ud.destination_owner_user_id,
          'createdByUserId', ud.created_by_user_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($5)
      FROM updated_derivative ud
      RETURNING id
    )
    SELECT id, source_media_asset_id, destination_media_asset_id,
      derivative_type, assembly_json::text, owner_user_id,
      source_owner_user_id, destination_owner_user_id, created_by_user_id,
      status, takedown_reason, created_at, updated_at
    FROM updated_derivative
  `,

  takeDownDerivativesFromSourceWithOutbox: `
    WITH updated_derivatives AS (
      UPDATE media_asset_derivatives
      SET
        status = 'takedown',
        takedown_reason = $2,
        updated_at = NOW()
      WHERE source_media_asset_id = $1
        AND status != 'takedown'
      RETURNING id, source_media_asset_id, destination_media_asset_id,
        derivative_type, assembly_json, owner_user_id,
        source_owner_user_id, destination_owner_user_id, created_by_user_id,
        status, takedown_reason, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type,
        payload, headers, occurred_at
      )
      SELECT
        md5(ud.id::text || ':' || $3),
        'media_asset',
        ud.destination_media_asset_id,
        NULL,
        'media.derivative.takedown',
        jsonb_build_object(
          'relationshipId', ud.id,
          'sourceMediaAssetId', ud.source_media_asset_id,
          'destinationMediaAssetId', ud.destination_media_asset_id,
          'derivativeType', ud.derivative_type,
          'status', 'takedown',
          'takedownReason', ud.takedown_reason,
          'sourceOwnerUserId', ud.source_owner_user_id,
          'destinationOwnerUserId', ud.destination_owner_user_id,
          'createdByUserId', ud.created_by_user_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_derivatives ud
      RETURNING id
    )
    SELECT id, source_media_asset_id, destination_media_asset_id,
      derivative_type, assembly_json::text, owner_user_id,
      source_owner_user_id, destination_owner_user_id, created_by_user_id,
      status, takedown_reason, created_at, updated_at
    FROM updated_derivatives
  `,
};
