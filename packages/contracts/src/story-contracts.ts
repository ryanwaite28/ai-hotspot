export type StoryVisibility = 'public' | 'followers' | 'close_friends';

export interface StoryView {
  storyId: string;
  authorUserId: string;
  mediaAssetId: string;
  visibility: StoryVisibility;
  expiresAt: string;
  createdAt: string;
}

export interface CreateStoryInput {
  actorUserId: string;
  mediaAssetId: string;
  visibility?: StoryVisibility;
}

export interface StoryViewerRecord {
  viewerUserId: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
}

export interface StoryViewerSummary {
  storyId: string;
  ownerUserId: string;
  viewCount: number;
  viewers: StoryViewerRecord[];
}

export interface ViewStoryInput {
  viewerUserId: string;
  storyId: string;
}

export interface ListStoryViewersInput {
  actorUserId: string;
  storyId: string;
  limit?: number;
}

export interface CreateStoryReplyInput {
  actorUserId: string;
  storyId: string;
  replyBodyText: string;
}

export interface CreateStoryReplyResult {
  delivered: boolean;
}

export interface ExpireStoriesInput {
  nowEpochSeconds?: number;
  limit?: number;
  eventSource: 'worker' | 'api';
}

export interface ExpireStoriesResult {
  expiredCount: number;
  storyIds: string[];
}
