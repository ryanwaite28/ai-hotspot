import type { DbRow, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface PostRow extends DbRow {
  id: string;
  author_user_id: string;
  parent_post_id: string | null;
  thread_root_post_id: string | null;
  repost_of_post_id: string | null;
  quote_of_post_id: string | null;
  content_text: string;
  like_count: number;
  bookmark_count: number;
  share_count: number;
  status: 'draft' | 'scheduled' | 'published' | 'deleted';
  visibility: 'public' | 'followers' | 'private';
  pinned_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PostRelationshipStateRow extends DbRow {
  is_following: boolean;
  is_blocked: boolean;
}

export const postQueries = {
  insertPostWithOutbox: `
    WITH inserted_post AS (
      INSERT INTO posts (
        author_user_id,
        parent_post_id,
        thread_root_post_id,
        repost_of_post_id,
        quote_of_post_id,
        content_text,
        status,
        visibility,
        scheduled_for,
        published_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        CASE WHEN $7 = 'scheduled' THEN to_timestamp($9) ELSE NULL END,
        CASE WHEN $7 = 'published' THEN to_timestamp($9) ELSE NULL END
      )
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
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
        $10,
        'post',
        ip.id,
        NULL,
        CASE
          WHEN ip.parent_post_id IS NOT NULL THEN 'post.replied'
          WHEN ip.repost_of_post_id IS NOT NULL THEN 'post.reposted'
          WHEN ip.quote_of_post_id IS NOT NULL THEN 'post.quoted'
          ELSE 'post.created'
        END,
        jsonb_build_object(
          'postId', ip.id,
          'authorUserId', ip.author_user_id,
          'status', ip.status,
          'visibility', ip.visibility,
          'parentPostId', ip.parent_post_id,
          'threadRootPostId', ip.thread_root_post_id,
          'repostOfPostId', ip.repost_of_post_id,
          'quoteOfPostId', ip.quote_of_post_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($11)
      FROM inserted_post ip
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM inserted_post
  `,

  selectPostById: `
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM posts
    WHERE id = $1
    LIMIT 1
  `,

  selectPostByAuthorAndId: `
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM posts
    WHERE id = $1 AND author_user_id = $2
    LIMIT 1
  `,

  selectPostRelationshipState: `
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

  updatePostWithOutbox: `
    WITH updated_post AS (
      UPDATE posts
      SET
        content_text = COALESCE($3, content_text),
        visibility = COALESCE($4, visibility),
        updated_at = NOW()
      WHERE id = $1
        AND author_user_id = $2
        AND status != 'deleted'
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
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
        'post',
        up.id,
        NULL,
        'post.updated',
        jsonb_build_object(
          'postId', up.id,
          'authorUserId', up.author_user_id,
          'visibility', up.visibility,
          'parentPostId', up.parent_post_id,
          'threadRootPostId', up.thread_root_post_id,
          'repostOfPostId', up.repost_of_post_id,
          'quoteOfPostId', up.quote_of_post_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($6)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  deletePostWithOutbox: `
    WITH deleted_post AS (
      UPDATE posts
      SET
        status = 'deleted',
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND author_user_id = $2
        AND status != 'deleted'
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
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
        'post',
        dp.id,
        NULL,
        'post.deleted',
        jsonb_build_object(
          'postId', dp.id,
          'authorUserId', dp.author_user_id,
          'parentPostId', dp.parent_post_id,
          'threadRootPostId', dp.thread_root_post_id,
          'repostOfPostId', dp.repost_of_post_id,
          'quoteOfPostId', dp.quote_of_post_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM deleted_post dp
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM deleted_post
  `,

  setPostPinnedWithOutbox: `
    WITH updated_post AS (
      UPDATE posts
      SET
        pinned_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1
        AND author_user_id = $2
        AND status = 'published'
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
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
        'post',
        up.id,
        NULL,
        'post.pinned',
        jsonb_build_object(
          'postId', up.id,
          'authorUserId', up.author_user_id,
          'pinned', $3,
          'parentPostId', up.parent_post_id,
          'threadRootPostId', up.thread_root_post_id,
          'repostOfPostId', up.repost_of_post_id,
          'quoteOfPostId', up.quote_of_post_id
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($5)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  likePostWithOutbox: `
    WITH inserted_like AS (
      INSERT INTO post_likes (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING post_id
    ),
    updated_post AS (
      UPDATE posts p
      SET like_count = p.like_count + 1, updated_at = NOW()
      WHERE p.id IN (SELECT post_id FROM inserted_like)
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'post', up.id, NULL, 'post.liked',
        jsonb_build_object('postId', up.id, 'actorUserId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  unlikePostWithOutbox: `
    WITH deleted_like AS (
      DELETE FROM post_likes
      WHERE post_id = $1 AND user_id = $2
      RETURNING post_id
    ),
    updated_post AS (
      UPDATE posts p
      SET like_count = GREATEST(p.like_count - 1, 0), updated_at = NOW()
      WHERE p.id IN (SELECT post_id FROM deleted_like)
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'post', up.id, NULL, 'post.unliked',
        jsonb_build_object('postId', up.id, 'actorUserId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  bookmarkPostWithOutbox: `
    WITH inserted_bookmark AS (
      INSERT INTO post_bookmarks (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING post_id
    ),
    updated_post AS (
      UPDATE posts p
      SET bookmark_count = p.bookmark_count + 1, share_count = p.share_count + 1, updated_at = NOW()
      WHERE p.id IN (SELECT post_id FROM inserted_bookmark)
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'post', up.id, NULL, 'post.bookmarked',
        jsonb_build_object('postId', up.id, 'actorUserId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  unbookmarkPostWithOutbox: `
    WITH deleted_bookmark AS (
      DELETE FROM post_bookmarks
      WHERE post_id = $1 AND user_id = $2
      RETURNING post_id
    ),
    updated_post AS (
      UPDATE posts p
      SET
        bookmark_count = GREATEST(p.bookmark_count - 1, 0),
        share_count = GREATEST(p.share_count - 1, 0),
        updated_at = NOW()
      WHERE p.id IN (SELECT post_id FROM deleted_bookmark)
      RETURNING id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
        content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
        published_at, created_at, updated_at, deleted_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'post', up.id, NULL, 'post.unbookmarked',
        jsonb_build_object('postId', up.id, 'actorUserId', $2),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM updated_post up
      RETURNING id
    )
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM updated_post
  `,

  selectFollowingFeedPage: `
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM posts p
    WHERE p.status = 'published'
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_user_id)
           OR (b.blocker_id = p.author_user_id AND b.blocked_id = $1)
      )
      AND (
        p.author_user_id = $1
        OR (
          p.visibility IN ('public', 'followers')
          AND EXISTS (
            SELECT 1
            FROM follows f
            WHERE f.follower_id = $1
              AND f.following_id = p.author_user_id
              AND f.status = 'accepted'
          )
        )
      )
      AND (
        $2::timestamptz IS NULL
        OR (COALESCE(p.published_at, p.created_at), p.id) < ($2::timestamptz, $3::uuid)
      )
    ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC
    LIMIT $4
  `,

  selectPublicFeedPage: `
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM posts p
    WHERE p.status = 'published'
      AND p.deleted_at IS NULL
      AND p.visibility = 'public'
      AND (
        $1::timestamptz IS NULL
        OR (COALESCE(p.published_at, p.created_at), p.id) < ($1::timestamptz, $2::uuid)
      )
    ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC
    LIMIT $3
  `,

  selectTopicFeedPage: `
    SELECT id, author_user_id, parent_post_id, thread_root_post_id, repost_of_post_id, quote_of_post_id,
      content_text, like_count, bookmark_count, share_count, status, visibility, pinned_at, scheduled_for,
      published_at, created_at, updated_at, deleted_at
    FROM posts p
    WHERE p.status = 'published'
      AND p.deleted_at IS NULL
      AND p.visibility = 'public'
      AND POSITION('#' || LOWER($1) IN LOWER(p.content_text)) > 0
      AND (
        $2::timestamptz IS NULL
        OR (COALESCE(p.published_at, p.created_at), p.id) < ($2::timestamptz, $3::uuid)
      )
    ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC
    LIMIT $4
  `,
};
