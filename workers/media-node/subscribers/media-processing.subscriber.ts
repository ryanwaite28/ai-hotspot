import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';
import type { UpdateMediaProcessingStatusInput } from '../../../packages/contracts/src';

export interface MediaProcessingSubscriber {
  handle(event: DomainEventEnvelope): Promise<boolean>;
}

export interface MediaProcessingStatusClient {
  updateProcessingStatus(input: UpdateMediaProcessingStatusInput): Promise<unknown>;
}

export class MediaProcessingRequestedSubscriber implements MediaProcessingSubscriber {
  constructor(private readonly mediaService: MediaProcessingStatusClient) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    if (event.eventType !== 'media.processing.requested') {
      return false;
    }

    await this.mediaService.updateProcessingStatus({
      mediaAssetId: event.aggregateId,
      processingStatus: 'ready',
      eventSource: 'worker',
    });

    return true;
  }
}
