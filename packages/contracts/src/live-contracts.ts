export type LiveStreamStatus = 'scheduled' | 'starting' | 'live' | 'paused' | 'ended' | 'canceled';
export type LiveStreamVisibility = 'public' | 'followers' | 'subscribers';

export interface LiveStreamView {
  liveStreamId: string;
  creatorUserId: string;
  roomRef: string;
  title: string;
  visibility: LiveStreamVisibility;
  status: LiveStreamStatus;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  recordingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLiveStreamInput {
  actorUserId: string;
  title: string;
  visibility: LiveStreamVisibility;
  scheduledAt: string;
  recordingEnabled?: boolean;
}

export interface StartLiveStreamInput {
  actorUserId: string;
  liveStreamId: string;
}

export interface EndLiveStreamInput {
  actorUserId: string;
  liveStreamId: string;
}

export interface LiveStreamCredentials {
  liveStreamId: string;
  roomRef: string;
  publishToken: string;
  viewerToken: string;
  expiresAt: string;
}

export interface LiveChatMessageInput {
  actorUserId: string;
  liveStreamId: string;
  bodyText: string;
}

export interface LiveChatMessageView {
  messageId: string;
  liveStreamId: string;
  authorUserId: string;
  bodyText: string;
  status: 'published' | 'deleted' | 'moderated';
  createdAt: string;
}
