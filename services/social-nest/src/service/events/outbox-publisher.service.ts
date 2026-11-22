import { outboxQueries, type OutboxEventRow } from '../../db/queries/outbox.queries';
import type { DomainEventHeaders } from '../../../../../packages/contracts/src/index';
import type { JsonValue, QueryParam } from '../../db/queries/query.types';

export interface QueryExecutor {
  query<T>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface DomainEventEnvelope {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  payload: JsonValue;
  headers: DomainEventHeaders;
  occurredAt: string;
}

export interface DomainEventPublisher {
  publish(event: DomainEventEnvelope): Promise<void>;
}

export interface OutboxPublishResult {
  fetched: number;
  published: number;
  failed: number;
}

function mapHeaders(value: JsonValue): DomainEventHeaders {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return {
      schemaVersion: 1,
      producer: 'hotspot-api',
    };
  }

  const schemaVersionValue = value.schemaVersion;
  const producerValue = value.producer;

  return {
    ...value,
    schemaVersion: typeof schemaVersionValue === 'number' ? schemaVersionValue : 1,
    producer: typeof producerValue === 'string' ? producerValue : 'hotspot-api',
  };
}

function mapOutboxRow(row: OutboxEventRow): DomainEventEnvelope {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version === null ? null : Number(row.aggregate_version),
    payload: row.payload,
    headers: mapHeaders(row.headers),
    occurredAt: row.occurred_at,
  };
}

export class OutboxPublisherService {
  constructor(
    private readonly db: QueryExecutor,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async publishPendingBatch(limit: number): Promise<OutboxPublishResult> {
    const pending = await this.db.query<OutboxEventRow>(outboxQueries.selectPendingOutboxEvents, [limit]);

    let published = 0;
    let failed = 0;

    for (const row of pending.rows) {
      try {
        await this.publisher.publish(mapOutboxRow(row));
        await this.db.query(outboxQueries.markOutboxEventPublished, [row.id]);
        published += 1;
      } catch {
        await this.db.query(outboxQueries.incrementOutboxPublishAttempts, [row.id]);
        failed += 1;
      }
    }

    return {
      fetched: pending.rows.length,
      published,
      failed,
    };
  }
}
