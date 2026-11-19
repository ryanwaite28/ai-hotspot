import type { DbRow, JsonValue } from './query.types';

export interface OutboxEventRow extends DbRow {
  id: string;
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: string | number | null;
  event_type: string;
  payload: JsonValue;
  headers: JsonValue;
  occurred_at: string;
  publish_attempts: number;
}

export const outboxQueries = {
  selectPendingOutboxEvents: `
    SELECT
      id,
      event_id,
      aggregate_type,
      aggregate_id,
      aggregate_version,
      event_type,
      payload,
      headers,
      occurred_at,
      publish_attempts
    FROM domain_event_outbox
    WHERE published_at IS NULL
    ORDER BY created_at ASC
    LIMIT $1
  `,
  markOutboxEventPublished: `
    UPDATE domain_event_outbox
    SET published_at = NOW()
    WHERE id = $1
  `,
  incrementOutboxPublishAttempts: `
    UPDATE domain_event_outbox
    SET publish_attempts = publish_attempts + 1
    WHERE id = $1
  `,
};
