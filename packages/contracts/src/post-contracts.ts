export type PostStatus = 'draft' | 'scheduled' | 'published' | 'deleted';

export type PostVisibility = 'public' | 'followers' | 'private';

export interface PostView {
  postId: string;
  authorUserId: string;
  parentPostId: string | null;
  threadRootPostId: string | null;
  repostOfPostId: string | null;
  quoteOfPostId: string | null;
  contentText: string;
  likeCount: number;
  bookmarkCount: number;
  shareCount: number;
  status: PostStatus;
  visibility: PostVisibility;
  pinnedAt: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreatePostInput {
  authorUserId: string;
  contentText: string;
  visibility?: PostVisibility;
  publishAtIso?: string;
}

export interface CreateReplyInput {
  authorUserId: string;
  parentPostId: string;
  contentText: string;
  visibility?: PostVisibility;
}

export interface CreateRepostInput {
  authorUserId: string;
  repostOfPostId: string;
  visibility?: PostVisibility;
}

export interface CreateQuoteInput {
  authorUserId: string;
  quoteOfPostId: string;
  contentText: string;
  visibility?: PostVisibility;
}

export interface UpdatePostInput {
  authorUserId: string;
  postId: string;
  contentText?: string;
  visibility?: PostVisibility;
}

export interface DeletePostInput {
  authorUserId: string;
  postId: string;
}

export interface PinPostInput {
  authorUserId: string;
  postId: string;
  pinned: boolean;
}

export interface PostInteractionInput {
  actorUserId: string;
  postId: string;
}

export interface PostInteractionResult {
  updated: boolean;
  post: PostView | null;
}

export interface PostFeedInput {
  viewerUserId: string;
  cursor?: string;
  limit?: number;
}

export interface TopicFeedInput {
  topic: string;
  cursor?: string;
  limit?: number;
}

export interface PostsFeedPage {
  items: PostView[];
  nextCursor: string | null;
}
