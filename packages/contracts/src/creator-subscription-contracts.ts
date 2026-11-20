export type CreatorTierStatus = 'draft' | 'active' | 'archived';
export type SubscriptionInterval = 'monthly' | 'yearly';
export type CreatorPayoutAccountStatus = 'pending' | 'restricted' | 'enabled' | 'disabled';
export type CreatorSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'refunded'
  | 'expired';

export interface CreatorTierView {
  creatorTierId: string;
  creatorUserId: string;
  name: string;
  description: string | null;
  monthlyCents: number;
  currency: string;
  recurringInterval: SubscriptionInterval;
  subscriberLimit: number | null;
  status: CreatorTierStatus;
  stripePriceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreatorTierInput {
  actorUserId: string;
  name: string;
  description?: string;
  monthlyCents: number;
  currency?: string;
  recurringInterval?: SubscriptionInterval;
  subscriberLimit?: number;
}

export interface UpdateCreatorTierInput {
  actorUserId: string;
  creatorTierId: string;
  name?: string;
  description?: string;
  monthlyCents?: number;
  currency?: string;
  recurringInterval?: SubscriptionInterval;
  subscriberLimit?: number;
}

export interface ArchiveCreatorTierInput {
  actorUserId: string;
  creatorTierId: string;
}

export interface CreatorPayoutAccountView {
  creatorUserId: string;
  providerAccountId: string | null;
  status: CreatorPayoutAccountStatus;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  updatedAt: string;
}

export interface StartCreatorPayoutAccountInput {
  actorUserId: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface CreatorPayoutOnboardingSessionView {
  accountId: string;
  onboardingUrl: string;
  expiresAt: string;
}

export interface CreatorSubscriptionView {
  subscriptionId: string;
  subscriberUserId: string;
  creatorUserId: string;
  creatorTierId: string;
  stripeSubscriptionId: string | null;
  status: CreatorSubscriptionStatus;
  periodStartAt: string;
  periodEndAt: string;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartCreatorSubscriptionCheckoutInput {
  actorUserId: string;
  creatorTierId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatorSubscriptionCheckoutView {
  checkoutId: string;
  checkoutUrl: string;
  creatorTierId: string;
  expiresAt: string;
}

export interface CancelCreatorSubscriptionInput {
  actorUserId: string;
  subscriptionId: string;
  reason?: string;
}

export interface UpdateCreatorSubscriptionWebhookInput {
  stripeSubscriptionId: string;
  eventId: string;
  status: CreatorSubscriptionStatus;
  periodStartAt: string;
  periodEndAt: string;
  action: 'activated' | 'renewed' | 'canceled' | 'refunded' | 'past_due';
}

export interface CanAccessCreatorTierInput {
  viewerUserId: string;
  creatorUserId: string;
  creatorTierId: string;
  nowEpochSeconds?: number;
}
