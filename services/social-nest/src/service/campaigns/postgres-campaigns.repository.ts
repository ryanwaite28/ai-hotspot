import type {
  CampaignView,
  CreateCampaignInput,
  SubmitCampaignInput,
  UpdateCampaignStatusInput,
} from '../../../../../packages/contracts/src';
import {
  campaignQueries,
  type CampaignRow,
  type QueryExecutor,
} from '../../db/queries/campaigns.queries';
import type { CampaignsRepository } from './campaigns.repository';

function mapCampaign(row: CampaignRow): CampaignView {
  return {
    campaignId: row.id,
    advertiserUserId: row.advertiser_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    placement: row.placement,
    budgetCents: row.budget_cents,
    currency: row.currency,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    creativeUrl: row.creative_url,
    destinationUrl: row.destination_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresCampaignsRepository implements CampaignsRepository {
  constructor(private readonly db: QueryExecutor) {}

  async createCampaign(input: CreateCampaignInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null> {
    const startsAt = Math.floor(Date.parse(input.startsAt) / 1000);
    const endsAt = input.endsAt ? Math.floor(Date.parse(input.endsAt) / 1000) : null;
    const result = await this.db.query<CampaignRow>(campaignQueries.insertCampaignWithOutbox, [
      input.actorUserId,
      input.name,
      input.objective,
      input.placement,
      input.budgetCents,
      input.currency ?? 'USD',
      input.category,
      startsAt,
      endsAt,
      input.creativeUrl,
      input.destinationUrl,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  }

  async submitCampaign(input: SubmitCampaignInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null> {
    const result = await this.db.query<CampaignRow>(campaignQueries.submitCampaignWithOutbox, [
      input.campaignId,
      input.actorUserId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  }

  async updateCampaignStatus(input: UpdateCampaignStatusInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null> {
    const result = await this.db.query<CampaignRow>(campaignQueries.updateCampaignStatusWithOutbox, [
      input.campaignId,
      input.status,
      input.reason ?? null,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);
    return result.rows[0] ? mapCampaign(result.rows[0]) : null;
  }
}
