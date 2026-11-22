import crypto from 'node:crypto';

import type {
  CreateLiveStreamInput,
  StartLiveStreamInput,
  EndLiveStreamInput,
  LiveStreamView,
  LiveStreamCredentials,
  LiveChatMessageInput,
  LiveChatMessageView,
} from '../../../../../packages/contracts/src';
import type { LiveEntitlementPort } from './live-entitlement.port';
import type { LiveRepository } from './live.repository';
import type { LiveRoomPort } from './live-room.port';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class LiveService {
  constructor(
    private readonly repository: LiveRepository,
    private readonly entitlementPort: LiveEntitlementPort,
    private readonly roomPort: LiveRoomPort,
  ) {}

  private normalizeTitle(title: string): string {
    const normalized = title.trim();
    if (normalized.length === 0) {
      throw new Error('Live stream title is required');
    }
    if (normalized.length > 140) {
      throw new Error('Live stream title exceeds maximum length');
    }
    return normalized;
  }

  async createLiveStream(input: CreateLiveStreamInput): Promise<LiveStreamView | null> {
    const scheduledAt = Date.parse(input.scheduledAt);
    if (!Number.isFinite(scheduledAt)) {
      throw new Error('Invalid live stream scheduledAt');
    }

    const scheduledAtSeconds = Math.floor(scheduledAt / 1000);
    if (scheduledAtSeconds < nowEpochSeconds()) {
      throw new Error('Live stream schedule cannot be in the past');
    }

    const entitlement = await this.entitlementPort.canStartLive({
      actorUserId: input.actorUserId,
      nowEpochSeconds: nowEpochSeconds(),
    });
    if (!entitlement.allowed) {
      throw new Error('LIVE_NOT_AVAILABLE');
    }

    return this.repository.createLiveStream({
      ...input,
      title: this.normalizeTitle(input.title),
      liveStreamId: crypto.randomUUID(),
      roomRef: `live-${crypto.randomUUID()}`,
      scheduledAtEpochSeconds: scheduledAtSeconds,
    });
  }

  async startLiveStream(input: StartLiveStreamInput): Promise<LiveStreamView | null> {
    const existing = await this.repository.getLiveStream(input.liveStreamId);
    if (!existing) {
      return null;
    }
    if (existing.creatorUserId !== input.actorUserId) {
      return null;
    }
    if (existing.status !== 'scheduled' && existing.status !== 'paused') {
      throw new Error('Invalid live stream start transition');
    }

    const entitlement = await this.entitlementPort.canStartLive({
      actorUserId: input.actorUserId,
      nowEpochSeconds: nowEpochSeconds(),
    });
    if (!entitlement.allowed) {
      throw new Error('LIVE_NOT_AVAILABLE');
    }

    const started = await this.repository.startLiveStream({
      ...input,
      startedAtEpochSeconds: nowEpochSeconds(),
    });
    if (started) {
      await this.roomPort.createRoom(started);
    }
    return started;
  }

  async endLiveStream(input: EndLiveStreamInput): Promise<LiveStreamView | null> {
    const existing = await this.repository.getLiveStream(input.liveStreamId);
    if (!existing) {
      return null;
    }
    if (existing.creatorUserId !== input.actorUserId) {
      return null;
    }
    if (existing.status !== 'live' && existing.status !== 'paused') {
      throw new Error('Invalid live stream end transition');
    }

    const ended = await this.repository.endLiveStream({
      ...input,
      endedAtEpochSeconds: nowEpochSeconds(),
    });
    if (ended) {
      await this.roomPort.endRoom(ended.roomRef);
    }
    return ended;
  }

  async issueViewerCredentials(input: {
    actorUserId: string;
    liveStreamId: string;
  }): Promise<LiveStreamCredentials | null> {
    const stream = await this.repository.getLiveStream(input.liveStreamId);
    if (!stream || stream.status !== 'live') {
      return null;
    }

    const canView = await this.entitlementPort.canViewLive({
      viewerUserId: input.actorUserId,
      creatorUserId: stream.creatorUserId,
      visibility: stream.visibility,
    });
    if (!canView) {
      return null;
    }

    return this.roomPort.issueCredentials({
      stream,
      viewerUserId: input.actorUserId,
    });
  }

  async postChatMessage(input: LiveChatMessageInput): Promise<LiveChatMessageView | null> {
    const stream = await this.repository.getLiveStream(input.liveStreamId);
    if (!stream || stream.status !== 'live') {
      return null;
    }

    const bodyText = input.bodyText.trim();
    if (bodyText.length === 0) {
      throw new Error('Live chat message is required');
    }
    if (bodyText.length > 500) {
      throw new Error('Live chat message exceeds maximum length');
    }

    const canView = await this.entitlementPort.canViewLive({
      viewerUserId: input.actorUserId,
      creatorUserId: stream.creatorUserId,
      visibility: stream.visibility,
    });
    if (!canView) {
      return null;
    }

    return this.repository.recordChatMessage({
      ...input,
      bodyText,
      messageId: crypto.randomUUID(),
    });
  }
}
