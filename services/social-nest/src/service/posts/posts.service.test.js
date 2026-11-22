const assert = require('node:assert/strict');
const test = require('node:test');

const { PostsService } = require('./posts.service');

test('PostsService supports draft/publish/schedule/edit/delete/pin workflows', async () => {
  const stored = new Map();

  const repo = {
    async createPost(input) {
      const id = `post-${stored.size + 1}`;
      const now = new Date().toISOString();
      const row = {
        postId: id,
        authorUserId: input.authorUserId,
        parentPostId: input.parentPostId,
        threadRootPostId: input.threadRootPostId,
        repostOfPostId: input.repostOfPostId,
        quoteOfPostId: input.quoteOfPostId,
        contentText: input.contentText,
        likeCount: 0,
        bookmarkCount: 0,
        shareCount: 0,
        status: input.status,
        visibility: input.visibility,
        pinnedAt: null,
        scheduledFor: input.status === 'scheduled' ? new Date(input.publishAtEpochSeconds * 1000).toISOString() : null,
        publishedAt: input.status === 'published' ? new Date(input.publishAtEpochSeconds * 1000).toISOString() : null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      stored.set(id, row);
      return row;
    },
    async updatePost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        contentText: input.contentText ?? existing.contentText,
        visibility: input.visibility ?? existing.visibility,
        updatedAt: new Date().toISOString(),
      };
      stored.set(input.postId, updated);
      return updated;
    },
    async deletePost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const deleted = {
        ...existing,
        status: 'deleted',
        deletedAt: new Date().toISOString(),
      };
      stored.set(input.postId, deleted);
      return deleted;
    },
    async setPinned(input) {
      const existing = stored.get(input.postId);
      if (!existing || existing.status !== 'published') {
        return null;
      }
      const pinned = {
        ...existing,
        pinnedAt: input.pinned ? new Date().toISOString() : null,
      };
      stored.set(input.postId, pinned);
      return pinned;
    },
    async getPostByIdForAuthor(input) {
      const existing = stored.get(input.postId);
      if (!existing || existing.authorUserId !== input.authorUserId) {
        return null;
      }
      return existing;
    },
    async getPostById(postId) {
      return stored.get(postId) ?? null;
    },
    async getRelationshipState() {
      return {
        is_following: false,
        is_blocked: false,
      };
    },
    async likePost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        likeCount: existing.likeCount + 1,
        updatedAt: new Date().toISOString(),
      };
      stored.set(input.postId, updated);
      return updated;
    },
    async unlikePost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        likeCount: Math.max(existing.likeCount - 1, 0),
        updatedAt: new Date().toISOString(),
      };
      stored.set(input.postId, updated);
      return updated;
    },
    async bookmarkPost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        bookmarkCount: existing.bookmarkCount + 1,
        shareCount: existing.shareCount + 1,
        updatedAt: new Date().toISOString(),
      };
      stored.set(input.postId, updated);
      return updated;
    },
    async unbookmarkPost(input) {
      const existing = stored.get(input.postId);
      if (!existing) {
        return null;
      }
      const updated = {
        ...existing,
        bookmarkCount: Math.max(existing.bookmarkCount - 1, 0),
        shareCount: Math.max(existing.shareCount - 1, 0),
        updatedAt: new Date().toISOString(),
      };
      stored.set(input.postId, updated);
      return updated;
    },
    async listFollowingFeedPage() { return []; },
    async listPublicFeedPage() { return []; },
    async listTopicFeedPage() { return []; },
  };

  const service = new PostsService(repo);

  const draft = await service.createDraft({
    authorUserId: 'user-1',
    contentText: ' Draft value ',
    visibility: 'followers',
  });
  assert.equal(draft?.status, 'draft');

  const published = await service.createOrSchedulePost({
    authorUserId: 'user-1',
    contentText: 'Published value',
    visibility: 'public',
  });
  assert.equal(published?.status, 'published');

  const futureIso = new Date(Date.now() + 60_000).toISOString();
  const scheduled = await service.createOrSchedulePost({
    authorUserId: 'user-1',
    contentText: 'Scheduled value',
    publishAtIso: futureIso,
  });
  assert.equal(scheduled?.status, 'scheduled');

  const updated = await service.updatePost({
    authorUserId: 'user-1',
    postId: published.postId,
    contentText: 'Published value updated',
  });
  assert.equal(updated?.contentText, 'Published value updated');

  const pinned = await service.pinPost({
    authorUserId: 'user-1',
    postId: published.postId,
    pinned: true,
  });
  assert.ok(pinned?.pinnedAt);

  const deleted = await service.deletePost({
    authorUserId: 'user-1',
    postId: draft.postId,
  });
  assert.equal(deleted.deleted, true);

  const reply = await service.createReply({
    authorUserId: 'user-2',
    parentPostId: published.postId,
    contentText: 'Reply value',
  });
  assert.equal(reply?.status, 'published');
  assert.equal(reply?.parentPostId, published.postId);
  assert.equal(reply?.threadRootPostId, published.postId);

  const repost = await service.createRepost({
    authorUserId: 'user-3',
    repostOfPostId: published.postId,
  });
  assert.equal(repost?.status, 'published');
  assert.equal(repost?.repostOfPostId, published.postId);
  assert.equal(repost?.contentText, '');

  const quote = await service.createQuote({
    authorUserId: 'user-4',
    quoteOfPostId: published.postId,
    contentText: 'quote text',
  });
  assert.equal(quote?.status, 'published');
  assert.equal(quote?.quoteOfPostId, published.postId);
  assert.equal(quote?.contentText, 'quote text');

  const like = await service.likePost({
    actorUserId: 'user-4',
    postId: published.postId,
  });
  assert.equal(like.updated, true);
  assert.equal(like.post?.likeCount, 1);

  const unlike = await service.unlikePost({
    actorUserId: 'user-4',
    postId: published.postId,
  });
  assert.equal(unlike.updated, true);
  assert.equal(unlike.post?.likeCount, 0);

  const bookmark = await service.bookmarkPost({
    actorUserId: 'user-4',
    postId: published.postId,
  });
  assert.equal(bookmark.updated, true);
  assert.equal(bookmark.post?.bookmarkCount, 1);
  assert.equal(bookmark.post?.shareCount, 1);

  const unbookmark = await service.unbookmarkPost({
    actorUserId: 'user-4',
    postId: published.postId,
  });
  assert.equal(unbookmark.updated, true);
  assert.equal(unbookmark.post?.bookmarkCount, 0);
  assert.equal(unbookmark.post?.shareCount, 0);
});

