import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateQuoteInput,
  CreateRepostInput,
  CreateReplyInput,
  DeletePostInput,
  PinPostInput,
  PostInteractionInput,
  TopicFeedInput,
  PostStatus,
  PostView,
  PostVisibility,
  UpdatePostInput,
} from '../../../../../packages/contracts/src/index';
import {
  postQueries,
  type PostRelationshipStateRow,
  type PostRow,
  type QueryExecutor,
} from '../../db/queries/posts.queries';
import { QUERY_EXECUTOR } from '../../db/query-executor.token';

export interface PostsRepository {
  createPost(input: {
    authorUserId: string;
    parentPostId: string | null;
    threadRootPostId: string | null;
    repostOfPostId: string | null;
    quoteOfPostId: string | null;
    contentText: string;
    status: PostStatus;
    visibility: PostVisibility;
    publishAtEpochSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  getPostByIdForAuthor(input: {
    postId: string;
    authorUserId: string;
  }): Promise<PostView | null>;
  getPostById(postId: string): Promise<PostView | null>;
  getRelationshipState(input: {
    viewerUserId: string;
    authorUserId: string;
  }): Promise<{ is_following: boolean; is_blocked: boolean }>;
  updatePost(input: UpdatePostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  deletePost(input: DeletePostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  setPinned(input: PinPostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  likePost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  unlikePost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  bookmarkPost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  unbookmarkPost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null>;
  listFollowingFeedPage(input: {
    viewerUserId: string;
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]>;
  listPublicFeedPage(input: {
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]>;
  listTopicFeedPage(input: {
    topic: TopicFeedInput['topic'];
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]>;
}

function mapPostRow(row: PostRow): PostView {
  return {
    postId: row.id,
    authorUserId: row.author_user_id,
    parentPostId: row.parent_post_id,
    threadRootPostId: row.thread_root_post_id,
    repostOfPostId: row.repost_of_post_id,
    quoteOfPostId: row.quote_of_post_id,
    contentText: row.content_text,
    likeCount: row.like_count,
    bookmarkCount: row.bookmark_count,
    shareCount: row.share_count,
    status: row.status,
    visibility: row.visibility,
    pinnedAt: row.pinned_at,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

@Injectable()
export class PostgresPostsRepository implements PostsRepository {
  constructor(@Inject(QUERY_EXECUTOR) private readonly db: QueryExecutor) {}

  async createPost(input: {
    authorUserId: string;
    parentPostId: string | null;
    threadRootPostId: string | null;
    repostOfPostId: string | null;
    quoteOfPostId: string | null;
    contentText: string;
    status: PostStatus;
    visibility: PostVisibility;
    publishAtEpochSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.insertPostWithOutbox, [
      input.authorUserId,
      input.parentPostId,
      input.threadRootPostId,
      input.repostOfPostId,
      input.quoteOfPostId,
      input.contentText,
      input.status,
      input.visibility,
      input.publishAtEpochSeconds,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async getPostByIdForAuthor(input: {
    postId: string;
    authorUserId: string;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.selectPostByAuthorAndId, [input.postId, input.authorUserId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async getPostById(postId: string): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.selectPostById, [postId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async getRelationshipState(input: {
    viewerUserId: string;
    authorUserId: string;
  }): Promise<{ is_following: boolean; is_blocked: boolean }> {
    const result = await this.db.query<PostRelationshipStateRow>(postQueries.selectPostRelationshipState, [
      input.viewerUserId,
      input.authorUserId,
    ]);

    if (result.rows.length === 0) {
      return {
        is_following: false,
        is_blocked: false,
      };
    }

    return result.rows[0];
  }

  async updatePost(input: UpdatePostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.updatePostWithOutbox, [
      input.postId,
      input.authorUserId,
      input.contentText ?? null,
      input.visibility ?? null,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async deletePost(input: DeletePostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.deletePostWithOutbox, [
      input.postId,
      input.authorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async setPinned(input: PinPostInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.setPostPinnedWithOutbox, [
      input.postId,
      input.authorUserId,
      input.pinned,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async likePost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.likePostWithOutbox, [
      input.postId,
      input.actorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async unlikePost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.unlikePostWithOutbox, [
      input.postId,
      input.actorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async bookmarkPost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.bookmarkPostWithOutbox, [
      input.postId,
      input.actorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async unbookmarkPost(input: PostInteractionInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<PostView | null> {
    const result = await this.db.query<PostRow>(postQueries.unbookmarkPostWithOutbox, [
      input.postId,
      input.actorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapPostRow(result.rows[0]);
  }

  async listFollowingFeedPage(input: {
    viewerUserId: string;
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]> {
    const result = await this.db.query<PostRow>(postQueries.selectFollowingFeedPage, [
      input.viewerUserId,
      input.cursorPublishedAt,
      input.cursorPostId,
      input.limitPlusOne,
    ]);

    return result.rows.map(mapPostRow);
  }

  async listPublicFeedPage(input: {
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]> {
    const result = await this.db.query<PostRow>(postQueries.selectPublicFeedPage, [
      input.cursorPublishedAt,
      input.cursorPostId,
      input.limitPlusOne,
    ]);

    return result.rows.map(mapPostRow);
  }

  async listTopicFeedPage(input: {
    topic: TopicFeedInput['topic'];
    cursorPublishedAt: string | null;
    cursorPostId: string | null;
    limitPlusOne: number;
  }): Promise<PostView[]> {
    const result = await this.db.query<PostRow>(postQueries.selectTopicFeedPage, [
      input.topic,
      input.cursorPublishedAt,
      input.cursorPostId,
      input.limitPlusOne,
    ]);

    return result.rows.map(mapPostRow);
  }
}
