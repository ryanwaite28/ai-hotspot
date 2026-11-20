import type { StartCreatorPayoutAccountInput } from '../../../../../packages/contracts/src';
import type { CreatorPayoutAccountService } from '../../service/creator-subscriptions/creator-payout-account.service';

export class CreatorPayoutAccountHandler {
  constructor(private readonly service: CreatorPayoutAccountService) {}

  async startOnboarding(
    actorUserId: string,
    body: Omit<StartCreatorPayoutAccountInput, 'actorUserId'>,
  ) {
    return this.service.startOnboarding({ actorUserId, ...body });
  }

  async getAccountStatus(actorUserId: string) {
    return this.service.getAccountStatus(actorUserId);
  }
}
