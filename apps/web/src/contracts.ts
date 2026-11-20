export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface FeedItem {
  postId: string;
  authorUserId: string;
  contentText: string;
  publishedAt: string | null;
  visibility: 'public' | 'followers' | 'private';
}

export interface CampaignPlacementView {
  campaignId: string;
  placement: 'feed' | 'profile' | 'search';
  sponsored: true;
}

export interface LiveStreamUiView {
  liveStreamId: string;
  title: string;
  status: 'scheduled' | 'starting' | 'live' | 'paused' | 'ended' | 'canceled';
  visibility: 'public' | 'followers' | 'subscribers';
}
