import type { StoryView } from '../../../../../packages/contracts/src';
import {
  storyQueries,
  type QueryExecutor,
  type ReadyMediaAssetCheckRow,
  type StoryOwnerRow,
  type StoryRelationshipStateRow,
  type StoryRow,
} from '../../db/queries/stories.queries';

export interface StoriesRepository {
  canPublishStoryFromMedia(input: {
    actorUserId: string;
    mediaAssetId: string;
  }): Promise<boolean>;
  createStory(input: {
    actorUserId: string;
    mediaAssetId: string;
    visibility: 'public' | 'followers' | 'close_friends';
    expiresAtEpochSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<StoryView | null>;
  listActiveStoriesByAuthor(input: {
    authorUserId: string;
    nowEpochSeconds: number;
    limit: number;
  }): Promise<StoryView[]>;
  getActiveStoryById(input: {
    storyId: string;
    nowEpochSeconds: number;
  }): Promise<StoryView | null>;
  getRelationshipState(input: {
    viewerUserId: string;
    authorUserId: string;
  }): Promise<{ isFollowing: boolean; isBlocked: boolean }>;
  expireStories(input: {
    nowEpochSeconds: number;
    limit: number;
    eventSource: 'worker' | 'api';
  }): Promise<StoryView[]>;
  enqueueStoryReplyCreatedEvent(input: {
    storyId: string;
    replyAuthorUserId: string;
    replyBodyText: string;
    eventId: string;
    occurredAtEpochSeconds: number;
    nowEpochSeconds: number;
  }): Promise<boolean>;
}

function mapStoryRow(row: StoryRow): StoryView {
  return {
    storyId: row.id,
    authorUserId: row.author_id,
    mediaAssetId: row.media_asset_id,
    visibility: row.visibility,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class PostgresStoriesRepository implements StoriesRepository {
  constructor(private readonly db: QueryExecutor) {}

  async canPublishStoryFromMedia(input: {
    actorUserId: string;
    mediaAssetId: string;
  }): Promise<boolean> {
    const result = await this.db.query<ReadyMediaAssetCheckRow>(storyQueries.selectReadyMediaAssetForStory, [
      input.mediaAssetId,
      input.actorUserId,
    ]);

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].can_publish;
  }

  async createStory(input: {
    actorUserId: string;
    mediaAssetId: string;
    visibility: 'public' | 'followers' | 'close_friends';
    expiresAtEpochSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<StoryView | null> {
    const result = await this.db.query<StoryRow>(storyQueries.insertStoryWithOutbox, [
      input.actorUserId,
      input.mediaAssetId,
      input.visibility,
      input.expiresAtEpochSeconds,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapStoryRow(result.rows[0]);
  }

  async listActiveStoriesByAuthor(input: {
    authorUserId: string;
    nowEpochSeconds: number;
    limit: number;
  }): Promise<StoryView[]> {
    const result = await this.db.query<StoryRow>(storyQueries.selectActiveStoriesByAuthor, [
      input.authorUserId,
      input.nowEpochSeconds,
      input.limit,
    ]);

    return result.rows.map(mapStoryRow);
  }

  async getActiveStoryById(input: {
    storyId: string;
    nowEpochSeconds: number;
  }): Promise<StoryView | null> {
    const result = await this.db.query<StoryRow>(storyQueries.selectActiveStoryById, [
      input.storyId,
      input.nowEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapStoryRow(result.rows[0]);
  }

  async getRelationshipState(input: {
    viewerUserId: string;
    authorUserId: string;
  }): Promise<{ isFollowing: boolean; isBlocked: boolean }> {
    const result = await this.db.query<StoryRelationshipStateRow>(storyQueries.selectStoryRelationshipState, [
      input.viewerUserId,
      input.authorUserId,
    ]);

    if (result.rows.length === 0) {
      return {
        isFollowing: false,
        isBlocked: false,
      };
    }

    return {
      isFollowing: result.rows[0].is_following,
      isBlocked: result.rows[0].is_blocked,
    };
  }

  async expireStories(input: {
    nowEpochSeconds: number;
    limit: number;
    eventSource: 'worker' | 'api';
  }): Promise<StoryView[]> {
    const result = await this.db.query<StoryRow>(storyQueries.deleteExpiredStoriesWithOutbox, [
      input.nowEpochSeconds,
      input.limit,
      input.eventSource,
    ]);

    return result.rows.map(mapStoryRow);
  }

  async enqueueStoryReplyCreatedEvent(input: {
    storyId: string;
    replyAuthorUserId: string;
    replyBodyText: string;
    eventId: string;
    occurredAtEpochSeconds: number;
    nowEpochSeconds: number;
  }): Promise<boolean> {
    const ownerResult = await this.db.query<StoryOwnerRow>(storyQueries.selectActiveStoryOwnerById, [
      input.storyId,
      input.nowEpochSeconds,
    ]);

    if (ownerResult.rows.length === 0) {
      return false;
    }

    const owner = ownerResult.rows[0];

    await this.db.query(storyQueries.insertStoryReplyCreatedOutbox, [
      input.eventId,
      input.storyId,
      owner.author_user_id,
      owner.story_owner_email,
      input.replyAuthorUserId,
      input.replyBodyText,
      input.occurredAtEpochSeconds,
    ]);

    return true;
  }
}
