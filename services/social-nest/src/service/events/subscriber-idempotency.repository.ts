import {
  subscriberIdempotencyQueries,
  type ConsumedDomainEventInsertRow,
} from '../../db/queries/subscriber-idempotency.queries';
import type { QueryParam } from '../../db/queries/query.types';

export interface QueryExecutor {
  query<T>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export class SubscriberIdempotencyRepository {
  constructor(private readonly db: QueryExecutor) {}

  async tryStartEventProcessing(input: {
    subscriberName: string;
    eventId: string;
    eventType: string;
  }): Promise<boolean> {
    const result = await this.db.query<ConsumedDomainEventInsertRow>(
      subscriberIdempotencyQueries.tryStartEventProcessing,
      [input.subscriberName, input.eventId, input.eventType, 300],
    );
    return result.rows.length === 1;
  }

  async markEventProcessed(input: {
    subscriberName: string;
    eventId: string;
    eventType: string;
  }): Promise<void> {
    await this.db.query<ConsumedDomainEventInsertRow>(
      subscriberIdempotencyQueries.markEventProcessed,
      [input.subscriberName, input.eventId, input.eventType],
    );
  }

  async markEventFailed(input: {
    subscriberName: string;
    eventId: string;
    eventType: string;
    errorMessage: string;
  }): Promise<void> {
    await this.db.query<ConsumedDomainEventInsertRow>(
      subscriberIdempotencyQueries.markEventFailed,
      [input.subscriberName, input.eventId, input.eventType, input.errorMessage],
    );
  }
}
