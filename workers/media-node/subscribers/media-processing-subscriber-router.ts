import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';

export interface MediaProcessingSubscriber {
  handle(event: DomainEventEnvelope): Promise<boolean>;
}

export class MediaProcessingSubscriberRouter {
  constructor(private readonly subscribers: MediaProcessingSubscriber[]) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    let handled = false;

    for (const subscriber of this.subscribers) {
      const didHandle = await subscriber.handle(event);
      handled = handled || didHandle;
    }

    return handled;
  }
}
