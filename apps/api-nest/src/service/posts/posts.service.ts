import type {
  CreatePostInput,
  CreateQuoteInput,
  CreateRepostInput,
  CreateReplyInput,
  DeletePostInput,
  PinPostInput,
  PostFeedInput,
  PostInteractionInput,
  PostInteractionResult,
  PostsFeedPage,
  PostStatus,
  TopicFeedInput,
  PostView,
  PostVisibility,
  UpdatePostInput,
} from '../../../../../packages/contracts/src/index';
import type { PostsRepository } from './postgres-posts.repository';

const MAX_POST_TEXT_LENGTH = 5000;
const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 100;

function encodeCursor(publishedAt: string, postId: string): string {
  return Buffer.from(`${publishedAt}|${postId}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): { publishedAt: string; postId: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const [publishedAt, postId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!publishedAt || !postId) {
      return null;
    }
    return { publishedAt, postId };
  } catch {
    return null;
  }
}

export class PostsService {
  constructor(private readonly repository: PostsRepository) {}

  private normalizeContentText(contentText: string): string {
    const value = contentText.trim();
    if (value.length === 0) {
      throw new Error('Post content is required');
    }
    if (value.length > MAX_POST_TEXT_LENGTH) {
      throw new Error('Post content exceeds maximum length');
    }
    return value;
  }

  private normalizeVisibility(visibility?: PostVisibility): PostVisibility {
    return visibility ?? 'public';
  }

  private normalizeFeedLimit(limit?: number): number {
    if (!limit) {
      return DEFAULT_FEED_LIMIT;
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('Feed limit must be a positive integer');
    }
    return Math.min(limit, MAX_FEED_LIMIT);
  }

  private buildFeedPage(rows: PostView[], limit: number): PostsFeedPage {
    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const last = items[items.length - 1] ?? null;

    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor(last.publishedAt ?? last.createdAt, last.postId)
        : null,
    };
  }

  private async canActorViewPost(actorUserId: string, post: PostView): Promise<boolean> {
    if (actorUserId === post.authorUserId) {
      return true;
    }

    const relationship = await this.repository.getRelationshipState({
      viewerUserId: actorUserId,
      authorUserId: post.authorUserId,
    });

    if (relationship.is_blocked) {
      return false;
    }

    if (post.visibility === 'public') {
      return true;
    }

    if (post.visibility === 'followers' && relationship.is_following) {
      return true;
    }

    return false;
  }

  private resolveStatusAndPublishTime(input: CreatePostInput): {
    status: PostStatus;
    publishAtEpochSeconds: number;
  } {
    const now = Math.floor(Date.now() / 1000);
    if (!input.publishAtIso) {
      return {
        status: 'published',
        publishAtEpochSeconds: now,
      };
    }

    const publishAt = Math.floor(new Date(input.publishAtIso).getTime() / 1000);
    if (!Number.isFinite(publishAt)) {
      throw new Error('Invalid publishAtIso value');
    }

    if (publishAt > now) {
      return {
        status: 'scheduled',
        publishAtEpochSeconds: publishAt,
      };
    }

    return {
      status: 'published',
      publishAtEpochSeconds: publishAt,
    };
  }

  async createDraft(input: Omit<CreatePostInput, 'publishAtIso'>): Promise<PostView | null> {
    const contentText = this.normalizeContentText(input.contentText);
    const now = Math.floor(Date.now() / 1000);

    return this.repository.createPost({
      authorUserId: input.authorUserId,
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText,
      status: 'draft',
      visibility: this.normalizeVisibility(input.visibility),
      publishAtEpochSeconds: now,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async createOrSchedulePost(input: CreatePostInput): Promise<PostView | null> {
    const contentText = this.normalizeContentText(input.contentText);
    const { status, publishAtEpochSeconds } = this.resolveStatusAndPublishTime(input);

    return this.repository.createPost({
      authorUserId: input.authorUserId,
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText,
      status,
      visibility: this.normalizeVisibility(input.visibility),
      publishAtEpochSeconds,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
  }

  async createReply(input: CreateReplyInput): Promise<PostView | null> {
    const parent = await this.repository.getPostById(input.parentPostId);
    if (!parent || parent.status === 'deleted') {
      return null;
    }

    const canViewParent = await this.canActorViewPost(input.authorUserId, parent);
    if (!canViewParent) {
      return null;
    }

    const contentText = this.normalizeContentText(input.contentText);
    const now = Math.floor(Date.now() / 1000);

    return this.repository.createPost({
      authorUserId: input.authorUserId,
      parentPostId: parent.postId,
      threadRootPostId: parent.threadRootPostId ?? parent.postId,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText,
      status: 'published',
      visibility: this.normalizeVisibility(input.visibility),
      publishAtEpochSeconds: now,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async createRepost(input: CreateRepostInput): Promise<PostView | null> {
    const source = await this.repository.getPostById(input.repostOfPostId);
    if (!source || source.status !== 'published' || source.deletedAt !== null) {
      return null;
    }

    const canViewSource = await this.canActorViewPost(input.authorUserId, source);
    if (!canViewSource) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    return this.repository.createPost({
      authorUserId: input.authorUserId,
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: source.postId,
      quoteOfPostId: null,
      contentText: '',
      status: 'published',
      visibility: this.normalizeVisibility(input.visibility),
      publishAtEpochSeconds: now,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async createQuote(input: CreateQuoteInput): Promise<PostView | null> {
    const source = await this.repository.getPostById(input.quoteOfPostId);
    if (!source || source.status !== 'published' || source.deletedAt !== null) {
      return null;
    }

    const canViewSource = await this.canActorViewPost(input.authorUserId, source);
    if (!canViewSource) {
      return null;
    }

    const contentText = this.normalizeContentText(input.contentText);
    const now = Math.floor(Date.now() / 1000);

    return this.repository.createPost({
      authorUserId: input.authorUserId,
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: source.postId,
      contentText,
      status: 'published',
      visibility: this.normalizeVisibility(input.visibility),
      publishAtEpochSeconds: now,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async updatePost(input: UpdatePostInput): Promise<PostView | null> {
    const contentText = input.contentText !== undefined
      ? this.normalizeContentText(input.contentText)
      : undefined;

    return this.repository.updatePost({
      ...input,
      contentText,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
  }

  async deletePost(input: DeletePostInput): Promise<{ deleted: boolean }> {
    const deleted = await this.repository.deletePost({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    return { deleted: deleted !== null };
  }

  async pinPost(input: PinPostInput): Promise<PostView | null> {
    return this.repository.setPinned({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
  }

  async getOwnPost(input: { authorUserId: string; postId: string }): Promise<PostView | null> {
    return this.repository.getPostByIdForAuthor(input);
  }

  async likePost(input: PostInteractionInput): Promise<PostInteractionResult> {
    const target = await this.repository.getPostById(input.postId);
    if (!target) {
      return { updated: false, post: null };
    }

    const canViewTarget = await this.canActorViewPost(input.actorUserId, target);
    if (!canViewTarget) {
      return { updated: false, post: null };
    }

    const post = await this.repository.likePost({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
    return {
      updated: post !== null,
      post,
    };
  }

  async unlikePost(input: PostInteractionInput): Promise<PostInteractionResult> {
    const target = await this.repository.getPostById(input.postId);
    if (!target) {
      return { updated: false, post: null };
    }

    const canViewTarget = await this.canActorViewPost(input.actorUserId, target);
    if (!canViewTarget) {
      return { updated: false, post: null };
    }

    const post = await this.repository.unlikePost({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
    return {
      updated: post !== null,
      post,
    };
  }

  async bookmarkPost(input: PostInteractionInput): Promise<PostInteractionResult> {
    const target = await this.repository.getPostById(input.postId);
    if (!target) {
      return { updated: false, post: null };
    }

    const canViewTarget = await this.canActorViewPost(input.actorUserId, target);
    if (!canViewTarget) {
      return { updated: false, post: null };
    }

    const post = await this.repository.bookmarkPost({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
    return {
      updated: post !== null,
      post,
    };
  }

  async unbookmarkPost(input: PostInteractionInput): Promise<PostInteractionResult> {
    const target = await this.repository.getPostById(input.postId);
    if (!target) {
      return { updated: false, post: null };
    }

    const canViewTarget = await this.canActorViewPost(input.actorUserId, target);
    if (!canViewTarget) {
      return { updated: false, post: null };
    }

    const post = await this.repository.unbookmarkPost({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
    return {
      updated: post !== null,
      post,
    };
  }

  async listFollowingFeed(input: PostFeedInput): Promise<PostsFeedPage> {
    const limit = this.normalizeFeedLimit(input.limit);
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor) {
      throw new Error('Invalid feed cursor');
    }

    const rows = await this.repository.listFollowingFeedPage({
      viewerUserId: input.viewerUserId,
      cursorPublishedAt: cursor?.publishedAt ?? null,
      cursorPostId: cursor?.postId ?? null,
      limitPlusOne: limit + 1,
    });

    return this.buildFeedPage(rows, limit);
  }

  async listPublicFeed(input: Omit<PostFeedInput, 'viewerUserId'>): Promise<PostsFeedPage> {
    const limit = this.normalizeFeedLimit(input.limit);
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor) {
      throw new Error('Invalid feed cursor');
    }

    const rows = await this.repository.listPublicFeedPage({
      cursorPublishedAt: cursor?.publishedAt ?? null,
      cursorPostId: cursor?.postId ?? null,
      limitPlusOne: limit + 1,
    });

    return this.buildFeedPage(rows, limit);
  }

  async listTopicFeed(input: TopicFeedInput): Promise<PostsFeedPage> {
    const topic = input.topic.trim().replace(/^#/, '').toLowerCase();
    if (!topic) {
      throw new Error('Topic is required');
    }

    const limit = this.normalizeFeedLimit(input.limit);
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor) {
      throw new Error('Invalid feed cursor');
    }

    const rows = await this.repository.listTopicFeedPage({
      topic,
      cursorPublishedAt: cursor?.publishedAt ?? null,
      cursorPostId: cursor?.postId ?? null,
      limitPlusOne: limit + 1,
    });

    return this.buildFeedPage(rows, limit);
  }
}
