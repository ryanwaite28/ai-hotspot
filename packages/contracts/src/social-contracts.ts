export type ProfileVisibility = 'public' | 'protected';
export type FollowerListVisibility = 'public' | 'followers' | 'private';
export type FollowStatus = 'pending' | 'accepted';

export interface UserProfileView {
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  links: Array<{ label: string; url: string }>;
  visibility: ProfileVisibility;
  followerListVisibility: FollowerListVisibility;
  isFollowing: boolean;
  isFollowedByViewer: boolean;
  isBlocked: boolean;
  isMuted: boolean;
}

export interface UpdateProfileInput {
  userId: string;
  handle?: string;
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  links?: Array<{ label: string; url: string }>;
  visibility?: ProfileVisibility;
  followerListVisibility?: FollowerListVisibility;
}

export interface FollowAccountInput {
  actorUserId: string;
  targetUserId: string;
}

export interface RelationshipActionInput {
  actorUserId: string;
  targetUserId: string;
}

export interface FollowersPage {
  items: Array<{
    followerId: string;
    handle: string;
    displayName: string;
    followedAt: string;
  }>;
  nextCursor: string | null;
}
