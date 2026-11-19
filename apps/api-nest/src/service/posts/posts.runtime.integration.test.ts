import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  createRuntimePostsHarness,
  destroyRuntimePostsHarness,
} from './posts.runtime.integration.harness';

function hasRuntimeDeps(): boolean {
  return process.env.PHASE3_RUNTIME_INTEGRATION === '1' || process.env.PHASE2_RUNTIME_INTEGRATION === '1';
}

function uniqueToken(): string {
  return crypto.randomUUID().slice(0, 8);
}

test('runtime integration: posts workflows persist outbox events and feed visibility', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimePostsHarness();

  try {
    const token = uniqueToken();
    const author = await harness.createActiveUser({
      handle: `posts_author_${token}`,
      email: `posts_author_${token}@rmwhs.com`,
      displayName: 'Posts Author',
    });
    const viewer = await harness.createActiveUser({
      handle: `posts_viewer_${token}`,
      email: `posts_viewer_${token}@rmwhs.com`,
      displayName: 'Posts Viewer',
    });

    await harness.setFollowAccepted({
      followerId: viewer.id,
      followingId: author.id,
    });

    const created = await harness.handler.createOrSchedule(author.id, {
      contentText: 'Runtime post #devops',
      visibility: 'public',
    });
    assert.ok(created);

    const reply = await harness.handler.createReply(viewer.id, {
      parentPostId: created!.postId,
      contentText: 'Runtime reply',
    });
    assert.ok(reply);

    const repost = await harness.handler.repost(viewer.id, {
      repostOfPostId: created!.postId,
    });
    assert.ok(repost);

    const quote = await harness.handler.quote(viewer.id, {
      quoteOfPostId: created!.postId,
      contentText: 'Runtime quote',
    });
    assert.ok(quote);

    const like = await harness.handler.like(viewer.id, { postId: created!.postId });
    assert.equal(like.updated, true);

    const bookmark = await harness.handler.bookmark(viewer.id, { postId: created!.postId });
    assert.equal(bookmark.updated, true);

    const followingFeed = await harness.handler.listFollowingFeed(viewer.id, { limit: 10 });
    assert.ok(followingFeed.items.some((item) => item.postId === created!.postId));

    const publicFeed = await harness.handler.listPublicFeed({ limit: 10 });
    assert.ok(publicFeed.items.some((item) => item.postId === created!.postId));

    const topicFeed = await harness.handler.listTopicFeed({ topic: 'devops', limit: 10 });
    assert.ok(topicFeed.items.some((item) => item.postId === created!.postId));

    const createdEventTypes = await harness.listOutboxEventTypesForPost(created!.postId);
    assert.ok(createdEventTypes.includes('post.created'));
    assert.ok(createdEventTypes.includes('post.liked'));
    assert.ok(createdEventTypes.includes('post.bookmarked'));

    const replyEventTypes = await harness.listOutboxEventTypesForPost(reply!.postId);
    assert.ok(replyEventTypes.includes('post.replied'));

    const repostEventTypes = await harness.listOutboxEventTypesForPost(repost!.postId);
    assert.ok(repostEventTypes.includes('post.reposted'));

    const quoteEventTypes = await harness.listOutboxEventTypesForPost(quote!.postId);
    assert.ok(quoteEventTypes.includes('post.quoted'));
  } finally {
    await destroyRuntimePostsHarness(harness);
  }
});

test('runtime integration: post privacy and block checks gate interactions', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimePostsHarness();

  try {
    const token = uniqueToken();
    const owner = await harness.createActiveUser({
      handle: `posts_owner_${token}`,
      email: `posts_owner_${token}@rmwhs.com`,
      displayName: 'Posts Owner',
    });
    const viewer = await harness.createActiveUser({
      handle: `posts_other_${token}`,
      email: `posts_other_${token}@rmwhs.com`,
      displayName: 'Posts Other',
    });

    const followersPost = await harness.handler.createOrSchedule(owner.id, {
      contentText: 'Followers-only runtime post',
      visibility: 'followers',
    });
    assert.ok(followersPost);

    const blockedLike = await harness.handler.like(viewer.id, { postId: followersPost!.postId });
    assert.equal(blockedLike.updated, false);

    await harness.setFollowAccepted({
      followerId: viewer.id,
      followingId: owner.id,
    });

    const followedLike = await harness.handler.like(viewer.id, { postId: followersPost!.postId });
    assert.equal(followedLike.updated, true);

    await harness.setBlock({
      blockerId: owner.id,
      blockedId: viewer.id,
    });

    const blockedReply = await harness.handler.createReply(viewer.id, {
      parentPostId: followersPost!.postId,
      contentText: 'Should be blocked',
    });
    assert.equal(blockedReply, null);
  } finally {
    await destroyRuntimePostsHarness(harness);
  }
});