test('PostsService validates content text', async () => {
  const repo = {
    async createPost() { return null; },
    async updatePost() { return null; },
    async deletePost() { return null; },
    async setPinned() { return null; },
    async getPostByIdForAuthor() { return null; },
    async getPostById() { return null; },
    async getRelationshipState() {
      return {
        is_following: false,
        is_blocked: false,
      };
    },
    async likePost() { return null; },
    async unlikePost() { return null; },
    async bookmarkPost() { return null; },
    async unbookmarkPost() { return null; },
    async listFollowingFeedPage() { return []; },
    async listPublicFeedPage() { return []; },
    async listTopicFeedPage() { return []; },
  };

  const service = new PostsService(repo);

  await assert.rejects(
    () => service.createDraft({
      authorUserId: 'user-1',
      contentText: '   ',
    }),
    /Post content is required/,
  );

  const missingParentReply = await service.createReply({
    authorUserId: 'user-1',
    parentPostId: 'missing-post',
    contentText: 'Reply',
  });
  assert.equal(missingParentReply, null);

  const missingRepost = await service.createRepost({
    authorUserId: 'user-1',
    repostOfPostId: 'missing-post',
  });
  assert.equal(missingRepost, null);

  const missingQuote = await service.createQuote({
    authorUserId: 'user-1',
    quoteOfPostId: 'missing-post',
    contentText: 'quote',
  });
  assert.equal(missingQuote, null);

  const missingLike = await service.likePost({
    actorUserId: 'user-1',
    postId: 'missing-post',
  });
  assert.equal(missingLike.updated, false);
  assert.equal(missingLike.post, null);

  const missingBookmark = await service.bookmarkPost({
    actorUserId: 'user-1',
    postId: 'missing-post',
  });
  assert.equal(missingBookmark.updated, false);
  assert.equal(missingBookmark.post, null);
});

