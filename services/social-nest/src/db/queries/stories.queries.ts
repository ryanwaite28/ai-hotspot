import type { DbRow, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface StoryRow extends DbRow {
  id: string;
  author_id: string;
  media_asset_id: string;
  visibility: 'public' | 'followers' | 'close_friends';
  expires_at: string;
  created_at: string;
}

export interface ReadyMediaAssetCheckRow extends DbRow {
  can_publish: boolean;
}

export interface StoryRelationshipStateRow extends DbRow {
  is_following: boolean;
  is_blocked: boolean;
}

export interface StoryOwnerRow extends DbRow {
  author_user_id: string;
  story_owner_email: string;
}

export const storyQueries = {
  selectReadyMediaAssetForStory: `
    SELECT EXISTS (
      SELECT 1
      FROM media_assets
      WHERE id = $1
        AND owner_user_id = $2
        AND processing_status = 'ready'
    ) AS can_publish
  `,

  insertStoryWithOutbox: `
    WITH inserted_story AS (
      INSERT INTO stories (
        author_id,
        media_asset_id,
        visibility,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        to_timestamp($4)
      )
      RETURNING id, author_id, media_asset_id, visibility, expires_at, created_at
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
        'story',
        isr.id,
        NULL,
        'story.created',
        jsonb_build_object(
          'storyId', isr.id,
          'authorUserId', isr.author_id,
          'mediaAssetId', isr.media_asset_id,
          'visibility', isr.visibility,
          'expiresAt', isr.expires_at
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($6)
      FROM inserted_story isr
      RETURNING id
    )
    SELECT id, author_id, media_asset_id, visibility, expires_at, created_at
    FROM inserted_story
  `,

  selectActiveStoriesByAuthor: `
    SELECT id, author_id, media_asset_id, visibility, expires_at, created_at
    FROM stories
    WHERE author_id = $1
      AND expires_at > to_timestamp($2)
    ORDER BY created_at DESC
    LIMIT $3
  `,

  selectActiveStoryById: `
    SELECT id, author_id, media_asset_id, visibility, expires_at, created_at
    FROM stories
    WHERE id = $1
      AND expires_at > to_timestamp($2)
    LIMIT 1
  `,

  selectStoryRelationshipState: `
    SELECT
      EXISTS (
        SELECT 1
        FROM follows
        WHERE follower_id = $1
          AND following_id = $2
          AND status = 'accepted'
      ) AS is_following,
      EXISTS (
        SELECT 1
        FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
      ) AS is_blocked
  `,

  selectActiveStoryOwnerById: `
    SELECT
      s.author_id AS author_user_id,
      u.email AS story_owner_email
    FROM stories s
    INNER JOIN users u ON u.id = s.author_id
    WHERE s.id = $1
      AND s.expires_at > to_timestamp($2)
    LIMIT 1
  `,

  insertStoryReplyCreatedOutbox: `
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
    VALUES (
      $1,
      'story',
      $2,
      NULL,
      'story.reply.created',
      jsonb_build_object(
        'storyId', $2,
        'storyOwnerUserId', $3,
        'storyOwnerEmail', $4,
        'replyAuthorUserId', $5,
        'replyBodyText', $6
      ),
      jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
      to_timestamp($7)
    )
    RETURNING event_id
  `,

  deleteExpiredStoriesWithOutbox: `
    WITH expired_candidates AS (
      SELECT id, author_id, media_asset_id, visibility, expires_at, created_at
      FROM stories
      WHERE expires_at <= to_timestamp($1)
      ORDER BY expires_at ASC
      LIMIT $2
    ),
    deleted_stories AS (
      DELETE FROM stories s
      USING expired_candidates ec
      WHERE s.id = ec.id
      RETURNING ec.id, ec.author_id, ec.media_asset_id, ec.visibility, ec.expires_at, ec.created_at
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
        md5(ds.id::text || ':' || $3),
        'story',
        ds.id,
        NULL,
        'story.expired',
        jsonb_build_object(
          'storyId', ds.id,
          'authorUserId', ds.author_id,
          'mediaAssetId', ds.media_asset_id,
          'visibility', ds.visibility,
          'expiredAt', to_timestamp($1)
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api', 'source', $3),
        to_timestamp($1)
      FROM deleted_stories ds
      RETURNING id
    )
    SELECT id, author_id, media_asset_id, visibility, expires_at, created_at
    FROM deleted_stories
  `,
};
