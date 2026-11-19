export interface EventIdempotencyInput {
  subscriberName: string;
  eventId: string;
  eventType: string;
}

export interface EventIdempotencyStore {
  markIfUnseen(input: EventIdempotencyInput): Promise<boolean>;
}

export interface SubscriberIdempotencyRepository {
  markEventConsumed(input: EventIdempotencyInput): Promise<boolean>;
}

export class InMemoryEventIdempotencyStore implements EventIdempotencyStore {
  private readonly keys = new Set<string>();

  async markIfUnseen(input: EventIdempotencyInput): Promise<boolean> {
    const key = `${input.subscriberName}:${input.eventId}`;
    if (this.keys.has(key)) {
      return false;
    }
    this.keys.add(key);
    return true;
  }
}

export class RepositoryEventIdempotencyStore implements EventIdempotencyStore {
  constructor(private readonly repository: SubscriberIdempotencyRepository) {}

  async markIfUnseen(input: EventIdempotencyInput): Promise<boolean> {
    return this.repository.markEventConsumed({
      subscriberName: input.subscriberName,
      eventId: input.eventId,
      eventType: input.eventType,
    });
  }
}
