import type {
  CreateLiveStreamInput,
  StartLiveStreamInput,
  EndLiveStreamInput,
  LiveChatMessageInput,
} from '../../../../../packages/contracts/src';
import type { LiveService } from '../../service/live/live.service';

export class LiveHandler {
  constructor(private readonly service: LiveService) {}

  async createLiveStream(
    actorUserId: string,
    body: Omit<CreateLiveStreamInput, 'actorUserId'>,
  ) {
    return this.service.createLiveStream({ actorUserId, ...body });
  }

  async startLiveStream(
    actorUserId: string,
    body: Omit<StartLiveStreamInput, 'actorUserId'>,
  ) {
    return this.service.startLiveStream({ actorUserId, ...body });
  }

  async endLiveStream(
    actorUserId: string,
    body: Omit<EndLiveStreamInput, 'actorUserId'>,
  ) {
    return this.service.endLiveStream({ actorUserId, ...body });
  }

  async issueViewerCredentials(actorUserId: string, liveStreamId: string) {
    return this.service.issueViewerCredentials({ actorUserId, liveStreamId });
  }

  async postChatMessage(
    actorUserId: string,
    body: Omit<LiveChatMessageInput, 'actorUserId'>,
  ) {
    return this.service.postChatMessage({ actorUserId, ...body });
  }
}
