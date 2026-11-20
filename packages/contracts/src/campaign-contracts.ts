export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'active'
  | 'completed'
  | 'canceled';

export type CampaignObjective = 'reach' | 'visits' | 'subscriptions';
export type CampaignPlacement = 'feed' | 'profile' | 'search';

export interface CampaignView {
  campaignId: string;
  advertiserUserId: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  placement: CampaignPlacement;
  budgetCents: number;
  currency: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  creativeUrl: string;
  destinationUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  actorUserId: string;
  name: string;
  objective: CampaignObjective;
  placement: CampaignPlacement;
  budgetCents: number;
  currency?: string;
  category: string;
  startsAt: string;
  endsAt?: string;
  creativeUrl: string;
  destinationUrl: string;
}

export interface SubmitCampaignInput {
  actorUserId: string;
  campaignId: string;
}

export interface UpdateCampaignStatusInput {
  actorUserId: string;
  campaignId: string;
  status: 'approved' | 'rejected' | 'paused' | 'active' | 'completed' | 'canceled';
  reason?: string;
}

export interface CampaignMetricsView {
  campaignId: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  regionRollups: Array<{ regionCode: string; impressions: number; clicks: number }>;
}
