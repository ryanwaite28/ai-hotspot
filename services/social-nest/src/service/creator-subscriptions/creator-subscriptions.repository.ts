import type {
  CreatorSubscriptionView,
  CreatorTierView,
  StartCreatorSubscriptionCheckoutInput,
  CreatorSubscriptionCheckoutView,
  CancelCreatorSubscriptionInput,
  UpdateCreatorSubscriptionWebhookInput,
  CanAccessCreatorTierInput,
} from '../../../../../packages/contracts/src';

export interface CreatorSubscriptionsRepository {
  getTierById(creatorTierId: string): Promise<CreatorTierView | null>;
  createCheckout(input: StartCreatorSubscriptionCheckoutInput & {
    checkoutId: string;
    expiresAtEpochSeconds: number;
  }): Promise<CreatorSubscriptionCheckoutView | null>;
  createOrUpdateSubscription(input: UpdateCreatorSubscriptionWebhookInput & {
    subscriberUserId: string;
    creatorUserId: string;
    creatorTierId: string;
  }): Promise<CreatorSubscriptionView | null>;
  cancelSubscription(input: CancelCreatorSubscriptionInput & {
    canceledAtEpochSeconds: number;
  }): Promise<CreatorSubscriptionView | null>;
  canAccessTier(input: CanAccessCreatorTierInput): Promise<boolean>;
}
