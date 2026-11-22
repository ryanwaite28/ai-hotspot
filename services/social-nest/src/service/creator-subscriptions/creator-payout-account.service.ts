import type {
  CreatorPayoutAccountView,
  CreatorPayoutOnboardingSessionView,
  StartCreatorPayoutAccountInput,
} from '../../../../../packages/contracts/src';
import type { CreatorPayoutAccountPort } from './creator-payout-account.port';

export class CreatorPayoutAccountService {
  constructor(private readonly payoutPort: CreatorPayoutAccountPort) {}

  private validateUrls(input: StartCreatorPayoutAccountInput): void {
    if (!/^https:\/\//.test(input.returnUrl) || !/^https:\/\//.test(input.refreshUrl)) {
      throw new Error('Payout onboarding URLs must use HTTPS');
    }
  }

  async startOnboarding(input: StartCreatorPayoutAccountInput): Promise<CreatorPayoutOnboardingSessionView> {
    this.validateUrls(input);
    return this.payoutPort.startOnboarding(input);
  }

  async getAccountStatus(actorUserId: string): Promise<CreatorPayoutAccountView | null> {
    if (!actorUserId || actorUserId.trim().length === 0) {
      throw new Error('Authenticated creator user ID is required');
    }
    return this.payoutPort.getAccountStatus(actorUserId);
  }
}
