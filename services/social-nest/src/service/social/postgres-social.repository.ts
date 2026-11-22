import {
  socialQueries,
  type FollowRow,
  type FollowerEdgeRow,
  type ProfileRow,
  type QueryExecutor,
  type RelationshipStateRow,
} from '../../db/queries/social.queries';
import type { JsonObject, JsonValue } from '../../db/queries/query.types';
import type {
  FollowerListVisibility,
  FollowStatus,
  ProfileVisibility,
  UserProfileView,
} from '../../../../../packages/contracts/src/index';

export interface SocialRepository {
  getProfileByHandle(handle: string): Promise<Omit<UserProfileView, 'isFollowing' | 'isFollowedByViewer' | 'isBlocked' | 'isMuted'> | null>;
  getProfileByUserId(userId: string): Promise<Omit<UserProfileView, 'isFollowing' | 'isFollowedByViewer' | 'isBlocked' | 'isMuted'> | null>;
  getRelationshipState(viewerUserId: string, targetUserId: string): Promise<RelationshipStateRow>;
  updateProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    links?: Array<{ label: string; url: string }>;
    visibility?: ProfileVisibility;
    followerListVisibility?: FollowerListVisibility;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<Omit<UserProfileView, 'isFollowing' | 'isFollowedByViewer' | 'isBlocked' | 'isMuted'> | null>;
  upsertFollow(input: {
    followerId: string;
    followingId: string;
    status: FollowStatus;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<FollowRow | null>;
  deleteFollow(input: {
    followerId: string;
    followingId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<boolean>;
  upsertBlock(input: {
    blockerId: string;
    blockedId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<void>;
  upsertMute(input: {
    muterId: string;
    mutedId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<void>;
  listFollowersPage(input: {
    targetUserId: string;
    cursorCreatedAt: string | null;
    cursorFollowerId: string | null;
    limit: number;
  }): Promise<FollowerEdgeRow[]>;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function normalizeLinks(raw: JsonValue): Array<{ label: string; url: string }> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((entry) => isJsonObject(entry))
    .map((entry) => {
      const labelValue = entry.label;
      const urlValue = entry.url;
      const label = typeof labelValue === 'string' ? labelValue.trim() : '';
      const url = typeof urlValue === 'string' ? urlValue.trim() : '';
      return { label, url };
    })
    .filter((entry) => entry.label.length > 0 && entry.url.length > 0);
}

function mapProfileRow(row: ProfileRow): Omit<UserProfileView, 'isFollowing' | 'isFollowedByViewer' | 'isBlocked' | 'isMuted'> {
  return {
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    links: normalizeLinks(row.links),
    visibility: (row.visibility ?? 'public') as ProfileVisibility,
    followerListVisibility: (row.follower_list_visibility ?? 'followers') as FollowerListVisibility,
  };
}

export class PostgresSocialRepository implements SocialRepository {
  constructor(private readonly db: QueryExecutor) {}

  async getProfileByHandle(handle: string) {
    const result = await this.db.query<ProfileRow>(socialQueries.selectProfileByHandle, [handle]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapProfileRow(result.rows[0]);
  }

  async getProfileByUserId(userId: string) {
    const result = await this.db.query<ProfileRow>(socialQueries.selectProfileByUserId, [userId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapProfileRow(result.rows[0]);
  }

  async getRelationshipState(viewerUserId: string, targetUserId: string): Promise<RelationshipStateRow> {
    const result = await this.db.query<RelationshipStateRow>(socialQueries.selectRelationshipState, [viewerUserId, targetUserId]);
    if (result.rows.length === 0) {
      return {
        is_following: false,
        is_followed_by_viewer: false,
        is_blocked: false,
        is_muted: false,
      };
    }
    return result.rows[0];
  }

  async updateProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    links?: Array<{ label: string; url: string }>;
    visibility?: ProfileVisibility;
    followerListVisibility?: FollowerListVisibility;
    eventId: string;
    occurredAtEpochSeconds: number;
  }) {
    const result = await this.db.query<ProfileRow>(socialQueries.upsertProfileWithOutbox, [
      input.userId,
      input.handle ?? null,
      input.displayName ?? null,
      input.bio ?? null,
      input.avatarUrl ?? null,
      input.links ? JSON.stringify(input.links) : null,
      input.visibility ?? null,
      input.followerListVisibility ?? null,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }
    return mapProfileRow(result.rows[0]);
  }

  async upsertFollow(input: {
    followerId: string;
    followingId: string;
    status: FollowStatus;
    eventId: string;
    occurredAtEpochSeconds: number;
  }) {
    const result = await this.db.query<FollowRow>(socialQueries.upsertFollowWithOutbox, [
      input.followerId,
      input.followingId,
      input.status,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  }

  async deleteFollow(input: {
    followerId: string;
    followingId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }) {
    const result = await this.db.query<{ follower_id: string; following_id: string }>(socialQueries.deleteFollowWithOutbox, [
      input.followerId,
      input.followingId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
    return result.rows.length > 0;
  }

  async upsertBlock(input: {
    blockerId: string;
    blockedId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }) {
    await this.db.query(socialQueries.upsertBlockWithOutbox, [
      input.blockerId,
      input.blockedId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
  }

  async upsertMute(input: {
    muterId: string;
    mutedId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }) {
    await this.db.query(socialQueries.upsertMuteWithOutbox, [
      input.muterId,
      input.mutedId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
  }

  async listFollowersPage(input: {
    targetUserId: string;
    cursorCreatedAt: string | null;
    cursorFollowerId: string | null;
    limit: number;
  }) {
    const result = await this.db.query<FollowerEdgeRow>(socialQueries.selectFollowersPage, [
      input.targetUserId,
      input.cursorCreatedAt,
      input.cursorFollowerId,
      input.limit,
    ]);
    return result.rows;
  }
}
