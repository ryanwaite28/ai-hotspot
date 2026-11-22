import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ArchiveCreatorTierInput,
  CreatorTierView,
  CreateCreatorTierInput,
  UpdateCreatorTierInput,
} from '../../../../../packages/contracts/src';
import { CreatorTiersService } from './creator-tiers.service';

function createHarness() {
  const tiers = new Map<string, CreatorTierView>();

  const repository = {
    async createTier(input: CreateCreatorTierInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const tier: CreatorTierView = {
        creatorTierId: `tier-${tiers.size + 1}`,
        creatorUserId: input.actorUserId,
        name: input.name,
        description: input.description ?? null,
        monthlyCents: input.monthlyCents,
        currency: input.currency ?? 'USD',
        recurringInterval: input.recurringInterval ?? 'monthly',
        subscriberLimit: input.subscriberLimit ?? null,
        status: 'draft',
        stripePriceId: null,
        createdAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      tiers.set(tier.creatorTierId, tier);
      return tier;
    },
    async updateTier(input: UpdateCreatorTierInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = tiers.get(input.creatorTierId);
      if (!existing || existing.creatorUserId !== input.actorUserId || existing.status === 'archived') {
        return null;
      }
      const updated: CreatorTierView = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        monthlyCents: input.monthlyCents ?? existing.monthlyCents,
        currency: input.currency ?? existing.currency,
        recurringInterval: input.recurringInterval ?? existing.recurringInterval,
        subscriberLimit: input.subscriberLimit !== undefined ? input.subscriberLimit : existing.subscriberLimit,
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      tiers.set(updated.creatorTierId, updated);
      return updated;
    },
    async archiveTier(input: ArchiveCreatorTierInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = tiers.get(input.creatorTierId);
      if (!existing || existing.creatorUserId !== input.actorUserId) {
        return null;
      }
      const archived: CreatorTierView = {
        ...existing,
        status: 'archived',
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      tiers.set(archived.creatorTierId, archived);
      return archived;
    },
  };

  return { service: new CreatorTiersService(repository), tiers };
}

test('CreatorTiersService creates and updates owner-only draft tiers', async () => {
  const harness = createHarness();

  const tier = await harness.service.createTier({
    actorUserId: 'creator-1',
    name: 'Supporter',
    description: 'Supporter-only featured posts',
    monthlyCents: 499,
    currency: 'usd',
    recurringInterval: 'monthly',
    subscriberLimit: 100,
  });

  assert.ok(tier);
  assert.equal(tier?.currency, 'USD');
  assert.equal(tier?.status, 'draft');

  const updated = await harness.service.updateTier({
    actorUserId: 'creator-1',
    creatorTierId: tier!.creatorTierId,
    name: 'Pro Supporter',
    monthlyCents: 799,
  });

  assert.equal(updated?.name, 'Pro Supporter');
  assert.equal(updated?.monthlyCents, 799);

  const denied = await harness.service.updateTier({
    actorUserId: 'other-user',
    creatorTierId: tier!.creatorTierId,
    name: 'Unauthorized',
  });
  assert.equal(denied, null);
});

test('CreatorTiersService validates tier values and archives tiers', async () => {
  const harness = createHarness();

  await assert.rejects(
    () => harness.service.createTier({
      actorUserId: 'creator-2',
      name: ' ',
      monthlyCents: 499,
    }),
    /name is required/,
  );

  await assert.rejects(
    () => harness.service.createTier({
      actorUserId: 'creator-2',
      name: 'Invalid',
      monthlyCents: 0,
    }),
    /positive integer/,
  );

  const tier = await harness.service.createTier({
    actorUserId: 'creator-2',
    name: 'Annual',
    monthlyCents: 4999,
    recurringInterval: 'yearly',
  });
  assert.ok(tier);

  const archived = await harness.service.archiveTier({
    actorUserId: 'creator-2',
    creatorTierId: tier!.creatorTierId,
  });
  assert.equal(archived?.status, 'archived');

  const deniedUpdate = await harness.service.updateTier({
    actorUserId: 'creator-2',
    creatorTierId: tier!.creatorTierId,
    name: 'Should Not Update',
  });
  assert.equal(deniedUpdate, null);
});
