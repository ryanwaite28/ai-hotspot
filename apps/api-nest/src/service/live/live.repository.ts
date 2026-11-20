import type {
  LiveStreamView,
  LiveStreamCredentials,
  LiveChatMessageView,
  CreateLiveStreamInput,
  StartLiveStreamInput,
  EndLiveStreamInput,
  LiveChatMessageInput,
} from '../../../../../packages/contracts/src';

export interface LiveRepository {
  createLiveStream(input: CreateLiveStreamInput & {
    liveStreamId: string;
    roomRef: string;
    scheduledAtEpochSeconds: number;
  }): Promise<LiveStreamView | null>;
  getLiveStream(liveStreamId: string): Promise<LiveStreamView | null>;
  startLiveStream(input: StartLiveStreamInput & {
    startedAtEpochSeconds: number;
  }): Promise<LiveStreamView | null>;
  endLiveStream(input: EndLiveStreamInput & {
    endedAtEpochSeconds: number;
  }): Promise<LiveStreamView | null>;
  recordChatMessage(input: LiveChatMessageInput & {
    messageId: string;
  }): Promise<LiveChatMessageView | null>;
}
