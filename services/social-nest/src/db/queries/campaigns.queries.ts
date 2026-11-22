import type { DbRow, QueryParam } from './query.types';

export interface QueryExecutor {
  query<T extends DbRow>(sql: string, params: QueryParam[]): Promise<{ rows: T[] }>;
}

export interface CampaignRow extends DbRow {
  id: string;
  advertiser_id: string;
  name: string;
  objective: 'reach' | 'visits' | 'subscriptions';
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'paused' | 'active' | 'completed' | 'canceled';
  placement: 'feed' | 'profile' | 'search';
  budget_cents: number;
  currency: string;
  category: string;
  starts_at: string;
  ends_at: string | null;
  creative_url: string;
  destination_url: string;
  created_at: string;
  updated_at: string;
}

export const campaignQueries = {
  insertCampaignWithOutbox: `
    WITH inserted_campaign AS (
      INSERT INTO campaigns (
        advertiser_id, name, objective, status, placement, budget_cents,
        currency, category, starts_at, ends_at, creative_url, destination_url
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, to_timestamp($8),
        CASE WHEN $9 IS NULL THEN NULL ELSE to_timestamp($9) END,
        $10, $11)
      RETURNING id, advertiser_id, name, objective, status, placement,
        budget_cents, currency, category, starts_at, ends_at,
        creative_url, destination_url, created_at, updated_at
    ), inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $12, 'campaign', ic.id, NULL, 'campaign.created',
        jsonb_build_object(
          'campaignId', ic.id,
          'advertiserUserId', ic.advertiser_id,
          'name', ic.name,
          'objective', ic.objective,
          'placement', ic.placement,
          'budgetCents', ic.budget_cents,
          'currency', ic.currency,
          'category', ic.category,
          'status', ic.status,
          'startsAt', ic.starts_at,
          'endsAt', ic.ends_at
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($13)
      FROM inserted_campaign ic
      RETURNING id
    )
    SELECT id, advertiser_id, name, objective, status, placement,
      budget_cents, currency, category, starts_at, ends_at,
      creative_url, destination_url, created_at, updated_at
    FROM inserted_campaign
  `,

  submitCampaignWithOutbox: `
    WITH submitted_campaign AS (
      UPDATE campaigns
      SET status = 'pending_review', updated_at = NOW()
      WHERE id = $1 AND advertiser_id = $2 AND status = 'draft'
      RETURNING id, advertiser_id, name, objective, status, placement,
        budget_cents, currency, category, starts_at, ends_at,
        creative_url, destination_url, created_at, updated_at
    ), inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $3, 'campaign', sc.id, NULL, 'campaign.submitted',
        jsonb_build_object('campaignId', sc.id, 'advertiserUserId', sc.advertiser_id, 'status', sc.status),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($4)
      FROM submitted_campaign sc
      RETURNING id
    )
    SELECT id, advertiser_id, name, objective, status, placement,
      budget_cents, currency, category, starts_at, ends_at,
      creative_url, destination_url, created_at, updated_at
    FROM submitted_campaign
  `,

  updateCampaignStatusWithOutbox: `
    WITH updated_campaign AS (
      UPDATE campaigns
      SET status = $2,
          rejection_reason = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejection_reason END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, advertiser_id, name, objective, status, placement,
        budget_cents, currency, category, starts_at, ends_at,
        creative_url, destination_url, created_at, updated_at
    ), inserted_outbox AS (
      INSERT INTO domain_event_outbox (
        event_id, aggregate_type, aggregate_id, aggregate_version,
        event_type, payload, headers, occurred_at
      )
      SELECT
        $4, 'campaign', uc.id, NULL, 'campaign.status.changed',
        jsonb_build_object(
          'campaignId', uc.id,
          'advertiserUserId', uc.advertiser_id,
          'status', uc.status,
          'reason', $3
        ),
        jsonb_build_object('schemaVersion', 1, 'producer', 'hotspot-api'),
        to_timestamp($5)
      FROM updated_campaign uc
      RETURNING id
    )
    SELECT id, advertiser_id, name, objective, status, placement,
      budget_cents, currency, category, starts_at, ends_at,
      creative_url, destination_url, created_at, updated_at
    FROM updated_campaign
  `,
};
