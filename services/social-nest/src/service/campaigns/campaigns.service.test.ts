import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CampaignView,
  CreateCampaignInput,
  SubmitCampaignInput,
  UpdateCampaignStatusInput,
} from '../../../../../packages/contracts/src';
import { CampaignsService } from './campaigns.service';

function createHarness(entitlementAllowed: boolean) {
  const campaigns = new Map<string, CampaignView>();

  const repository = {
    async createCampaign(input: CreateCampaignInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const now = new Date(input.occurredAtEpochSeconds * 1000).toISOString();
      const campaign: CampaignView = {
        campaignId: `campaign-${campaigns.size + 1}`,
        advertiserUserId: input.actorUserId,
        name: input.name,
        objective: input.objective,
        status: 'draft',
        placement: input.placement,
        budgetCents: input.budgetCents,
        currency: input.currency ?? 'USD',
        category: input.category,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        creativeUrl: input.creativeUrl,
        destinationUrl: input.destinationUrl,
        createdAt: now,
        updatedAt: now,
      };
      campaigns.set(campaign.campaignId, campaign);
      return campaign;
    },
    async submitCampaign(input: SubmitCampaignInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = campaigns.get(input.campaignId);
      if (!existing || existing.advertiserUserId !== input.actorUserId || existing.status !== 'draft') {
        return null;
      }
      const submitted = {
        ...existing,
        status: 'pending_review' as const,
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      campaigns.set(submitted.campaignId, submitted);
      return submitted;
    },
    async updateCampaignStatus(input: UpdateCampaignStatusInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = campaigns.get(input.campaignId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        status: input.status,
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      campaigns.set(updated.campaignId, updated);
      return updated;
    },
  };

  const entitlementPort = {
    async canCreatePaidCampaign() {
      return {
        allowed: entitlementAllowed,
        source: entitlementAllowed ? 'platform_tier' as const : 'none' as const,
      };
    },
  };

  return {
    service: new CampaignsService(repository, entitlementPort),
    campaigns,
  };
}

test('CampaignsService blocks paid campaign creation without paid/trial entitlement', async () => {
  const harness = createHarness(false);

  await assert.rejects(
    () => harness.service.createCampaign({
      actorUserId: 'user-free',
      name: 'Community launch',
      objective: 'reach',
      placement: 'feed',
      budgetCents: 1000,
      category: 'technology',
      startsAt: '2026-11-21T00:00:00Z',
      creativeUrl: 'https://cdn.hotspot.local/campaign.png',
      destinationUrl: 'https://hotspot.local/products',
    }),
    /ENTITLEMENT_REQUIRED/,
  );
});

test('CampaignsService validates campaign budget, schedule, URLs, and submit state', async () => {
  const harness = createHarness(true);

  await assert.rejects(
    () => harness.service.createCampaign({
      actorUserId: 'advertiser-1',
      name: 'Invalid budget',
      objective: 'visits',
      placement: 'feed',
      budgetCents: 0,
      category: 'technology',
      startsAt: '2026-11-21T00:00:00Z',
      creativeUrl: 'https://cdn.hotspot.local/campaign.png',
      destinationUrl: 'https://hotspot.local/products',
    }),
    /positive integer/,
  );

  const campaign = await harness.service.createCampaign({
    actorUserId: 'advertiser-1',
    name: 'Sponsor launch',
    objective: 'subscriptions',
    placement: 'profile',
    budgetCents: 2500,
    currency: 'usd',
    category: 'technology',
    startsAt: '2026-11-21T00:00:00Z',
    endsAt: '2026-11-28T00:00:00Z',
    creativeUrl: 'https://cdn.hotspot.local/campaign.png',
    destinationUrl: 'https://hotspot.local/products',
  });

  assert.ok(campaign);
  assert.equal(campaign?.status, 'draft');
  assert.equal(campaign?.currency, 'USD');

  const submitted = await harness.service.submitCampaign({
    actorUserId: 'advertiser-1',
    campaignId: campaign!.campaignId,
  });
  assert.equal(submitted?.status, 'pending_review');

  await assert.rejects(
    () => harness.service.updateCampaignStatus({
      actorUserId: 'admin-1',
      campaignId: campaign!.campaignId,
      status: 'rejected',
    }),
    /rejection reason is required/,
  );
});
