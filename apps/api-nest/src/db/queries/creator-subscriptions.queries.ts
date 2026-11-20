import type { DbRow, QueryParam } from '../queries/query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface CreatorTierRow extends DbRow {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  monthly_cents: number;
  currency: string;
  recurring_interval: 'monthly' | 'yearly';
  subscriber_limit: number | null;
  status: 'draft' | 'active' | 'archived';
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorSubscriptionRow extends DbRow {
  id: string;
  subscriber_id: string;
  creator_id: string;
  creator_tier_id: string;
  stripe_subscription_id: string | null;
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'refunded' | 'expired';
  period_start_at: string;
  period_end_at: string;
  canceled_at: string | null;
  refund_status: 'none' | 'refunded' | 'disputed';
  created_at: string;
  updated_at: string;
}

export const creatorSubscriptionQueries = {
  insertCreatorTierWithOutbox: `
    WITH inserted_tier AS (
      INSERT INTO creator_tiers (
        creator_id, name, description, monthly_cents, currency,
        recurring_interval, subscriber_limit, status, stripe_price_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', NULL)
      RETURNING id, creator_id, name, description, monthly_cents, currency,
        recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $8, 'creator_tier', ict.id, NULL, 'creator-tier.created',
        jsonb_build_object(
          'creatorTierId', ict.id,
          'creatorUserId', ict.creator_id,
          'name', ict.name,
          'monthlyCents', ict.monthly_cents,
          'currency', ict.currency,
          'recurringInterval', ict.recurring_interval,
          'status', ict.status
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($9)
      FROM inserted_tier ict
      RETURNING id
    )
    SELECT id, creator_id, name, description, monthly_cents, currency,
      recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    FROM inserted_tier
  `,

  updateCreatorTierWithOutbox: `
    WITH updated_tier AS (
      UPDATE creator_tiers
      SET
        name = COALESCE($3, name),
        description = CASE WHEN $4::text IS NULL THEN description ELSE $4 END,
        monthly_cents = COALESCE($5, monthly_cents),
        currency = COALESCE($6, currency),
        recurring_interval = COALESCE($7, recurring_interval),
        subscriber_limit = CASE WHEN $8::boolean THEN $9 ELSE subscriber_limit END,
        updated_at = NOW()
      WHERE id = $1 AND creator_id = $2 AND status != 'archived'
      RETURNING id, creator_id, name, description, monthly_cents, currency,
        recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $10, 'creator_tier', ut.id, NULL, 'creator-tier.updated',
        jsonb_build_object(
          'creatorTierId', ut.id,
          'creatorUserId', ut.creator_id,
          'name', ut.name,
          'monthlyCents', ut.monthly_cents,
          'currency', ut.currency,
          'recurringInterval', ut.recurring_interval,
          'status', ut.status
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($11)
      FROM updated_tier ut
      RETURNING id
    )
    SELECT id, creator_id, name, description, monthly_cents, currency,
      recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    FROM updated_tier
  `,

  archiveCreatorTierWithOutbox: `
    WITH archived_tier AS (
      UPDATE creator_tiers
      SET status = 'archived', updated_at = NOW()
      WHERE id = $1 AND creator_id = $2 AND status != 'archived'
      RETURNING id, creator_id, name, description, monthly_cents, currency,
        recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    ),
    inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'creator_tier', at.id, NULL, 'creator-tier.archived',
        jsonb_build_object(
          'creatorTierId', at.id,
          'creatorUserId', at.creator_id,
          'status', at.status
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM archived_tier at
      RETURNING id
    )
    SELECT id, creator_id, name, description, monthly_cents, currency,
      recurring_interval, subscriber_limit, status, stripe_price_id, created_at, updated_at
    FROM archived_tier
  `,
};
