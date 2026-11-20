import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CreatorPayoutAccountView,
  CreatorPayoutOnboardingSessionView,
  StartCreatorPayoutAccountInput,
} from '../../../../../packages/contracts/src';
import type { CreatorPayoutAccountPort } from './creator-payout-account.port';
import { CreatorPayoutAccountService } from './creator-payout-account.service';

function createHarness(initialStatus: CreatorPayoutAccountView | null) {
  let status = initialStatus;
  const port: CreatorPayoutAccountPort = {
    async startOnboarding(input: StartCreatorPayoutAccountInput): Promise<CreatorPayoutOnboardingSessionView> {
      status = {
        creatorUserId: input.actorUserId,
        providerAccountId: 'acct_test_creator',
        status: 'pending',
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        updatedAt: new Date().toISOString(),
      };
      return {
        accountId: 'acct_test_creator',
        onboardingUrl: 'https://connect.stripe.test/setup/acct_test_creator',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    },
    async getAccountStatus(creatorUserId: string): Promise<CreatorPayoutAccountView | null> {
      if (!status || status.creatorUserId !== creatorUserId) {
        return null;
      }
      return status;
    },
  };

  return {
    service: new CreatorPayoutAccountService(port),
    setStatus(nextStatus: CreatorPayoutAccountView | null) {
      status = nextStatus;
    },
  };
}

test('creator payout onboarding requires HTTPS and owner actor ID', async () => {
  const harness = createHarness(null);

  await assert.rejects(
    () => harness.service.startOnboarding({
      actorUserId: 'creator-1',
      returnUrl: 'http://hotspot.local/payout/return',
      refreshUrl: 'https://hotspot.local/payout/refresh',
    }),
    /HTTPS/,
  );

  const session = await harness.service.startOnboarding({
    actorUserId: 'creator-1',
    returnUrl: 'https://hotspot.local/payout/return',
    refreshUrl: 'https://hotspot.local/payout/refresh',
  });

  assert.equal(session.accountId, 'acct_test_creator');
});

test('creator payout status only exposes the requested creator account', async () => {
  const harness = createHarness({
    creatorUserId: 'creator-2',
    providerAccountId: 'acct_creator_2',
    status: 'restricted',
    payoutsEnabled: false,
    chargesEnabled: true,
    detailsSubmitted: true,
    updatedAt: new Date().toISOString(),
  });

  const ownStatus = await harness.service.getAccountStatus('creator-2');
  assert.equal(ownStatus?.status, 'restricted');

  const otherStatus = await harness.service.getAccountStatus('creator-other');
  assert.equal(otherStatus, null);
});

test('enabled payout account requires provider status and payout capability', async () => {
  const harness = createHarness({
    creatorUserId: 'creator-3',
    providerAccountId: 'acct_creator_3',
    status: 'enabled',
    payoutsEnabled: true,
    chargesEnabled: true,
    detailsSubmitted: true,
    updatedAt: new Date().toISOString(),
  });

  const status = await harness.service.getAccountStatus('creator-3');
  assert.equal(status?.status, 'enabled');
  assert.equal(status?.payoutsEnabled, true);
});
