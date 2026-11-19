const assert = require('node:assert/strict');
const test = require('node:test');

const { SocialHandler } = require('./social.handler');

test('SocialHandler delegates social graph/profile operations', async () => {
  const calls = [];

  const service = {
    async getProfileByHandle(input) { calls.push(['getProfileByHandle', input]); return { ok: true }; },
    async updateOwnProfile(input) { calls.push(['updateOwnProfile', input]); return { ok: true }; },
    async follow(input) { calls.push(['follow', input]); return { status: 'accepted' }; },
    async unfollow(input) { calls.push(['unfollow', input]); return { removed: true }; },
    async approveFollowRequest(input) { calls.push(['approveFollowRequest', input]); return { status: 'accepted' }; },
    async rejectFollowRequest(input) { calls.push(['rejectFollowRequest', input]); return { removed: true }; },
    async block(input) { calls.push(['block', input]); return { blocked: true }; },
    async mute(input) { calls.push(['mute', input]); return { muted: true }; },
    async listFollowers(input) { calls.push(['listFollowers', input]); return { items: [], nextCursor: null }; },
  };

  const handler = new SocialHandler(service);

  await handler.getProfileByHandle({ handle: 'target' }, 'viewer-1');
  await handler.updateOwnProfile('actor-1', { displayName: 'New Name' });
  await handler.follow('actor-1', { targetUserId: 'target-1' });
  await handler.unfollow('actor-1', { targetUserId: 'target-1' });
  await handler.approveFollow('actor-1', { requesterUserId: 'requester-1' });
  await handler.rejectFollow('actor-1', { requesterUserId: 'requester-1' });
  await handler.block('actor-1', { targetUserId: 'target-2' });
  await handler.mute('actor-1', { targetUserId: 'target-3' });
  await handler.listFollowers({ targetUserId: 'target-1' }, { limit: 20 }, 'viewer-1');

  assert.equal(calls.length, 9);
  assert.equal(calls[0][0], 'getProfileByHandle');
  assert.equal(calls[1][0], 'updateOwnProfile');
  assert.equal(calls[2][0], 'follow');
  assert.equal(calls[3][0], 'unfollow');
  assert.equal(calls[4][0], 'approveFollowRequest');
  assert.equal(calls[5][0], 'rejectFollowRequest');
  assert.equal(calls[6][0], 'block');
  assert.equal(calls[7][0], 'mute');
  assert.equal(calls[8][0], 'listFollowers');
});
