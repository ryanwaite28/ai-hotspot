export interface EventIdempotencyInput {
  subscriberName: string;
  eventId: string;
  eventType: string;
}

export interface EventIdempotencyFailureInput extends EventIdempotencyInput {
  errorMessage: string;
}

export interface EventIdempotencyStore {
  tryStartProcessing(input: EventIdempotencyInput): Promise<boolean>;
  markProcessed(input: EventIdempotencyInput): Promise<void>;
  markFailed(input: EventIdempotencyFailureInput): Promise<void>;
}

export interface SubscriberIdempotencyRepository {
  tryStartEventProcessing(input: EventIdempotencyInput): Promise<boolean>;
  markEventProcessed(input: EventIdempotencyInput): Promise<void>;
  markEventFailed(input: EventIdempotencyFailureInput): Promise<void>;
}

type InMemoryEventStatus = 'processing' | 'processed' | 'failed';

export class InMemoryEventIdempotencyStore implements EventIdempotencyStore {
  private readonly statuses = new Map<string, InMemoryEventStatus>();

  private key(input: EventIdempotencyInput): string {
    return `${input.subscriberName}:${input.eventId}`;
  }

  async tryStartProcessing(input: EventIdempotencyInput): Promise<boolean> {
    const key = this.key(input);
    const current = this.statuses.get(key);

    if (current === 'processed' || current === 'processing') {
      return false;
    }

    this.statuses.set(key, 'processing');
    return true;
  }

  async markProcessed(input: EventIdempotencyInput): Promise<void> {
    const key = this.key(input);
    this.statuses.set(key, 'processed');
  }

  async markFailed(input: EventIdempotencyFailureInput): Promise<void> {
    const key = this.key(input);
    this.statuses.set(key, 'failed');
  }
}

export class RepositoryEventIdempotencyStore implements EventIdempotencyStore {
  constructor(private readonly repository: SubscriberIdempotencyRepository) {}

  async tryStartProcessing(input: EventIdempotencyInput): Promise<boolean> {
    return this.repository.tryStartEventProcessing({
      subscriberName: input.subscriberName,
      eventId: input.eventId,
      eventType: input.eventType,
    });
  }

  async markProcessed(input: EventIdempotencyInput): Promise<void> {
    await this.repository.markEventProcessed({
      subscriberName: input.subscriberName,
      eventId: input.eventId,
      eventType: input.eventType,
    });
  }

  async markFailed(input: EventIdempotencyFailureInput): Promise<void> {
    await this.repository.markEventFailed({
      subscriberName: input.subscriberName,
      eventId: input.eventId,
      eventType: input.eventType,
      errorMessage: input.errorMessage,
    });
  }
}
