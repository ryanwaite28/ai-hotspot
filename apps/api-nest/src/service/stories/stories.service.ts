import crypto from 'node:crypto';

import type {
  CreateStoryReplyInput,
  CreateStoryReplyResult,
  CreateStoryInput,
  ExpireStoriesInput,
  ExpireStoriesResult,
  ListStoryViewersInput,
  StoryView,
  StoryViewerSummary,
  StoryVisibility,
  ViewStoryInput,
} from '../../../../../packages/contracts/src';
import type { StoriesRepository } from './postgres-stories.repository';

const STORY_LIFETIME_SECONDS = 24 * 60 * 60;
const DEFAULT_EXPIRE_LIMIT = 100;
const MAX_EXPIRE_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const DEFAULT_VIEWER_LIMIT = 100;
const MAX_VIEWER_LIMIT = 500;

interface StoryViewsPort {
  recordStoryView(input: {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
  }): Promise<void>;
  listStoryViewers(input: {
    storyId: string;
    ownerUserId: string;
    limit: number;
  }): Promise<Array<{
    viewerUserId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
  }>>;
  getStoryViewCount(input: {
    storyId: string;
    ownerUserId: string;
  }): Promise<number>;
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class StoriesService {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly storyViews: StoryViewsPort,
  ) {}

  private normalizeVisibility(visibility?: StoryVisibility): StoryVisibility {
    return visibility ?? 'public';
  }

  private normalizeReplyBodyText(replyBodyText: string): string {
    const normalized = replyBodyText.trim();
    if (normalized.length === 0) {
      throw new Error('replyBodyText is required');
    }
    if (normalized.length > 2000) {
      throw new Error('replyBodyText exceeds maximum length');
    }
    return normalized;
  }

  private normalizeLimit(limit: number | undefined, fallback: number, max: number, fieldName: string): number {
    if (limit === undefined) {
      return fallback;
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`${fieldName} must be a positive integer`);
    }

    return Math.min(limit, max);
  }

  async createStory(input: CreateStoryInput): Promise<StoryView | null> {
    const canPublish = await this.repository.canPublishStoryFromMedia({
      actorUserId: input.actorUserId,
      mediaAssetId: input.mediaAssetId,
    });

    if (!canPublish) {
      return null;
    }

    const now = nowEpochSeconds();

    return this.repository.createStory({
      actorUserId: input.actorUserId,
      mediaAssetId: input.mediaAssetId,
      visibility: this.normalizeVisibility(input.visibility),
      expiresAtEpochSeconds: now + STORY_LIFETIME_SECONDS,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async listActiveStoriesByAuthor(input: {
    authorUserId: string;
    nowEpochSeconds?: number;
    limit?: number;
  }): Promise<StoryView[]> {
    const now = input.nowEpochSeconds ?? nowEpochSeconds();
    const limit = this.normalizeLimit(input.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, 'limit');

    return this.repository.listActiveStoriesByAuthor({
      authorUserId: input.authorUserId,
      nowEpochSeconds: now,
      limit,
    });
  }

  private async canViewerAccessStory(input: {
    viewerUserId: string;
    story: StoryView;
  }): Promise<boolean> {
    if (input.viewerUserId === input.story.authorUserId) {
      return true;
    }

    if (input.story.visibility === 'close_friends') {
      return false;
    }

    const relationship = await this.repository.getRelationshipState({
      viewerUserId: input.viewerUserId,
      authorUserId: input.story.authorUserId,
    });

    if (relationship.isBlocked) {
      return false;
    }

    if (input.story.visibility === 'public') {
      return true;
    }

    if (input.story.visibility === 'followers' && relationship.isFollowing) {
      return true;
    }

    return false;
  }

  async viewStory(input: ViewStoryInput): Promise<StoryView | null> {
    const now = nowEpochSeconds();
    const story = await this.repository.getActiveStoryById({
      storyId: input.storyId,
      nowEpochSeconds: now,
    });

    if (!story) {
      return null;
    }

    const canAccess = await this.canViewerAccessStory({
      viewerUserId: input.viewerUserId,
      story,
    });

    if (!canAccess) {
      return null;
    }

    await this.storyViews.recordStoryView({
      storyId: story.storyId,
      ownerUserId: story.authorUserId,
      viewerUserId: input.viewerUserId,
    });

    return story;
  }

  async listStoryViewers(input: ListStoryViewersInput): Promise<StoryViewerSummary | null> {
    const now = nowEpochSeconds();
    const story = await this.repository.getActiveStoryById({
      storyId: input.storyId,
      nowEpochSeconds: now,
    });

    if (!story) {
      return null;
    }

    if (story.authorUserId !== input.actorUserId) {
      return null;
    }

    const limit = this.normalizeLimit(input.limit, DEFAULT_VIEWER_LIMIT, MAX_VIEWER_LIMIT, 'limit');
    const viewers = await this.storyViews.listStoryViewers({
      storyId: input.storyId,
      ownerUserId: input.actorUserId,
      limit,
    });
    const viewCount = await this.storyViews.getStoryViewCount({
      storyId: input.storyId,
      ownerUserId: input.actorUserId,
    });

    return {
      storyId: story.storyId,
      ownerUserId: story.authorUserId,
      viewCount,
      viewers,
    };
  }

  async expireStories(input: ExpireStoriesInput): Promise<ExpireStoriesResult> {
    const now = input.nowEpochSeconds ?? nowEpochSeconds();
    const limit = this.normalizeLimit(input.limit, DEFAULT_EXPIRE_LIMIT, MAX_EXPIRE_LIMIT, 'limit');

    const expired = await this.repository.expireStories({
      nowEpochSeconds: now,
      limit,
      eventSource: input.eventSource,
    });

    return {
      expiredCount: expired.length,
      storyIds: expired.map((story) => story.storyId),
    };
  }

  async createStoryReply(input: CreateStoryReplyInput): Promise<CreateStoryReplyResult> {
    const now = nowEpochSeconds();
    const story = await this.repository.getActiveStoryById({
      storyId: input.storyId,
      nowEpochSeconds: now,
    });

    if (!story) {
      return { delivered: false };
    }

    const canAccess = await this.canViewerAccessStory({
      viewerUserId: input.actorUserId,
      story,
    });

    if (!canAccess) {
      return { delivered: false };
    }

    const replyBodyText = this.normalizeReplyBodyText(input.replyBodyText);

    const delivered = await this.repository.enqueueStoryReplyCreatedEvent({
      storyId: input.storyId,
      replyAuthorUserId: input.actorUserId,
      replyBodyText,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
      nowEpochSeconds: now,
    });

    return {
      delivered,
    };
  }
}
