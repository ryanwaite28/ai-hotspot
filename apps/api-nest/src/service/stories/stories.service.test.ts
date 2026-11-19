import assert from 'node:assert/strict';
import test from 'node:test';

import { StoriesService } from './stories.service';

function createStoriesServiceHarness() {
  const stories = new Map<string, {
    storyId: string;
    authorUserId: string;
    mediaAssetId: string;
    visibility: 'public' | 'followers' | 'close_friends';
    expiresAtEpochSeconds: number;
    createdAt: string;
  }>();

  const readyMedia = new Set<string>();

  const relationships = new Map<string, {
    isFollowing: boolean;
    isBlocked: boolean;
  }>();

  const viewerRecords = new Map<string, {
    storyId: string;
    ownerUserId: string;
    viewerUserId: string;
    firstViewedAt: string;
    lastViewedAt: string;
    viewCount: number;
  }>();

  const storyReplyEvents: Array<{
    storyId: string;
    replyAuthorUserId: string;
    replyBodyText: string;
    eventId: string;
    occurredAtEpochSeconds: number;
    nowEpochSeconds: number;
  }> = [];

  const repository = {
    async canPublishStoryFromMedia(input: {
      actorUserId: string;
      mediaAssetId: string;
    }) {
      const key = `${input.actorUserId}:${input.mediaAssetId}`;
      return readyMedia.has(key);
    },
    async createStory(input: {
      actorUserId: string;
      mediaAssetId: string;
      visibility: 'public' | 'followers' | 'close_friends';
      expiresAtEpochSeconds: number;
      eventId: string;
      occurredAtEpochSeconds: number;
    }) {
      const storyId = `story-${stories.size + 1}`;
      const createdAt = new Date(input.occurredAtEpochSeconds * 1000).toISOString();

      stories.set(storyId, {
        storyId,
        authorUserId: input.actorUserId,
        mediaAssetId: input.mediaAssetId,
        visibility: input.visibility,
        expiresAtEpochSeconds: input.expiresAtEpochSeconds,
        createdAt,
      });

      return {
        storyId,
        authorUserId: input.actorUserId,
        mediaAssetId: input.mediaAssetId,
        visibility: input.visibility,
        expiresAt: new Date(input.expiresAtEpochSeconds * 1000).toISOString(),
        createdAt,
      };
    },
    async listActiveStoriesByAuthor(input: {
      authorUserId: string;
      nowEpochSeconds: number;
      limit: number;
    }) {
      const filtered = Array.from(stories.values())
        .filter((story) => story.authorUserId === input.authorUserId && story.expiresAtEpochSeconds > input.nowEpochSeconds)
        .slice(0, input.limit)
        .map((story) => ({
          storyId: story.storyId,
          authorUserId: story.authorUserId,
          mediaAssetId: story.mediaAssetId,
          visibility: story.visibility,
          expiresAt: new Date(story.expiresAtEpochSeconds * 1000).toISOString(),
          createdAt: story.createdAt,
        }));

      return filtered;
    },
    async getActiveStoryById(input: {
      storyId: string;
      nowEpochSeconds: number;
    }) {
      const story = stories.get(input.storyId);
      if (!story) {
        return null;
      }

      if (story.expiresAtEpochSeconds <= input.nowEpochSeconds) {
        return null;
      }

      return {
        storyId: story.storyId,
        authorUserId: story.authorUserId,
        mediaAssetId: story.mediaAssetId,
        visibility: story.visibility,
        expiresAt: new Date(story.expiresAtEpochSeconds * 1000).toISOString(),
        createdAt: story.createdAt,
      };
    },
    async getRelationshipState(input: {
      viewerUserId: string;
      authorUserId: string;
    }) {
      const key = `${input.viewerUserId}:${input.authorUserId}`;
      const relationship = relationships.get(key);

      if (!relationship) {
        return {
          isFollowing: false,
          isBlocked: false,
        };
      }

      return relationship;
    },
    async expireStories(input: {
      nowEpochSeconds: number;
      limit: number;
      eventSource: 'worker' | 'api';
    }) {
      const expirable = Array.from(stories.values())
        .filter((story) => story.expiresAtEpochSeconds <= input.nowEpochSeconds)
        .slice(0, input.limit);

      for (const story of expirable) {
        stories.delete(story.storyId);
      }

      return expirable.map((story) => ({
        storyId: story.storyId,
        authorUserId: story.authorUserId,
        mediaAssetId: story.mediaAssetId,
        visibility: story.visibility,
        expiresAt: new Date(story.expiresAtEpochSeconds * 1000).toISOString(),
        createdAt: story.createdAt,
      }));
    },
    async enqueueStoryReplyCreatedEvent(input: {
      storyId: string;
      replyAuthorUserId: string;
      replyBodyText: string;
      eventId: string;
      occurredAtEpochSeconds: number;
      nowEpochSeconds: number;
    }) {
      const story = stories.get(input.storyId);
      if (!story || story.expiresAtEpochSeconds <= input.nowEpochSeconds) {
        return false;
      }

      storyReplyEvents.push(input);
      return true;
    },
  };

  const storyViews = {
    async recordStoryView(input: {
      storyId: string;
      ownerUserId: string;
      viewerUserId: string;
    }) {
      const key = `${input.storyId}:${input.ownerUserId}:${input.viewerUserId}`;
      const nowIso = new Date().toISOString();
      const existing = viewerRecords.get(key);

      if (!existing) {
        viewerRecords.set(key, {
          storyId: input.storyId,
          ownerUserId: input.ownerUserId,
          viewerUserId: input.viewerUserId,
          firstViewedAt: nowIso,
          lastViewedAt: nowIso,
          viewCount: 1,
        });
        return;
      }

      viewerRecords.set(key, {
        ...existing,
        lastViewedAt: nowIso,
        viewCount: existing.viewCount + 1,
      });
    },
    async listStoryViewers(input: {
      storyId: string;
      ownerUserId: string;
      limit: number;
    }) {
      return Array.from(viewerRecords.values())
        .filter((record) => record.storyId === input.storyId && record.ownerUserId === input.ownerUserId)
        .slice(0, input.limit)
        .map((record) => ({
          viewerUserId: record.viewerUserId,
          firstViewedAt: record.firstViewedAt,
          lastViewedAt: record.lastViewedAt,
          viewCount: record.viewCount,
        }));
    },
    async getStoryViewCount(input: {
      storyId: string;
      ownerUserId: string;
    }) {
      return Array.from(viewerRecords.values())
        .filter((record) => record.storyId === input.storyId && record.ownerUserId === input.ownerUserId)
        .reduce((sum, record) => sum + record.viewCount, 0);
    },
  };

  const service = new StoriesService(repository, storyViews);

  return {
    service,
    readyMedia,
    relationships,
    storyReplyEvents,
  };
}

