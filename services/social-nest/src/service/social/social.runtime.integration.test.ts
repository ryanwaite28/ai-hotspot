import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  createRuntimeSocialHarness,
  destroyRuntimeSocialHarness,
} from './social.runtime.integration.harness';

function hasRuntimeDeps(): boolean {
  return process.env.PHASE2_RUNTIME_INTEGRATION === '1' || process.env.PHASE1_RUNTIME_INTEGRATION === '1';
}

function uniqueToken(): string {
  return crypto.randomUUID().slice(0, 8);
}

test('runtime integration: social profile update and outbox event persistence', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimeSocialHarness();

  try {
    const token = uniqueToken();
    const actor = await harness.createActiveUser({
      handle: `social_actor_${token}`,
      email: `social_actor_${token}@rmwhs.com`,
      displayName: 'Social Actor',
    });

    const updated = await harness.service.updateOwnProfile(actor.id, {
      handle: `social_actor_updated_${token}`,
      displayName: 'Social Actor Updated',
      bio: 'Runtime profile update test',
      visibility: 'protected',
      followerListVisibility: 'followers',
      links: [{ label: 'site', url: 'https://rmwhs.com' }],
    });

    assert.ok(updated);
    assert.equal(updated?.handle, `social_actor_updated_${token}`);
    assert.equal(updated?.followerListVisibility, 'followers');

    const fetched = await harness.service.getProfileByHandle({ handle: `social_actor_updated_${token}` });
    assert.ok(fetched);
    assert.equal(fetched?.displayName, 'Social Actor Updated');

    const eventTypes = await harness.listOutboxEventTypesForAggregate(actor.id);
    assert.ok(eventTypes.includes('profile.updated'));
  } finally {
    await destroyRuntimeSocialHarness(harness);
  }
});

test('runtime integration: protected follow request lifecycle with approval and follower-list visibility', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimeSocialHarness();

  try {
    const token = uniqueToken();
    const owner = await harness.createActiveUser({
      handle: `social_owner_${token}`,
      email: `social_owner_${token}@rmwhs.com`,
      displayName: 'Social Owner',
    });
    const requester = await harness.createActiveUser({
      handle: `social_requester_${token}`,
      email: `social_requester_${token}@rmwhs.com`,
      displayName: 'Social Requester',
    });

    await harness.service.updateOwnProfile(owner.id, {
      visibility: 'protected',
      followerListVisibility: 'followers',
    });

    const followRequested = await harness.service.follow(requester.id, { targetUserId: owner.id });
    assert.equal(followRequested?.status, 'pending');

    const hiddenFollowers = await harness.service.listFollowers(
      { targetUserId: owner.id },
      { limit: 10 },
      requester.id,
    );
    assert.equal(hiddenFollowers, null);

    const approved = await harness.service.approveFollow(owner.id, { requesterUserId: requester.id });
    assert.equal(approved?.status, 'accepted');

    const visibleFollowers = await harness.service.listFollowers(
      { targetUserId: owner.id },
      { limit: 10 },
      requester.id,
    );
    assert.ok(visibleFollowers);
    assert.equal(visibleFollowers?.items.length, 1);
    assert.equal(visibleFollowers?.items[0].followerId, requester.id);

    const removed = await harness.service.unfollow(requester.id, { targetUserId: owner.id });
    assert.equal(removed.removed, true);

    const eventTypes = await harness.listOutboxEventTypesForAggregate(owner.id);
    assert.ok(eventTypes.includes('follow.requested'));
    assert.ok(eventTypes.includes('follow.accepted'));
    assert.ok(eventTypes.includes('follow.removed'));
  } finally {
    await destroyRuntimeSocialHarness(harness);
  }
});
