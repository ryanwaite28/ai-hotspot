import crypto from 'node:crypto';

import type { LiveStreamCredentials, LiveStreamView } from '../../../../../packages/contracts/src';
import type { LiveRoomPort } from './live-room.port';

export class InMemoryLiveRoomPort implements LiveRoomPort {
  async createRoom(stream: LiveStreamView): Promise<void> {
    if (!stream.roomRef) {
      throw new Error('Live room reference is required');
    }
  }

  async issueCredentials(input: {
    stream: LiveStreamView;
    viewerUserId: string;
  }): Promise<LiveStreamCredentials> {
    return {
      liveStreamId: input.stream.liveStreamId,
      roomRef: input.stream.roomRef,
      publishToken: crypto.randomUUID(),
      viewerToken: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async endRoom(roomRef: string): Promise<void> {
    if (!roomRef) {
      throw new Error('Live room reference is required');
    }
  }
}
