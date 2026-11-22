import type {
  CampaignView,
  CreateCampaignInput,
  SubmitCampaignInput,
  UpdateCampaignStatusInput,
} from '../../../../../packages/contracts/src';

export interface CampaignsRepository {
  createCampaign(input: CreateCampaignInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null>;
  submitCampaign(input: SubmitCampaignInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null>;
  updateCampaignStatus(input: UpdateCampaignStatusInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CampaignView | null>;
}
