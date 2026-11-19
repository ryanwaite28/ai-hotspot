import type {
  FollowersPage,
  FollowerListVisibility,
  FollowStatus,
  UserProfileView,
} from '../../../../../packages/contracts/src/index';
import type { SocialRepository } from './postgres-social.repository';

function encodeCursor(createdAt: string, followerId: string): string {
  return Buffer.from(`${createdAt}|${followerId}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: string; followerId: string } | null {
  try {
    const [createdAt, followerId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!createdAt || !followerId) {
      return null;
    }
    return { createdAt, followerId };
  } catch {
    return null;
  }
}

export class SocialService {
  constructor(private readonly repository: SocialRepository) {}

  private canViewFollowerList(input: {
    ownerId: string;
    viewerUserId?: string;
    visibility: FollowerListVisibility;
    relationship: { is_following: boolean; is_blocked: boolean };
  }): boolean {
    if (input.relationship.is_blocked) {
      return false;
    }
    if (!input.viewerUserId) {
      return input.visibility === 'public';
    }
    if (input.viewerUserId === input.ownerId) {
      return true;
    }
    if (input.visibility === 'public') {
      return true;
    }
    if (input.visibility === 'followers' && input.relationship.is_following) {
      return true;
    }
    return false;
  }

  async getProfileByHandle(input: { handle: string; viewerUserId?: string }): Promise<UserProfileView | null> {
    const profile = await this.repository.getProfileByHandle(input.handle.trim().toLowerCase());
    if (!profile) {
      return null;
    }

    if (!input.viewerUserId) {
      return {
        ...profile,
        isFollowing: false,
        isFollowedByViewer: false,
        isBlocked: false,
        isMuted: false,
      };
    }

    const relationship = await this.repository.getRelationshipState(input.viewerUserId, profile.userId);

    return {
      ...profile,
      isFollowing: relationship.is_following,
      isFollowedByViewer: relationship.is_followed_by_viewer,
      isBlocked: relationship.is_blocked,
      isMuted: relationship.is_muted,
    };
  }

  async updateOwnProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    links?: Array<{ label: string; url: string }>;
    visibility?: 'public' | 'protected';
    followerListVisibility?: 'public' | 'followers' | 'private';
  }): Promise<UserProfileView | null> {
    const updated = await this.repository.updateProfile({
      userId: input.userId,
      handle: input.handle?.trim().toLowerCase(),
      displayName: input.displayName?.trim(),
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      links: input.links,
      visibility: input.visibility,
      followerListVisibility: input.followerListVisibility,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      isFollowing: false,
      isFollowedByViewer: false,
      isBlocked: false,
      isMuted: false,
    };
  }

  async follow(input: { actorUserId: string; targetUserId: string }): Promise<{ status: FollowStatus } | null> {
    if (input.actorUserId === input.targetUserId) {
      return null;
    }

    const targetProfile = await this.repository.getProfileByUserId(input.targetUserId);
    if (!targetProfile) {
      return null;
    }

    const relationship = await this.repository.getRelationshipState(input.actorUserId, input.targetUserId);
    if (relationship.is_blocked) {
      return null;
    }

    const status: FollowStatus = targetProfile.visibility === 'protected' ? 'pending' : 'accepted';

    const follow = await this.repository.upsertFollow({
      followerId: input.actorUserId,
      followingId: input.targetUserId,
      status,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!follow) {
      return null;
    }

    return { status: follow.status };
  }

  async unfollow(input: { actorUserId: string; targetUserId: string }): Promise<{ removed: boolean }> {
    const removed = await this.repository.deleteFollow({
      followerId: input.actorUserId,
      followingId: input.targetUserId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });
    return { removed };
  }

  async approveFollowRequest(input: { actorUserId: string; requesterUserId: string }): Promise<{ status: FollowStatus } | null> {
    const updated = await this.repository.upsertFollow({
      followerId: input.requesterUserId,
      followingId: input.actorUserId,
      status: 'accepted',
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!updated) {
      return null;
    }

    return { status: updated.status };
  }

  async rejectFollowRequest(input: { actorUserId: string; requesterUserId: string }): Promise<{ removed: boolean }> {
    const removed = await this.repository.deleteFollow({
      followerId: input.requesterUserId,
      followingId: input.actorUserId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    return { removed };
  }

  async block(input: { actorUserId: string; targetUserId: string }): Promise<{ blocked: boolean }> {
    if (input.actorUserId === input.targetUserId) {
      return { blocked: false };
    }

    await this.repository.upsertBlock({
      blockerId: input.actorUserId,
      blockedId: input.targetUserId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    return { blocked: true };
  }

  async mute(input: { actorUserId: string; targetUserId: string }): Promise<{ muted: boolean }> {
    if (input.actorUserId === input.targetUserId) {
      return { muted: false };
    }

    await this.repository.upsertMute({
      muterId: input.actorUserId,
      mutedId: input.targetUserId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    return { muted: true };
  }

  async listFollowers(input: {
    targetUserId: string;
    viewerUserId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<FollowersPage | null> {
    const profile = await this.repository.getProfileByUserId(input.targetUserId);
    if (!profile) {
      return null;
    }

    const relationship = input.viewerUserId
      ? await this.repository.getRelationshipState(input.viewerUserId, input.targetUserId)
      : {
          is_following: false,
          is_followed_by_viewer: false,
          is_blocked: false,
          is_muted: false,
        };

    const canView = this.canViewFollowerList({
      ownerId: input.targetUserId,
      viewerUserId: input.viewerUserId,
      visibility: profile.followerListVisibility,
      relationship,
    });

    if (!canView) {
      return null;
    }

    const parsedCursor = input.cursor ? decodeCursor(input.cursor) : null;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

    const rows = await this.repository.listFollowersPage({
      targetUserId: input.targetUserId,
      cursorCreatedAt: parsedCursor?.createdAt ?? null,
      cursorFollowerId: parsedCursor?.followerId ?? null,
      limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.length > 0 ? items[items.length - 1] : null;

    return {
      items: items.map((row) => ({
        followerId: row.follower_id,
        handle: row.handle,
        displayName: row.display_name,
        followedAt: row.created_at,
      })),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.follower_id) : null,
    };
  }
}
