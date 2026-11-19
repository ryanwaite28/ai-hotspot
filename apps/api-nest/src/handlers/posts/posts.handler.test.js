const assert = require('node:assert/strict');
const test = require('node:test');

const { PostsHandler } = require('./posts.handler');

test('PostsHandler delegates post workflows to service', async () => {
  const calls = [];

  const service = {
    async createDraft(input) { calls.push(['createDraft', input]); return { postId: 'p1' }; },
    async createOrSchedulePost(input) { calls.push(['createOrSchedulePost', input]); return { postId: 'p2' }; },
    async createReply(input) { calls.push(['createReply', input]); return { postId: 'p3' }; },
    async createRepost(input) { calls.push(['createRepost', input]); return { postId: 'p4' }; },
    async createQuote(input) { calls.push(['createQuote', input]); return { postId: 'p5' }; },
    async likePost(input) { calls.push(['likePost', input]); return { updated: true, post: { postId: 'p2' } }; },
    async unlikePost(input) { calls.push(['unlikePost', input]); return { updated: true, post: { postId: 'p2' } }; },
    async bookmarkPost(input) { calls.push(['bookmarkPost', input]); return { updated: true, post: { postId: 'p2' } }; },
    async unbookmarkPost(input) { calls.push(['unbookmarkPost', input]); return { updated: true, post: { postId: 'p2' } }; },
    async listFollowingFeed(input) { calls.push(['listFollowingFeed', input]); return { items: [], nextCursor: null }; },
    async listPublicFeed(input) { calls.push(['listPublicFeed', input]); return { items: [], nextCursor: null }; },
    async listTopicFeed(input) { calls.push(['listTopicFeed', input]); return { items: [], nextCursor: null }; },
    async updatePost(input) { calls.push(['updatePost', input]); return { postId: 'p2' }; },
    async deletePost(input) { calls.push(['deletePost', input]); return { deleted: true }; },
    async pinPost(input) { calls.push(['pinPost', input]); return { postId: 'p2' }; },
    async getOwnPost(input) { calls.push(['getOwnPost', input]); return { postId: input.postId }; },
  };

  const handler = new PostsHandler(service);

  await handler.createDraft('actor-1', { contentText: 'draft' });
  await handler.createOrSchedule('actor-1', { contentText: 'publish', publishAtIso: new Date().toISOString() });
  await handler.createReply('actor-1', { parentPostId: 'p2', contentText: 'reply' });
  await handler.repost('actor-1', { repostOfPostId: 'p2' });
  await handler.quote('actor-1', { quoteOfPostId: 'p2', contentText: 'quote' });
  await handler.like('actor-1', { postId: 'p2' });
  await handler.unlike('actor-1', { postId: 'p2' });
  await handler.bookmark('actor-1', { postId: 'p2' });
  await handler.unbookmark('actor-1', { postId: 'p2' });
  await handler.listFollowingFeed('actor-1', { limit: 20 });
  await handler.listPublicFeed({ limit: 20 });
  await handler.listTopicFeed({ topic: 'news', limit: 20 });
  await handler.update('actor-1', { postId: 'p2', contentText: 'updated' });
  await handler.remove('actor-1', { postId: 'p2' });
  await handler.pin('actor-1', { postId: 'p2', pinned: true });
  await handler.getOwn('actor-1', { postId: 'p2' });

  assert.equal(calls.length, 16);
  assert.equal(calls[0][0], 'createDraft');
  assert.equal(calls[1][0], 'createOrSchedulePost');
  assert.equal(calls[2][0], 'createReply');
  assert.equal(calls[3][0], 'createRepost');
  assert.equal(calls[4][0], 'createQuote');
  assert.equal(calls[5][0], 'likePost');
  assert.equal(calls[6][0], 'unlikePost');
  assert.equal(calls[7][0], 'bookmarkPost');
  assert.equal(calls[8][0], 'unbookmarkPost');
  assert.equal(calls[9][0], 'listFollowingFeed');
  assert.equal(calls[10][0], 'listPublicFeed');
  assert.equal(calls[11][0], 'listTopicFeed');
  assert.equal(calls[12][0], 'updatePost');
  assert.equal(calls[13][0], 'deletePost');
  assert.equal(calls[14][0], 'pinPost');
  assert.equal(calls[15][0], 'getOwnPost');
});
