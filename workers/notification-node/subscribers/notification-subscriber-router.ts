import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';

export interface NotificationSubscriber {
  handle(event: DomainEventEnvelope): Promise<boolean>;
}

export class NotificationSubscriberRouter {
  constructor(private readonly subscribers: NotificationSubscriber[]) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    let handled = false;

    for (const subscriber of this.subscribers) {
      const didHandle = await subscriber.handle(event);
      handled = handled || didHandle;
    }

    return handled;
  }
}
