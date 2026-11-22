import crypto from 'node:crypto';

import type {
  CreatorSubscriptionView,
  CreatorSubscriptionCheckoutView,
  StartCreatorSubscriptionCheckoutInput,
  CancelCreatorSubscriptionInput,
  UpdateCreatorSubscriptionWebhookInput,
  CanAccessCreatorTierInput,
} from '../../../../../packages/contracts/src';
import type { CreatorSubscriptionsRepository } from './creator-subscriptions.repository';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class CreatorSubscriptionsService {
  constructor(private readonly repository: CreatorSubscriptionsRepository) {}

  async startCheckout(input: StartCreatorSubscriptionCheckoutInput): Promise<CreatorSubscriptionCheckoutView | null> {
    if (!input.successUrl.startsWith('https://') || !input.cancelUrl.startsWith('https://')) {
      throw new Error('Creator subscription successUrl and cancelUrl must use HTTPS');
    }

    const tier = await this.repository.getTierById(input.creatorTierId);
    if (!tier || tier.status !== 'active') {
      return null;
    }

    if (tier.subscriberLimit !== null) {
      const hasCapacity = await this.repository.canAccessTier({
        viewerUserId: input.actorUserId,
        creatorUserId: tier.creatorUserId,
        creatorTierId: tier.creatorTierId,
      });
      if (hasCapacity) {
        return null;
      }
    }

    const now = nowEpochSeconds();
    return this.repository.createCheckout({
      ...input,
      checkoutId: crypto.randomUUID(),
      expiresAtEpochSeconds: now + 30 * 60,
    });
  }

  async cancelSubscription(input: CancelCreatorSubscriptionInput): Promise<CreatorSubscriptionView | null> {
    const reason = input.reason?.trim() || 'subscriber canceled';
    return this.repository.cancelSubscription({
      ...input,
      reason,
      canceledAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async processWebhookUpdate(input: UpdateCreatorSubscriptionWebhookInput & {
    subscriberUserId: string;
    creatorUserId: string;
    creatorTierId: string;
  }): Promise<CreatorSubscriptionView | null> {
    if (!input.stripeSubscriptionId.trim()) {
      throw new Error('Stripe subscription ID is required');
    }

    const periodStart = Date.parse(input.periodStartAt);
    const periodEnd = Date.parse(input.periodEndAt);
    if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart) {
      throw new Error('Invalid subscription period');
    }

    return this.repository.createOrUpdateSubscription(input);
  }

  async canAccessTier(input: CanAccessCreatorTierInput): Promise<boolean> {
    const tier = await this.repository.getTierById(input.creatorTierId);
    if (!tier || tier.status !== 'active') {
      return false;
    }

    if (tier.creatorUserId === input.viewerUserId) {
      return true;
    }

    return this.repository.canAccessTier(input);
  }
}
