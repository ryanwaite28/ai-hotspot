import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  LiveStreamView,
  LiveChatMessageView,
  LiveStreamCredentials,
  CreateLiveStreamInput,
  StartLiveStreamInput,
  EndLiveStreamInput,
  LiveChatMessageInput,
} from '../../../../../packages/contracts/src';
import { LiveService } from './live.service';

function createHarness(entitlementAllowed: boolean) {
  const streams = new Map<string, LiveStreamView>();

  const repository = {
    async createLiveStream(input: CreateLiveStreamInput & {
      liveStreamId: string;
      roomRef: string;
      scheduledAtEpochSeconds: number;
    }) {
      const now = new Date().toISOString();
      const stream: LiveStreamView = {
        liveStreamId: input.liveStreamId,
        creatorUserId: input.actorUserId,
        roomRef: input.roomRef,
        title: input.title,
        visibility: input.visibility,
        status: 'scheduled',
        scheduledAt: new Date(input.scheduledAtEpochSeconds * 1000).toISOString(),
        startedAt: null,
        endedAt: null,
        recordingEnabled: input.recordingEnabled ?? false,
        createdAt: now,
        updatedAt: now,
      };
      streams.set(stream.liveStreamId, stream);
      return stream;
    },
    async getLiveStream(liveStreamId: string) {
      return streams.get(liveStreamId) ?? null;
    },
    async startLiveStream(input: StartLiveStreamInput & { startedAtEpochSeconds: number }) {
      const existing = streams.get(input.liveStreamId);
      if (!existing) {
        return null;
      }
      const started: LiveStreamView = {
        ...existing,
        status: 'live',
        startedAt: new Date(input.startedAtEpochSeconds * 1000).toISOString(),
        updatedAt: new Date(input.startedAtEpochSeconds * 1000).toISOString(),
      };
      streams.set(started.liveStreamId, started);
      return started;
    },
    async endLiveStream(input: EndLiveStreamInput & { endedAtEpochSeconds: number }) {
      const existing = streams.get(input.liveStreamId);
      if (!existing) {
        return null;
      }
      const ended: LiveStreamView = {
        ...existing,
        status: 'ended',
        endedAt: new Date(input.endedAtEpochSeconds * 1000).toISOString(),
        updatedAt: new Date(input.endedAtEpochSeconds * 1000).toISOString(),
      };
      streams.set(ended.liveStreamId, ended);
      return ended;
    },
    async recordChatMessage(input: LiveChatMessageInput & { messageId: string }): Promise<LiveChatMessageView | null> {
      return {
        messageId: input.messageId,
        liveStreamId: input.liveStreamId,
        authorUserId: input.actorUserId,
        bodyText: input.bodyText,
        status: 'published',
        createdAt: new Date().toISOString(),
      };
    },
  };

  const entitlementPort = {
    async canStartLive() {
      return {
        allowed: entitlementAllowed,
        source: entitlementAllowed ? 'platform_tier' as const : 'none' as const,
      };
    },
    async canViewLive(input: {
      viewerUserId: string;
      creatorUserId: string;
      visibility: 'public' | 'followers' | 'subscribers';
    }) {
      return input.visibility === 'public' || input.viewerUserId === input.creatorUserId;
    },
  };

  const roomPort = {
    async createRoom() {},
    async issueCredentials(input: { stream: LiveStreamView; viewerUserId: string }): Promise<LiveStreamCredentials> {
      return {
        liveStreamId: input.stream.liveStreamId,
        roomRef: input.stream.roomRef,
        publishToken: 'publish-test',
        viewerToken: 'viewer-test',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    },
    async endRoom() {},
  };

  return {
    service: new LiveService(repository, entitlementPort, roomPort),
    streams,
  };
}

test('LiveService enforces paid entitlement and scheduled-live-start-end transitions', async () => {
  const denied = createHarness(false);
  await assert.rejects(
    () => denied.service.createLiveStream({
      actorUserId: 'creator-free',
      title: 'Live session',
      visibility: 'public',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      recordingEnabled: true,
    }),
    /LIVE_NOT_AVAILABLE/,
  );

  const harness = createHarness(true);
  const scheduled = await harness.service.createLiveStream({
    actorUserId: 'creator-1',
    title: 'Studio stream',
    visibility: 'followers',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    recordingEnabled: true,
  });
  assert.ok(scheduled);
  assert.equal(scheduled?.status, 'scheduled');
  assert.equal(scheduled?.recordingEnabled, true);

  const started = await harness.service.startLiveStream({
    actorUserId: 'creator-1',
    liveStreamId: scheduled!.liveStreamId,
  });
  assert.equal(started?.status, 'live');

  const credentials = await harness.service.issueViewerCredentials({
    actorUserId: 'creator-1',
    liveStreamId: scheduled!.liveStreamId,
  });
  assert.equal(credentials?.publishToken, 'publish-test');

  const chat = await harness.service.postChatMessage({
    actorUserId: 'creator-1',
    liveStreamId: scheduled!.liveStreamId,
    bodyText: 'Welcome everyone',
  });
  assert.equal(chat?.status, 'published');

  const ended = await harness.service.endLiveStream({
    actorUserId: 'creator-1',
    liveStreamId: scheduled!.liveStreamId,
  });
  assert.equal(ended?.status, 'ended');
  assert.ok(ended?.endedAt);
});

test('LiveService denies unauthorized creators and invalid chat content', async () => {
  const harness = createHarness(true);
  const scheduled = await harness.service.createLiveStream({
    actorUserId: 'creator-1',
    title: 'Private stream',
    visibility: 'subscribers',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  assert.ok(scheduled);

  const deniedStart = await harness.service.startLiveStream({
    actorUserId: 'other-user',
    liveStreamId: scheduled!.liveStreamId,
  });
  assert.equal(deniedStart, null);

  await harness.service.startLiveStream({
    actorUserId: 'creator-1',
    liveStreamId: scheduled!.liveStreamId,
  });

  await assert.rejects(
    () => harness.service.postChatMessage({
      actorUserId: 'creator-1',
      liveStreamId: scheduled!.liveStreamId,
      bodyText: ' ',
    }),
    /message is required/,
  );
});