test('StoriesService creates a story with 24-hour expiry for ready media assets', async () => {
  const harness = createStoriesServiceHarness();
  const nowBefore = Math.floor(Date.now() / 1000);

  harness.readyMedia.add('user-1:media-ready-1');

  const created = await harness.service.createStory({
    actorUserId: 'user-1',
    mediaAssetId: 'media-ready-1',
    visibility: 'followers',
  });

  assert.ok(created);
  assert.equal(created?.visibility, 'followers');

  const expiresAtEpoch = Math.floor(new Date(String(created?.expiresAt)).getTime() / 1000);
  const lifetimeSeconds = expiresAtEpoch - nowBefore;

  assert.ok(lifetimeSeconds >= 24 * 60 * 60 - 2);
  assert.ok(lifetimeSeconds <= 24 * 60 * 60 + 2);
});

test('StoriesService blocks story publish when media is not ready or not owned by actor', async () => {
  const harness = createStoriesServiceHarness();

  const created = await harness.service.createStory({
    actorUserId: 'user-2',
    mediaAssetId: 'media-not-ready',
    visibility: 'public',
  });

  assert.equal(created, null);
});

test('StoriesService expires stories and reports deleted IDs', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('user-3:media-ready-expire');

  const created = await harness.service.createStory({
    actorUserId: 'user-3',
    mediaAssetId: 'media-ready-expire',
    visibility: 'close_friends',
  });

  assert.ok(created);

  const activeBefore = await harness.service.listActiveStoriesByAuthor({
    authorUserId: 'user-3',
    nowEpochSeconds: Math.floor(Date.now() / 1000),
  });
  assert.equal(activeBefore.length, 1);

  const after24h = Math.floor(new Date(String(created?.expiresAt)).getTime() / 1000) + 1;

  const expired = await harness.service.expireStories({
    nowEpochSeconds: after24h,
    limit: 50,
    eventSource: 'worker',
  });

  assert.equal(expired.expiredCount, 1);
  assert.equal(expired.storyIds[0], created?.storyId);

  const activeAfter = await harness.service.listActiveStoriesByAuthor({
    authorUserId: 'user-3',
    nowEpochSeconds: after24h,
  });
  assert.equal(activeAfter.length, 0);
});

