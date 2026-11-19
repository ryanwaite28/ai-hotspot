import type {
  CreatePostInput,
  CreateQuoteInput,
  CreateRepostInput,
  CreateReplyInput,
  DeletePostInput,
  PinPostInput,
  PostFeedInput,
  TopicFeedInput,
  UpdatePostInput,
} from '../../../../../packages/contracts/src/index';
import type { PostsService } from '../../service/posts/posts.service';

export class PostsHandler {
  constructor(private readonly postsService: PostsService) {}

  async createDraft(actorUserId: string, body: Omit<CreatePostInput, 'authorUserId' | 'publishAtIso'>) {
    return this.postsService.createDraft({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async createOrSchedule(actorUserId: string, body: Omit<CreatePostInput, 'authorUserId'>) {
    return this.postsService.createOrSchedulePost({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async createReply(actorUserId: string, body: Omit<CreateReplyInput, 'authorUserId'>) {
    return this.postsService.createReply({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async repost(actorUserId: string, body: Omit<CreateRepostInput, 'authorUserId'>) {
    return this.postsService.createRepost({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async quote(actorUserId: string, body: Omit<CreateQuoteInput, 'authorUserId'>) {
    return this.postsService.createQuote({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async like(actorUserId: string, body: { postId: string }) {
    return this.postsService.likePost({
      actorUserId,
      postId: body.postId,
    });
  }

  async unlike(actorUserId: string, body: { postId: string }) {
    return this.postsService.unlikePost({
      actorUserId,
      postId: body.postId,
    });
  }

  async bookmark(actorUserId: string, body: { postId: string }) {
    return this.postsService.bookmarkPost({
      actorUserId,
      postId: body.postId,
    });
  }

  async unbookmark(actorUserId: string, body: { postId: string }) {
    return this.postsService.unbookmarkPost({
      actorUserId,
      postId: body.postId,
    });
  }

  async listFollowingFeed(actorUserId: string, query: Omit<PostFeedInput, 'viewerUserId'>) {
    return this.postsService.listFollowingFeed({
      viewerUserId: actorUserId,
      ...query,
    });
  }

  async listPublicFeed(query: Omit<PostFeedInput, 'viewerUserId'>) {
    return this.postsService.listPublicFeed(query);
  }

  async listTopicFeed(query: TopicFeedInput) {
    return this.postsService.listTopicFeed(query);
  }

  async update(actorUserId: string, body: Omit<UpdatePostInput, 'authorUserId'>) {
    return this.postsService.updatePost({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async remove(actorUserId: string, body: Omit<DeletePostInput, 'authorUserId'>) {
    return this.postsService.deletePost({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async pin(actorUserId: string, body: Omit<PinPostInput, 'authorUserId'>) {
    return this.postsService.pinPost({
      authorUserId: actorUserId,
      ...body,
    });
  }

  async getOwn(actorUserId: string, params: { postId: string }) {
    return this.postsService.getOwnPost({
      authorUserId: actorUserId,
      postId: params.postId,
    });
  }
}
