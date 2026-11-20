import type {
  CreateCampaignInput,
  SubmitCampaignInput,
  UpdateCampaignStatusInput,
} from '../../../../../packages/contracts/src';
import type { CampaignsService } from '../../service/campaigns/campaigns.service';

export class CampaignsHandler {
  constructor(private readonly service: CampaignsService) {}

  async createCampaign(
    actorUserId: string,
    body: Omit<CreateCampaignInput, 'actorUserId'>,
  ) {
    return this.service.createCampaign({ actorUserId, ...body });
  }

  async submitCampaign(
    actorUserId: string,
    body: Omit<SubmitCampaignInput, 'actorUserId'>,
  ) {
    return this.service.submitCampaign({ actorUserId, ...body });
  }

  async updateCampaignStatus(
    actorUserId: string,
    body: Omit<UpdateCampaignStatusInput, 'actorUserId'>,
  ) {
    return this.service.updateCampaignStatus({ actorUserId, ...body });
  }
}
