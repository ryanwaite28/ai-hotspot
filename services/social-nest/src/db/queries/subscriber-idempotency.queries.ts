import type { DbRow } from './query.types';

export interface ConsumedDomainEventInsertRow extends DbRow {
  id: string;
}

export const subscriberIdempotencyQueries = {
  tryStartEventProcessing: `
    INSERT INTO consumed_domain_events (
      subscriber_name,
      event_id,
      event_type,
      status,
      attempt_count,
      first_seen_at,
      last_attempt_at,
      lease_expires_at,
      last_error
    )
    VALUES (
      $1,
      $2,
      $3,
      'processing',
      1,
      NOW(),
      NOW(),
      NOW() + ($4::text || ' seconds')::interval,
      NULL
    )
    ON CONFLICT (subscriber_name, event_id)
    DO UPDATE SET
      event_type = EXCLUDED.event_type,
      status = 'processing',
      attempt_count = consumed_domain_events.attempt_count + 1,
      last_attempt_at = NOW(),
      lease_expires_at = NOW() + ($4::text || ' seconds')::interval,
      last_error = NULL
    WHERE consumed_domain_events.status = 'failed'
      OR (
        consumed_domain_events.status = 'processing'
        AND consumed_domain_events.lease_expires_at <= NOW()
      )
    RETURNING id
  `,

  markEventProcessed: `
    UPDATE consumed_domain_events
    SET
      status = 'processed',
      processed_at = NOW(),
      completed_at = NOW(),
      lease_expires_at = NULL,
      last_error = NULL
    WHERE subscriber_name = $1
      AND event_id = $2
      AND status = 'processing'
    RETURNING id
  `,

  markEventFailed: `
    UPDATE consumed_domain_events
    SET
      status = 'failed',
      lease_expires_at = NULL,
      last_error = $4
    WHERE subscriber_name = $1
      AND event_id = $2
      AND status = 'processing'
    RETURNING id
  `,
};
