import type { SocialService } from '../../service/social/social.service';

export class SocialHandler {
  constructor(private readonly socialService: SocialService) {}

  async getProfileByHandle(params: { handle: string }, actorUserId?: string) {
    return this.socialService.getProfileByHandle({
      handle: params.handle,
      viewerUserId: actorUserId,
    });
  }

  async updateOwnProfile(actorUserId: string, body: {
    handle?: string;
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    links?: Array<{ label: string; url: string }>;
    visibility?: 'public' | 'protected';
    followerListVisibility?: 'public' | 'followers' | 'private';
  }) {
    return this.socialService.updateOwnProfile({
      userId: actorUserId,
      ...body,
    });
  }

  async follow(actorUserId: string, params: { targetUserId: string }) {
    return this.socialService.follow({
      actorUserId,
      targetUserId: params.targetUserId,
    });
  }

  async unfollow(actorUserId: string, params: { targetUserId: string }) {
    return this.socialService.unfollow({
      actorUserId,
      targetUserId: params.targetUserId,
    });
  }

  async approveFollow(actorUserId: string, params: { requesterUserId: string }) {
    return this.socialService.approveFollowRequest({
      actorUserId,
      requesterUserId: params.requesterUserId,
    });
  }

  async rejectFollow(actorUserId: string, params: { requesterUserId: string }) {
    return this.socialService.rejectFollowRequest({
      actorUserId,
      requesterUserId: params.requesterUserId,
    });
  }

  async block(actorUserId: string, params: { targetUserId: string }) {
    return this.socialService.block({
      actorUserId,
      targetUserId: params.targetUserId,
    });
  }

  async mute(actorUserId: string, params: { targetUserId: string }) {
    return this.socialService.mute({
      actorUserId,
      targetUserId: params.targetUserId,
    });
  }

  async listFollowers(
    params: { targetUserId: string },
    query: { cursor?: string; limit?: number },
    actorUserId?: string,
  ) {
    return this.socialService.listFollowers({
      targetUserId: params.targetUserId,
      viewerUserId: actorUserId,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