test('PostsService enforces post visibility and block checks on interactions', async () => {
  const sourcePost = {
    postId: 'post-private',
    authorUserId: 'author-1',
    parentPostId: null,
    threadRootPostId: null,
    repostOfPostId: null,
    quoteOfPostId: null,
    contentText: 'Private post',
    likeCount: 0,
    bookmarkCount: 0,
    shareCount: 0,
    status: 'published',
    visibility: 'private',
    pinnedAt: null,
    scheduledFor: null,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const repo = {
    async createPost() { return null; },
    async updatePost() { return null; },
    async deletePost() { return null; },
    async setPinned() { return null; },
    async getPostByIdForAuthor() { return null; },
    async getPostById(postId) {
      return postId === sourcePost.postId ? sourcePost : null;
    },
    async getRelationshipState() {
      return {
        is_following: false,
        is_blocked: true,
      };
    },
    async likePost() { return sourcePost; },
    async unlikePost() { return sourcePost; },
    async bookmarkPost() { return sourcePost; },
    async unbookmarkPost() { return sourcePost; },
    async listFollowingFeedPage() { return []; },
    async listPublicFeedPage() { return []; },
    async listTopicFeedPage() { return []; },
  };

  const service = new PostsService(repo);

  const blockedReply = await service.createReply({
    authorUserId: 'viewer-1',
    parentPostId: sourcePost.postId,
    contentText: 'reply',
  });
  assert.equal(blockedReply, null);

  const blockedRepost = await service.createRepost({
    authorUserId: 'viewer-1',
    repostOfPostId: sourcePost.postId,
  });
  assert.equal(blockedRepost, null);

  const blockedQuote = await service.createQuote({
    authorUserId: 'viewer-1',
    quoteOfPostId: sourcePost.postId,
    contentText: 'quote',
  });
  assert.equal(blockedQuote, null);

  const blockedLike = await service.likePost({
    actorUserId: 'viewer-1',
    postId: sourcePost.postId,
  });
  assert.equal(blockedLike.updated, false);
  assert.equal(blockedLike.post, null);
});

test('PostsService returns chronological following/public/topic feeds with cursor pagination', async () => {
  const feedRows = [
    {
      postId: 'post-3',
      authorUserId: 'author-3',
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText: 'Third #news',
      likeCount: 3,
      bookmarkCount: 2,
      shareCount: 2,
      status: 'published',
      visibility: 'public',
      pinnedAt: null,
      scheduledFor: null,
      publishedAt: '2026-11-19T12:03:00.000Z',
      createdAt: '2026-11-19T12:03:00.000Z',
      updatedAt: '2026-11-19T12:03:00.000Z',
      deletedAt: null,
    },
    {
      postId: 'post-2',
      authorUserId: 'author-2',
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText: 'Second #news',
      likeCount: 2,
      bookmarkCount: 1,
      shareCount: 1,
      status: 'published',
      visibility: 'public',
      pinnedAt: null,
      scheduledFor: null,
      publishedAt: '2026-11-19T12:02:00.000Z',
      createdAt: '2026-11-19T12:02:00.000Z',
      updatedAt: '2026-11-19T12:02:00.000Z',
      deletedAt: null,
    },
    {
      postId: 'post-1',
      authorUserId: 'author-1',
      parentPostId: null,
      threadRootPostId: null,
      repostOfPostId: null,
      quoteOfPostId: null,
      contentText: 'First #news',
      likeCount: 1,
      bookmarkCount: 0,
      shareCount: 0,
      status: 'published',
      visibility: 'public',
      pinnedAt: null,
      scheduledFor: null,
      publishedAt: '2026-11-19T12:01:00.000Z',
      createdAt: '2026-11-19T12:01:00.000Z',
      updatedAt: '2026-11-19T12:01:00.000Z',
      deletedAt: null,
    },
  ];

  const repo = {
    async createPost() { return null; },
    async updatePost() { return null; },
    async deletePost() { return null; },
    async setPinned() { return null; },
    async getPostByIdForAuthor() { return null; },
    async getPostById() { return null; },
    async getRelationshipState() {
      return {
        is_following: false,
        is_blocked: false,
      };
    },
    async likePost() { return null; },
    async unlikePost() { return null; },
    async bookmarkPost() { return null; },
    async unbookmarkPost() { return null; },
    async listFollowingFeedPage(input) {
      assert.equal(input.viewerUserId, 'viewer-1');
      assert.equal(input.limitPlusOne, 3);
      return input.cursorPublishedAt ? [feedRows[2]] : feedRows;
    },
    async listPublicFeedPage(input) {
      assert.equal(input.limitPlusOne, 3);
      return feedRows;
    },
    async listTopicFeedPage(input) {
      assert.equal(input.topic, 'news');
      assert.equal(input.limitPlusOne, 3);
      return feedRows;
    },
  };

  const service = new PostsService(repo);

  const followingPage1 = await service.listFollowingFeed({
    viewerUserId: 'viewer-1',
    limit: 2,
  });
  assert.equal(followingPage1.items.length, 2);
  assert.ok(followingPage1.nextCursor);

  const followingPage2 = await service.listFollowingFeed({
    viewerUserId: 'viewer-1',
    limit: 2,
    cursor: followingPage1.nextCursor,
  });
  assert.equal(followingPage2.items.length, 1);
  assert.equal(followingPage2.nextCursor, null);

  const publicPage = await service.listPublicFeed({
    limit: 2,
  });
  assert.equal(publicPage.items.length, 2);
  assert.ok(publicPage.nextCursor);

  const topicPage = await service.listTopicFeed({
    topic: '#News',
    limit: 2,
  });
  assert.equal(topicPage.items.length, 2);
  assert.ok(topicPage.nextCursor);

  await assert.rejects(
    () => service.listFollowingFeed({
      viewerUserId: 'viewer-1',
      cursor: 'not-valid-base64',
    }),
    /Invalid feed cursor/,
  );

  await assert.rejects(
    () => service.listTopicFeed({
      topic: '   ',
    }),
    /Topic is required/,
  );
});