test('StoriesService enforces story visibility and records viewer entries', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-1:media-public-1');
  harness.readyMedia.add('owner-1:media-followers-1');
  harness.readyMedia.add('owner-1:media-close-1');

  const publicStory = await harness.service.createStory({
    actorUserId: 'owner-1',
    mediaAssetId: 'media-public-1',
    visibility: 'public',
  });
  assert.ok(publicStory);

  const followersStory = await harness.service.createStory({
    actorUserId: 'owner-1',
    mediaAssetId: 'media-followers-1',
    visibility: 'followers',
  });
  assert.ok(followersStory);

  const closeFriendsStory = await harness.service.createStory({
    actorUserId: 'owner-1',
    mediaAssetId: 'media-close-1',
    visibility: 'close_friends',
  });
  assert.ok(closeFriendsStory);

  const blockedOnFollowers = await harness.service.viewStory({
    viewerUserId: 'viewer-a',
    storyId: followersStory!.storyId,
  });
  assert.equal(blockedOnFollowers, null);

  harness.relationships.set('viewer-a:owner-1', {
    isFollowing: true,
    isBlocked: false,
  });

  const allowedOnFollowers = await harness.service.viewStory({
    viewerUserId: 'viewer-a',
    storyId: followersStory!.storyId,
  });
  assert.ok(allowedOnFollowers);

  const publicVisible = await harness.service.viewStory({
    viewerUserId: 'viewer-b',
    storyId: publicStory!.storyId,
  });
  assert.ok(publicVisible);

  const closeFriendsDenied = await harness.service.viewStory({
    viewerUserId: 'viewer-b',
    storyId: closeFriendsStory!.storyId,
  });
  assert.equal(closeFriendsDenied, null);
});

test('StoriesService exposes viewer summary only to story owner', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-2:media-own-1');

  const story = await harness.service.createStory({
    actorUserId: 'owner-2',
    mediaAssetId: 'media-own-1',
    visibility: 'public',
  });
  assert.ok(story);

  await harness.service.viewStory({
    viewerUserId: 'viewer-x',
    storyId: story!.storyId,
  });

  await harness.service.viewStory({
    viewerUserId: 'viewer-y',
    storyId: story!.storyId,
  });

  await harness.service.viewStory({
    viewerUserId: 'viewer-y',
    storyId: story!.storyId,
  });

  const denied = await harness.service.listStoryViewers({
    actorUserId: 'viewer-x',
    storyId: story!.storyId,
    limit: 20,
  });
  assert.equal(denied, null);

  const summary = await harness.service.listStoryViewers({
    actorUserId: 'owner-2',
    storyId: story!.storyId,
    limit: 20,
  });

  assert.ok(summary);
  assert.equal(summary?.viewCount, 3);
  assert.equal(summary?.viewers.length, 2);
  assert.equal(summary?.viewers.find((viewer) => viewer.viewerUserId === 'viewer-y')?.viewCount, 2);
});

