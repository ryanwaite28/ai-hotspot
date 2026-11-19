const assert = require('node:assert/strict');
const test = require('node:test');

const { SocialService } = require('./social.service');

test('SocialService profile update and follow flow', async () => {
  const follows = new Map();

  const repo = {
    async getProfileByHandle(handle) {
      if (handle === 'target') {
        return {
          userId: 'user-target',
          handle: 'target',
          displayName: 'Target User',
          bio: null,
          avatarUrl: null,
          links: [],
          visibility: 'public',
          followerListVisibility: 'public',
        };
      }
      return null;
    },
    async getProfileByUserId(userId) {
      if (userId === 'user-target') {
        return {
          userId: 'user-target',
          handle: 'target',
          displayName: 'Target User',
          bio: null,
          avatarUrl: null,
          links: [],
          visibility: 'public',
          followerListVisibility: 'public',
        };
      }
      return null;
    },
    async getRelationshipState(viewerUserId, targetUserId) {
      const key = `${viewerUserId}:${targetUserId}`;
      const accepted = follows.get(key) === 'accepted';
      return {
        is_following: accepted,
        is_followed_by_viewer: false,
        is_blocked: false,
        is_muted: false,
      };
    },
    async updateProfile(input) {
      return {
        userId: input.userId,
        handle: input.handle ?? 'me',
        displayName: input.displayName ?? 'Me',
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        links: input.links ?? [],
        visibility: input.visibility ?? 'public',
        followerListVisibility: input.followerListVisibility ?? 'followers',
      };
    },
    async upsertFollow(input) {
      follows.set(`${input.followerId}:${input.followingId}`, input.status);
      return {
        follower_id: input.followerId,
        following_id: input.followingId,
        status: input.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    async deleteFollow(input) {
      return follows.delete(`${input.followerId}:${input.followingId}`);
    },
    async upsertBlock() {},
    async upsertMute() {},
    async listFollowersPage() {
      return [];
    },
  };

  const service = new SocialService(repo);

  const updated = await service.updateOwnProfile({
    userId: 'user-me',
    handle: 'Me',
    displayName: 'Me Person',
    visibility: 'public',
    followerListVisibility: 'public',
  });

  assert.equal(updated?.handle, 'me');
  assert.equal(updated?.displayName, 'Me Person');

  const followed = await service.follow({
    actorUserId: 'user-me',
    targetUserId: 'user-target',
  });
  assert.equal(followed?.status, 'accepted');

  const profile = await service.getProfileByHandle({
    handle: 'target',
    viewerUserId: 'user-me',
  });
  assert.equal(profile?.isFollowing, true);

  const unfollowed = await service.unfollow({
    actorUserId: 'user-me',
    targetUserId: 'user-target',
  });
  assert.equal(unfollowed.removed, true);
});

test('SocialService follow request for protected account', async () => {
  const repo = {
    async getProfileByHandle() { return null; },
    async getProfileByUserId(userId) {
      if (userId !== 'user-target') {
        return null;
      }
      return {
        userId: 'user-target',
        handle: 'target',
        displayName: 'Target User',
        bio: null,
        avatarUrl: null,
        links: [],
        visibility: 'protected',
        followerListVisibility: 'followers',
      };
    },
    async getRelationshipState() {
      return {
        is_following: false,
        is_followed_by_viewer: false,
        is_blocked: false,
        is_muted: false,
      };
    },
    async updateProfile() { return null; },
    async upsertFollow(input) {
      return {
        follower_id: input.followerId,
        following_id: input.followingId,
        status: input.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    async deleteFollow() { return false; },
    async upsertBlock() {},
    async upsertMute() {},
    async listFollowersPage() { return []; },
  };

  const service = new SocialService(repo);
  const result = await service.follow({ actorUserId: 'user-me', targetUserId: 'user-target' });

  assert.equal(result?.status, 'pending');
});

test('SocialService follower list privacy and cursor pagination', async () => {
  const rows = [
    {
      follower_id: 'follower-3',
      handle: 'f3',
      display_name: 'F3',
      created_at: '2026-11-19T00:00:03.000Z',
    },
    {
      follower_id: 'follower-2',
      handle: 'f2',
      display_name: 'F2',
      created_at: '2026-11-19T00:00:02.000Z',
    },
    {
      follower_id: 'follower-1',
      handle: 'f1',
      display_name: 'F1',
      created_at: '2026-11-19T00:00:01.000Z',
    },
  ];

  let capturedLimit = 0;

  const repo = {
    async getProfileByHandle() { return null; },
    async getProfileByUserId() {
      return {
        userId: 'user-target',
        handle: 'target',
        displayName: 'Target User',
        bio: null,
        avatarUrl: null,
        links: [],
        visibility: 'public',
        followerListVisibility: 'followers',
      };
    },
    async getRelationshipState() {
      return {
        is_following: true,
        is_followed_by_viewer: false,
        is_blocked: false,
        is_muted: false,
      };
    },
    async updateProfile() { return null; },
    async upsertFollow() { return null; },
    async deleteFollow() { return false; },
    async upsertBlock() {},
    async upsertMute() {},
    async listFollowersPage(input) {
      capturedLimit = input.limit;
      return rows;
    },
  };

  const service = new SocialService(repo);

  const page = await service.listFollowers({
    targetUserId: 'user-target',
    viewerUserId: 'viewer-1',
    limit: 2,
  });

  assert.equal(capturedLimit, 3);
  assert.equal(page?.items.length, 2);
  assert.ok(page?.nextCursor);

  const deniedRepo = {
    ...repo,
    async getRelationshipState() {
      return {
        is_following: false,
        is_followed_by_viewer: false,
        is_blocked: false,
        is_muted: false,
      };
    },
  };

  const deniedService = new SocialService(deniedRepo);
  const denied = await deniedService.listFollowers({
    targetUserId: 'user-target',
    viewerUserId: 'viewer-2',
  });

  assert.equal(denied, null);
});
