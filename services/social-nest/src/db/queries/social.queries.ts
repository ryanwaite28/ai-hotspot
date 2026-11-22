import type { DbRow, JsonValue, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface ProfileRow extends DbRow {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  links: JsonValue;
  visibility: 'public' | 'protected';
  follower_list_visibility: 'public' | 'followers' | 'private';
}

export interface RelationshipStateRow extends DbRow {
  is_following: boolean;
  is_followed_by_viewer: boolean;
  is_blocked: boolean;
  is_muted: boolean;
}

export interface FollowRow extends DbRow {
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  updated_at: string;
}

export interface FollowerEdgeRow extends DbRow {
  follower_id: string;
  handle: string;
  display_name: string;
  created_at: string;
}

export const socialQueries = {
  selectProfileByHandle: `
    SELECT
      u.id AS user_id,
      u.handle,
      u.display_name,
      ps.bio,
      ps.avatar_url,
      ps.links,
      ps.visibility,
      ps.follower_list_visibility
    FROM users u
    LEFT JOIN profile_settings ps ON ps.user_id = u.id
    WHERE lower(u.handle) = lower($1)
      AND u.deleted_at IS NULL
    LIMIT 1
  `,
  selectProfileByUserId: `
    SELECT
      u.id AS user_id,
      u.handle,
      u.display_name,
      ps.bio,
      ps.avatar_url,
      ps.links,
      ps.visibility,
      ps.follower_list_visibility
    FROM users u
    LEFT JOIN profile_settings ps ON ps.user_id = u.id
    WHERE u.id = $1
      AND u.deleted_at IS NULL
    LIMIT 1
  `,
  selectRelationshipState: `
    SELECT
      EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted'
      ) AS is_following,
      EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = $2 AND following_id = $1 AND status = 'accepted'
      ) AS is_followed_by_viewer,
      EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
      ) AS is_blocked,
      EXISTS (
        SELECT 1 FROM mutes
        WHERE muter_id = $1 AND muted_id = $2
      ) AS is_muted
  `,
  upsertProfileWithOutbox: `
    WITH updated_user AS (
      UPDATE users
      SET
        handle = COALESCE($2, handle),
        display_name = COALESCE($3, display_name),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, handle, display_name
    ),
    upsert_settings AS (
      INSERT INTO profile_settings (
        user_id,
        bio,
        avatar_url,
        links,
        visibility,
        follower_list_visibility,
        updated_at
      )
      VALUES (
        $1,
        $4,
        $5,
        COALESCE($6::jsonb, '[]'::jsonb),
        COALESCE($7, 'public'),
        COALESCE($8, 'followers'),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        bio = COALESCE(EXCLUDED.bio, profile_settings.bio),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profile_settings.avatar_url),
        links = CASE WHEN $6::jsonb IS NULL THEN profile_settings.links ELSE EXCLUDED.links END,
        visibility = COALESCE(EXCLUDED.visibility, profile_settings.visibility),
        follower_list_visibility = COALESCE(EXCLUDED.follower_list_visibility, profile_settings.follower_list_visibility),
        updated_at = NOW()
      RETURNING user_id, bio, avatar_url, links, visibility, follower_list_visibility
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
        $9,
        'user',
        uu.id,
        NULL,
        'profile.updated',
        jsonb_build_object(
          'userId', uu.id,
          'handle', uu.handle,
          'displayName', uu.display_name,
          'visibility', us.visibility,
          'followerListVisibility', us.follower_list_visibility
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($10)
      FROM updated_user uu
      JOIN upsert_settings us ON us.user_id = uu.id
      RETURNING id
    )
    SELECT
      uu.id AS user_id,
      uu.handle,
      uu.display_name,
      us.bio,
      us.avatar_url,
      us.links,
      us.visibility,
      us.follower_list_visibility
    FROM updated_user uu
    JOIN upsert_settings us ON us.user_id = uu.id
  `,
  upsertFollowWithOutbox: `
    WITH upsert_follow AS (
      INSERT INTO follows (follower_id, following_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (follower_id, following_id) DO UPDATE
      SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING follower_id, following_id, status, created_at, updated_at
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
        $4,
        'user',
        uf.following_id,
        NULL,
        CASE WHEN uf.status = 'accepted' THEN 'follow.accepted' ELSE 'follow.requested' END,
        jsonb_build_object(
          'followerId', uf.follower_id,
          'followingId', uf.following_id,
          'status', uf.status
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($5)
      FROM upsert_follow uf
      RETURNING id
    )
    SELECT follower_id, following_id, status, created_at, updated_at
    FROM upsert_follow
  `,
  deleteFollowWithOutbox: `
    WITH deleted_follow AS (
      DELETE FROM follows
      WHERE follower_id = $1 AND following_id = $2
      RETURNING follower_id, following_id
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
        'user',
        df.following_id,
        NULL,
        'follow.removed',
        jsonb_build_object('followerId', df.follower_id, 'followingId', df.following_id),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM deleted_follow df
      RETURNING id
    )
    SELECT follower_id, following_id
    FROM deleted_follow
  `,
  upsertBlockWithOutbox: `
    WITH upsert_block AS (
      INSERT INTO blocks (blocker_id, blocked_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      RETURNING blocker_id, blocked_id
    ),
    cleared_follows AS (
      DELETE FROM follows
      WHERE (follower_id = $1 AND following_id = $2)
         OR (follower_id = $2 AND following_id = $1)
      RETURNING follower_id, following_id
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
        'user',
        COALESCE((SELECT blocked_id FROM upsert_block LIMIT 1), $2::uuid),
        NULL,
        'user.blocked',
        jsonb_build_object('blockerId', $1, 'blockedId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      RETURNING id
    )
    SELECT COALESCE((SELECT blocker_id FROM upsert_block LIMIT 1), $1::uuid) AS blocker_id,
           COALESCE((SELECT blocked_id FROM upsert_block LIMIT 1), $2::uuid) AS blocked_id
  `,
  upsertMuteWithOutbox: `
    WITH upsert_mute AS (
      INSERT INTO mutes (muter_id, muted_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (muter_id, muted_id) DO NOTHING
      RETURNING muter_id, muted_id
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
        'user',
        COALESCE((SELECT muted_id FROM upsert_mute LIMIT 1), $2::uuid),
        NULL,
        'user.muted',
        jsonb_build_object('muterId', $1, 'mutedId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      RETURNING id
    )
    SELECT COALESCE((SELECT muter_id FROM upsert_mute LIMIT 1), $1::uuid) AS muter_id,
           COALESCE((SELECT muted_id FROM upsert_mute LIMIT 1), $2::uuid) AS muted_id
  `,
  selectFollowersPage: `
    SELECT
      f.follower_id,
      u.handle,
      u.display_name,
      f.created_at
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = $1
      AND f.status = 'accepted'
      AND (
        $2::timestamptz IS NULL
        OR (f.created_at, f.follower_id) < ($2::timestamptz, $3::uuid)
      )
    ORDER BY f.created_at DESC, f.follower_id DESC
    LIMIT $4
  `,
};
