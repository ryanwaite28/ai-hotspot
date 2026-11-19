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

  async markEventConsumed(input: {
    subscriberName: string;
    eventId: string;
    eventType: string;
  }): Promise<boolean> {
    const result = await this.db.query<ConsumedDomainEventInsertRow>(
      subscriberIdempotencyQueries.insertConsumedDomainEvent,
      [input.subscriberName, input.eventId, input.eventType],
    );
    return result.rows.length === 1;
  }
}
