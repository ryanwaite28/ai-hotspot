import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  createRuntimeMediaHarness,
  destroyRuntimeMediaHarness,
} from './media.runtime.integration.harness';

function hasRuntimeDeps(): boolean {
  const phaseEnabled = process.env.PHASE4_RUNTIME_INTEGRATION === '1' || process.env.PHASE3_RUNTIME_INTEGRATION === '1';
  return phaseEnabled && typeof process.env.POSTGRES_URL === 'string' && process.env.POSTGRES_URL.length > 0;
}

function uniqueToken(): string {
  return crypto.randomUUID().slice(0, 8);
}

test('runtime integration: media upload session and processing status emit outbox events', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimeMediaHarness();

  try {
    const token = uniqueToken();
    const author = await harness.createActiveUser({
      handle: `media_author_${token}`,
      email: `media_author_${token}@rmwhs.com`,
      displayName: 'Media Author',
    });

    const created = await harness.service.createUploadSession({
      actorUserId: author.id,
      mediaKind: 'photo',
      mimeType: 'image/jpeg',
      fileSizeBytes: 150_000,
      caption: 'Runtime media caption',
      altText: 'Runtime media alt text',
      allowRemix: true,
    });

    assert.ok(created);
    assert.equal(created?.mediaAsset.processingStatus, 'uploading');

    const processing = await harness.service.completeUploadSession({
      uploadSessionId: created!.uploadSession.uploadSessionId,
      source: 'object_storage_callback',
    });
    assert.equal(processing?.processingStatus, 'processing');

    const ready = await harness.service.updateProcessingStatus({
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      processingStatus: 'ready',
      eventSource: 'worker',
    });
    assert.equal(ready?.processingStatus, 'ready');

    const eventTypes = await harness.listOutboxEventTypesForMedia(created!.mediaAsset.mediaAssetId);
    assert.ok(eventTypes.includes('media.created'));
    assert.ok(eventTypes.includes('media.uploaded'));
    assert.ok(eventTypes.includes('media.processing.requested'));
    assert.ok(eventTypes.includes('media.ready'));
  } finally {
    await destroyRuntimeMediaHarness(harness);
  }
});

test('runtime integration: media comments are ready-gated and outbox-backed', { skip: !hasRuntimeDeps() }, async () => {
  const harness = await createRuntimeMediaHarness();

  try {
    const token = uniqueToken();
    const author = await harness.createActiveUser({
      handle: `media_owner_${token}`,
      email: `media_owner_${token}@rmwhs.com`,
      displayName: 'Media Owner',
    });
    const commenter = await harness.createActiveUser({
      handle: `media_commenter_${token}`,
      email: `media_commenter_${token}@rmwhs.com`,
      displayName: 'Media Commenter',
    });

    const created = await harness.service.createUploadSession({
      actorUserId: author.id,
      mediaKind: 'video',
      mimeType: 'video/mp4',
      fileSizeBytes: 600_000,
    });
    assert.ok(created);

    const blockedComment = await harness.service.createComment({
      actorUserId: commenter.id,
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      bodyText: 'Blocked until ready',
    });
    assert.equal(blockedComment, null);

    await harness.service.completeUploadSession({
      uploadSessionId: created!.uploadSession.uploadSessionId,
      source: 'object_storage_callback',
    });
    await harness.service.updateProcessingStatus({
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      processingStatus: 'ready',
      eventSource: 'worker',
    });

    const rootComment = await harness.service.createComment({
      actorUserId: commenter.id,
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      bodyText: 'Root comment',
    });
    assert.ok(rootComment);

    const replyComment = await harness.service.createComment({
      actorUserId: author.id,
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      parentCommentId: rootComment!.commentId,
      bodyText: 'Reply comment',
    });
    assert.ok(replyComment);

    const comments = await harness.service.listComments(created!.mediaAsset.mediaAssetId, 20);
    assert.equal(comments.length, 2);

    const eventTypes = await harness.listOutboxEventTypesForMedia(created!.mediaAsset.mediaAssetId);
    assert.ok(eventTypes.includes('media.comment.created'));
  } finally {
    await destroyRuntimeMediaHarness(harness);
  }
});
