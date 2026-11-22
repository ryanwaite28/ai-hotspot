import type {
  CreatorPayoutAccountView,
  CreatorPayoutOnboardingSessionView,
  StartCreatorPayoutAccountInput,
} from '../../../../../packages/contracts/src';

export interface CreatorPayoutAccountPort {
  startOnboarding(input: StartCreatorPayoutAccountInput): Promise<CreatorPayoutOnboardingSessionView>;
  getAccountStatus(creatorUserId: string): Promise<CreatorPayoutAccountView | null>;
}
