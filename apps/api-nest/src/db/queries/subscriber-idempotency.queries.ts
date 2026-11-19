import type { DbRow } from './query.types';

export interface ConsumedDomainEventInsertRow extends DbRow {
  id: string;
}

export const subscriberIdempotencyQueries = {
  insertConsumedDomainEvent: `
    INSERT INTO consumed_domain_events (
      subscriber_name,
      event_id,
      event_type,
      status
    )
    VALUES ($1, $2, $3, 'processed')
    ON CONFLICT (subscriber_name, event_id) DO NOTHING
    RETURNING id
  `,
};
