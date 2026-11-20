import type {
  ArchiveCreatorTierInput,
  CreateCreatorTierInput,
  UpdateCreatorTierInput,
} from '../../../../../packages/contracts/src';
import type { CreatorTiersService } from '../../service/creator-subscriptions/creator-tiers.service';

export class CreatorTiersHandler {
  constructor(private readonly service: CreatorTiersService) {}

  async createTier(
    actorUserId: string,
    body: Omit<CreateCreatorTierInput, 'actorUserId'>,
  ) {
    return this.service.createTier({ actorUserId, ...body });
  }

  async updateTier(
    actorUserId: string,
    body: Omit<UpdateCreatorTierInput, 'actorUserId'>,
  ) {
    return this.service.updateTier({ actorUserId, ...body });
  }

  async archiveTier(
    actorUserId: string,
    body: Omit<ArchiveCreatorTierInput, 'actorUserId'>,
  ) {
    return this.service.archiveTier({ actorUserId, ...body });
  }
}
