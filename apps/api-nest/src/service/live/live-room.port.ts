import type { LiveStreamView, LiveStreamCredentials } from '../../../../../packages/contracts/src';

export interface LiveRoomPort {
  createRoom(stream: LiveStreamView): Promise<void>;
  issueCredentials(input: {
    stream: LiveStreamView;
    viewerUserId: string;
  }): Promise<LiveStreamCredentials>;
  endRoom(roomRef: string): Promise<void>;
}
