import type {
  ArchiveCreatorTierInput,
  CreatorTierView,
  CreateCreatorTierInput,
  UpdateCreatorTierInput,
} from '../../../../../packages/contracts/src';
import {
  creatorSubscriptionQueries,
  type CreatorTierRow,
  type QueryExecutor,
} from '../../db/queries/creator-subscriptions.queries';
import type { CreatorTiersRepository } from './creator-tiers.repository';

function mapCreatorTier(row: CreatorTierRow): CreatorTierView {
  return {
    creatorTierId: row.id,
    creatorUserId: row.creator_id,
    name: row.name,
    description: row.description,
    monthlyCents: row.monthly_cents,
    currency: row.currency,
    recurringInterval: row.recurring_interval,
    subscriberLimit: row.subscriber_limit,
    status: row.status,
    stripePriceId: row.stripe_price_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresCreatorTiersRepository implements CreatorTiersRepository {
  constructor(private readonly db: QueryExecutor) {}

  async createTier(input: CreateCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null> {
    const result = await this.db.query<CreatorTierRow>(
      creatorSubscriptionQueries.insertCreatorTierWithOutbox,
      [
        input.actorUserId,
        input.name,
        input.description ?? null,
        input.monthlyCents,
        input.currency ?? 'USD',
        input.recurringInterval ?? 'monthly',
        input.subscriberLimit ?? null,
        input.eventId,
        input.occurredAtEpochSeconds,
      ],
    );
    return result.rows[0] ? mapCreatorTier(result.rows[0]) : null;
  }

  async updateTier(input: UpdateCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null> {
    const clearSubscriberLimit = input.subscriberLimit !== undefined && input.subscriberLimit === 0;
    const result = await this.db.query<CreatorTierRow>(
      creatorSubscriptionQueries.updateCreatorTierWithOutbox,
      [
        input.creatorTierId,
        input.actorUserId,
        input.name ?? null,
        input.description ?? null,
        input.monthlyCents ?? null,
        input.currency ?? null,
        input.recurringInterval ?? null,
        clearSubscriberLimit,
        input.subscriberLimit ?? null,
        input.eventId,
        input.occurredAtEpochSeconds,
      ],
    );
    return result.rows[0] ? mapCreatorTier(result.rows[0]) : null;
  }

  async archiveTier(input: ArchiveCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null> {
    const result = await this.db.query<CreatorTierRow>(
      creatorSubscriptionQueries.archiveCreatorTierWithOutbox,
      [input.creatorTierId, input.actorUserId, input.eventId, input.occurredAtEpochSeconds],
    );
    return result.rows[0] ? mapCreatorTier(result.rows[0]) : null;
  }
}