test('StoriesService creates story reply delivery events for authorized viewers', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-3:media-public-reply');

  const story = await harness.service.createStory({
    actorUserId: 'owner-3',
    mediaAssetId: 'media-public-reply',
    visibility: 'public',
  });
  assert.ok(story);

  const delivered = await harness.service.createStoryReply({
    actorUserId: 'viewer-z',
    storyId: story!.storyId,
    replyBodyText: ' Great story ',
  });

  assert.equal(delivered.delivered, true);
  assert.equal(harness.storyReplyEvents.length, 1);
  assert.equal(harness.storyReplyEvents[0].replyBodyText, 'Great story');
});

test('StoriesService rejects story reply delivery for unauthorized viewers', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-4:media-followers-reply');

  const story = await harness.service.createStory({
    actorUserId: 'owner-4',
    mediaAssetId: 'media-followers-reply',
    visibility: 'followers',
  });
  assert.ok(story);

  const denied = await harness.service.createStoryReply({
    actorUserId: 'viewer-no-follow',
    storyId: story!.storyId,
    replyBodyText: 'reply',
  });

  assert.equal(denied.delivered, false);
  assert.equal(harness.storyReplyEvents.length, 0);
});

test('StoriesService treats stories as expired at the exact expiry second', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-5:media-exact-expiry');

  const story = await harness.service.createStory({
    actorUserId: 'owner-5',
    mediaAssetId: 'media-exact-expiry',
    visibility: 'public',
  });
  assert.ok(story);

  const expiryEpoch = Math.floor(new Date(String(story?.expiresAt)).getTime() / 1000);

  const activeBeforeExpiry = await harness.service.listActiveStoriesByAuthor({
    authorUserId: 'owner-5',
    nowEpochSeconds: expiryEpoch - 1,
  });
  assert.equal(activeBeforeExpiry.length, 1);

  const activeAtExpiry = await harness.service.listActiveStoriesByAuthor({
    authorUserId: 'owner-5',
    nowEpochSeconds: expiryEpoch,
  });
  assert.equal(activeAtExpiry.length, 0);

  const originalDateNow = Date.now;
  Date.now = () => expiryEpoch * 1000;

  try {
    const deniedView = await harness.service.viewStory({
      viewerUserId: 'viewer-expiry',
      storyId: story!.storyId,
    });
    assert.equal(deniedView, null);

    const deniedReply = await harness.service.createStoryReply({
      actorUserId: 'viewer-expiry',
      storyId: story!.storyId,
      replyBodyText: 'still there?',
    });
    assert.equal(deniedReply.delivered, false);
  } finally {
    Date.now = originalDateNow;
  }
});

test('StoriesService hides public stories for blocked relationships and rejects replies', async () => {
  const harness = createStoriesServiceHarness();

  harness.readyMedia.add('owner-6:media-public-blocked');

  const story = await harness.service.createStory({
    actorUserId: 'owner-6',
    mediaAssetId: 'media-public-blocked',
    visibility: 'public',
  });
  assert.ok(story);

  harness.relationships.set('viewer-blocked:owner-6', {
    isFollowing: true,
    isBlocked: true,
  });

  const hidden = await harness.service.viewStory({
    viewerUserId: 'viewer-blocked',
    storyId: story!.storyId,
  });
  assert.equal(hidden, null);

  const reply = await harness.service.createStoryReply({
    actorUserId: 'viewer-blocked',
    storyId: story!.storyId,
    replyBodyText: 'blocked path',
  });
  assert.equal(reply.delivered, false);
  assert.equal(harness.storyReplyEvents.length, 0);
});
