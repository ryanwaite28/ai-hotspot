import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CreatorSubscriptionView,
  CreatorTierView,
  StartCreatorSubscriptionCheckoutInput,
  CreatorSubscriptionCheckoutView,
  CancelCreatorSubscriptionInput,
  UpdateCreatorSubscriptionWebhookInput,
  CanAccessCreatorTierInput,
} from '../../../../../packages/contracts/src';
import { CreatorSubscriptionsService } from './creator-subscriptions.service';

function createHarness() {
  const tiers = new Map<string, CreatorTierView>();
  const subscriptions = new Map<string, CreatorSubscriptionView>();

  const tier: CreatorTierView = {
    creatorTierId: 'tier-1',
    creatorUserId: 'creator-1',
    name: 'Supporter',
    description: 'Featured supporter posts',
    monthlyCents: 499,
    currency: 'USD',
    recurringInterval: 'monthly',
    subscriberLimit: 100,
    status: 'active',
    stripePriceId: 'price_creator_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tiers.set(tier.creatorTierId, tier);

  const repository = {
    async getTierById(creatorTierId: string) {
      return tiers.get(creatorTierId) ?? null;
    },
    async createCheckout(input: StartCreatorSubscriptionCheckoutInput & { checkoutId: string; expiresAtEpochSeconds: number }): Promise<CreatorSubscriptionCheckoutView | null> {
      return {
        checkoutId: input.checkoutId,
        checkoutUrl: `https://checkout.stripe.test/${input.checkoutId}`,
        creatorTierId: input.creatorTierId,
        expiresAt: new Date(input.expiresAtEpochSeconds * 1000).toISOString(),
      };
    },
    async createOrUpdateSubscription(input: UpdateCreatorSubscriptionWebhookInput & {
      subscriberUserId: string;
      creatorUserId: string;
      creatorTierId: string;
    }): Promise<CreatorSubscriptionView | null> {
      const existing = Array.from(subscriptions.values())
        .find((subscription) => subscription.stripeSubscriptionId === input.stripeSubscriptionId);

      const now = new Date().toISOString();
      const subscription: CreatorSubscriptionView = {
        subscriptionId: existing?.subscriptionId ?? `subscription-${subscriptions.size + 1}`,
        subscriberUserId: input.subscriberUserId,
        creatorUserId: input.creatorUserId,
        creatorTierId: input.creatorTierId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        status: input.status,
        periodStartAt: input.periodStartAt,
        periodEndAt: input.periodEndAt,
        canceledAt: input.action === 'canceled' ? now : existing?.canceledAt ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      subscriptions.set(subscription.subscriptionId, subscription);
      return subscription;
    },
    async cancelSubscription(input: CancelCreatorSubscriptionInput & { canceledAtEpochSeconds: number }): Promise<CreatorSubscriptionView | null> {
      const existing = subscriptions.get(input.subscriptionId);
      if (!existing || existing.subscriberUserId !== input.actorUserId) {
        return null;
      }
      const canceled: CreatorSubscriptionView = {
        ...existing,
        status: 'canceled',
        canceledAt: new Date(input.canceledAtEpochSeconds * 1000).toISOString(),
        updatedAt: new Date(input.canceledAtEpochSeconds * 1000).toISOString(),
      };
      subscriptions.set(canceled.subscriptionId, canceled);
      return canceled;
    },
    async canAccessTier(input: CanAccessCreatorTierInput): Promise<boolean> {
      if (input.creatorUserId === input.viewerUserId) {
        return true;
      }
      const now = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
      return Array.from(subscriptions.values()).some((subscription) =>
        subscription.subscriberUserId === input.viewerUserId
          && subscription.creatorTierId === input.creatorTierId
          && subscription.status === 'active'
          && Math.floor(Date.parse(subscription.periodEndAt) / 1000) > now
      );
    },
  };

  return {
    service: new CreatorSubscriptionsService(repository),
    tiers,
    subscriptions,
  };
}

test('CreatorSubscriptionsService starts HTTPS checkout only for active tiers', async () => {
  const harness = createHarness();

  const checkout = await harness.service.startCheckout({
    actorUserId: 'subscriber-1',
    creatorTierId: 'tier-1',
    successUrl: 'https://hotspot.local/creator/success',
    cancelUrl: 'https://hotspot.local/creator/cancel',
  });

  assert.ok(checkout);
  assert.ok(checkout?.checkoutUrl.startsWith('https://'));

  await assert.rejects(
    () => harness.service.startCheckout({
      actorUserId: 'subscriber-1',
      creatorTierId: 'tier-1',
      successUrl: 'http://hotspot.local/creator/success',
      cancelUrl: 'https://hotspot.local/creator/cancel',
    }),
    /HTTPS/,
  );
});

test('CreatorSubscriptionsService grants active tier access and subscriber cancellation', async () => {
  const harness = createHarness();

  const subscription = await harness.service.processWebhookUpdate({
    subscriberUserId: 'subscriber-1',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
    stripeSubscriptionId: 'sub_test_1',
    eventId: 'evt_sub_active_1',
    status: 'active',
    periodStartAt: new Date().toISOString(),
    periodEndAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    action: 'activated',
  });

  assert.ok(subscription);
  assert.equal(subscription?.status, 'active');

  const access = await harness.service.canAccessTier({
    viewerUserId: 'subscriber-1',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
  });
  assert.equal(access, true);

  const creatorAccess = await harness.service.canAccessTier({
    viewerUserId: 'creator-1',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
  });
  assert.equal(creatorAccess, true);

  const canceled = await harness.service.cancelSubscription({
    actorUserId: 'subscriber-1',
    subscriptionId: subscription!.subscriptionId,
    reason: 'cancelled by subscriber',
  });
  assert.equal(canceled?.status, 'canceled');

  const deniedAfterCancel = await harness.service.canAccessTier({
    viewerUserId: 'subscriber-1',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
  });
  assert.equal(deniedAfterCancel, false);
});

test('CreatorSubscriptionsService handles renewal, refund, and past-due states', async () => {
  const harness = createHarness();
  const now = new Date();

  const active = await harness.service.processWebhookUpdate({
    subscriberUserId: 'subscriber-2',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
    stripeSubscriptionId: 'sub_test_2',
    eventId: 'evt_sub_active_2',
    status: 'active',
    periodStartAt: now.toISOString(),
    periodEndAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    action: 'activated',
  });
  assert.ok(active);

  const renewed = await harness.service.processWebhookUpdate({
    subscriberUserId: 'subscriber-2',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
    stripeSubscriptionId: 'sub_test_2',
    eventId: 'evt_sub_renewed_2',
    status: 'active',
    periodStartAt: now.toISOString(),
    periodEndAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    action: 'renewed',
  });
  assert.equal(renewed?.status, 'active');

  const pastDue = await harness.service.processWebhookUpdate({
    subscriberUserId: 'subscriber-2',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
    stripeSubscriptionId: 'sub_test_2',
    eventId: 'evt_sub_past_due_2',
    status: 'past_due',
    periodStartAt: now.toISOString(),
    periodEndAt: renewed!.periodEndAt,
    action: 'past_due',
  });
  assert.equal(pastDue?.status, 'past_due');

  const refunded = await harness.service.processWebhookUpdate({
    subscriberUserId: 'subscriber-2',
    creatorUserId: 'creator-1',
    creatorTierId: 'tier-1',
    stripeSubscriptionId: 'sub_test_2',
    eventId: 'evt_sub_refunded_2',
    status: 'refunded',
    periodStartAt: now.toISOString(),
    periodEndAt: renewed!.periodEndAt,
    action: 'refunded',
  });
  assert.equal(refunded?.status, 'refunded');
});
