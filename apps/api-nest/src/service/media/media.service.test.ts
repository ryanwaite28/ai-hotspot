import assert from 'node:assert/strict';
import test from 'node:test';

import { MediaService, type MediaMetadataPort, type MediaStoragePort } from './media.service';

function createServiceHarness() {
  const mediaAssets = new Map<string, {
    mediaAssetId: string;
    ownerUserId: string;
    mediaKind: 'photo' | 'video';
    mimeType: string;
    objectKey: string;
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    visibility: 'public' | 'followers' | 'private';
    caption: string | null;
    altText: string | null;
    allowRemix: boolean;
    sourceMediaAssetId: string | null;
    readyAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>();

  const comments: {
    commentId: string;
    mediaAssetId: string;
    parentCommentId: string | null;
    authorUserId: string;
    bodyText: string;
    status: 'published' | 'deleted';
    createdAt: string;
    deletedAt: string | null;
  }[] = [];

  const repository = {
    async createUploadSessionWithAssetDraft(input: {
      ownerUserId: string;
      provider: string;
      uploadUrl: string;
      objectKey: string;
      mimeType: string;
      fileSizeBytes: number;
      chunkSizeBytes: number;
      expiresAtEpochSeconds: number;
      mediaKind: 'photo' | 'video';
      visibility: 'public' | 'followers' | 'private';
      caption: string | null;
      altText: string | null;
      allowRemix: boolean;
      eventId: string;
      occurredAtEpochSeconds: number;
    }) {
      const mediaAssetId = `media-${mediaAssets.size + 1}`;
      const now = new Date().toISOString();
      const asset = {
        mediaAssetId,
        ownerUserId: input.ownerUserId,
        mediaKind: input.mediaKind,
        mimeType: input.mimeType,
        objectKey: input.objectKey,
        processingStatus: 'uploading' as const,
        visibility: input.visibility,
        caption: input.caption,
        altText: input.altText,
        allowRemix: input.allowRemix,
        sourceMediaAssetId: null,
        readyAt: null,
        createdAt: now,
        updatedAt: now,
      };
      mediaAssets.set(mediaAssetId, asset);

      return {
        uploadSession: {
          uploadSessionId: `upload-${mediaAssets.size}`,
          mediaAssetId,
          provider: input.provider,
          uploadUrl: input.uploadUrl,
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          chunkSizeBytes: input.chunkSizeBytes,
          status: 'created' as const,
          expiresAt: new Date(input.expiresAtEpochSeconds * 1000).toISOString(),
          createdAt: now,
        },
        mediaAsset: asset,
      };
    },
    async addCarouselItem() {
      return;
    },
    async getMediaAssetById(mediaAssetId: string) {
      return mediaAssets.get(mediaAssetId) ?? null;
    },
    async getMediaAssetByUploadSessionId(uploadSessionId: string) {
      for (const asset of mediaAssets.values()) {
        const expectedSessionId = `upload-${asset.mediaAssetId.split('-')[1]}`;
        if (expectedSessionId === uploadSessionId) {
          return asset;
        }
      }
      return null;
    },
    async completeUploadSessionAndGetAsset(uploadSessionId: string) {
      return this.getMediaAssetByUploadSessionId(uploadSessionId);
    },
    async setMediaProcessingStatus(input: {
      mediaAssetId: string;
      processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
      eventId: string;
      occurredAtEpochSeconds: number;
    }) {
      const existing = mediaAssets.get(input.mediaAssetId);
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        processingStatus: input.processingStatus,
        readyAt: input.processingStatus === 'ready' ? new Date().toISOString() : existing.readyAt,
        updatedAt: new Date().toISOString(),
      };

      mediaAssets.set(input.mediaAssetId, updated);
      return updated;
    },
    async createMediaComment(input: {
      mediaAssetId: string;
      parentCommentId: string | null;
      authorUserId: string;
      bodyText: string;
      eventId: string;
      occurredAtEpochSeconds: number;
    }) {
      if (!mediaAssets.has(input.mediaAssetId)) {
        return null;
      }

      const comment = {
        commentId: `comment-${comments.length + 1}`,
        mediaAssetId: input.mediaAssetId,
        parentCommentId: input.parentCommentId,
        authorUserId: input.authorUserId,
        bodyText: input.bodyText,
        status: 'published' as const,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      };
      comments.push(comment);
      return comment;
    },
    async listMediaComments(input: {
      mediaAssetId: string;
      limit: number;
    }) {
      return comments
        .filter((comment) => comment.mediaAssetId === input.mediaAssetId)
        .slice(0, input.limit);
    },
  };

  const storage: MediaStoragePort = {
    async createResumableUploadSession(input: {
      objectKey: string;
      mimeType: string;
      fileSizeBytes: number;
      expiresInSeconds: number;
    }) {
      return {
        provider: 'minio',
        uploadUrl: `http://minio.local/${encodeURIComponent(input.objectKey)}`,
        expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + input.expiresInSeconds,
      };
    },
  };

  const metadataEvents: string[] = [];
  const derivativeContracts: Array<{
    mediaAssetId: string;
    processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
    immutableKeyVersion: string;
    derivatives: Array<{
      derivativeId: string;
      derivativeType: 'thumbnail' | 'transcode';
      objectKey: string;
      mimeType: string;
      cacheControl: string;
      immutable: boolean;
    }>;
  }> = [];

  const metadata: MediaMetadataPort = {
    async upsertMediaAssetMetadata(input: {
      mediaAssetId: string;
      ownerUserId: string;
      mediaKind: 'photo' | 'video';
      processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
      objectKey: string;
      mimeType: string;
      visibility: 'public' | 'followers' | 'private';
      caption: string | null;
      altText: string | null;
      allowRemix: boolean;
      carouselAssetIds: string[];
    }) {
      metadataEvents.push(`asset:${input.mediaAssetId}:${input.processingStatus}`);
    },
    async recordMediaComment(input: {
      commentId: string;
      mediaAssetId: string;
      authorUserId: string;
      parentCommentId: string | null;
    }) {
      metadataEvents.push(`comment:${input.commentId}:${input.mediaAssetId}`);
    },
    async upsertMediaDerivatives(input: {
      mediaAssetId: string;
      processingStatus: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'rejected';
      immutableKeyVersion: string;
      derivatives: Array<{
        derivativeId: string;
        derivativeType: 'thumbnail' | 'transcode';
        objectKey: string;
        mimeType: string;
        cacheControl: string;
        immutable: boolean;
      }>;
    }) {
      derivativeContracts.push(input);
    },
  };

  const service = new MediaService(repository, storage, metadata);

  return {
    service,
    metadataEvents,
    derivativeContracts,
  };
}

test('MediaService creates upload session with validation and metadata sync', async () => {
  const harness = createServiceHarness();

  const created = await harness.service.createUploadSession({
    actorUserId: 'user-1',
    mediaKind: 'photo',
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    caption: ' Sunset ',
    altText: ' A sunset over the lake ',
    allowRemix: true,
    carouselAssetIds: ['asset-a', 'asset-b'],
  });

  assert.ok(created);
  assert.equal(created?.mediaAsset.processingStatus, 'uploading');
  assert.equal(created?.mediaAsset.caption, 'Sunset');
  assert.equal(created?.mediaAsset.altText, 'A sunset over the lake');
  assert.ok(created?.uploadSession.uploadUrl.includes('http://minio.local/'));
  assert.ok(harness.metadataEvents.some((event) => event.startsWith('asset:')));
});

test('MediaService enforces processing transitions and ready-gated comments', async () => {
  const harness = createServiceHarness();

  const created = await harness.service.createUploadSession({
    actorUserId: 'user-2',
    mediaKind: 'video',
    mimeType: 'video/mp4',
    fileSizeBytes: 2048,
  });
  assert.ok(created);

  const uploadComment = await harness.service.createComment({
    actorUserId: 'user-3',
    mediaAssetId: created!.mediaAsset.mediaAssetId,
    bodyText: 'should not work yet',
  });
  assert.equal(uploadComment, null);

  const uploaded = await harness.service.updateProcessingStatus({
    mediaAssetId: created!.mediaAsset.mediaAssetId,
    processingStatus: 'uploaded',
    eventSource: 'api',
  });
  assert.equal(uploaded?.processingStatus, 'uploaded');

  const processing = await harness.service.updateProcessingStatus({
    mediaAssetId: created!.mediaAsset.mediaAssetId,
    processingStatus: 'processing',
    eventSource: 'worker',
  });
  assert.equal(processing?.processingStatus, 'processing');

  const ready = await harness.service.updateProcessingStatus({
    mediaAssetId: created!.mediaAsset.mediaAssetId,
    processingStatus: 'ready',
    eventSource: 'worker',
  });
  assert.equal(ready?.processingStatus, 'ready');
  assert.equal(harness.derivativeContracts.length, 1);
  assert.equal(harness.derivativeContracts[0].immutableKeyVersion, 'v1');
  assert.ok(harness.derivativeContracts[0].derivatives.length >= 2);
  assert.ok(harness.derivativeContracts[0].derivatives.every((derivative) => derivative.cacheControl.includes('immutable')));

  const comment = await harness.service.createComment({
    actorUserId: 'user-3',
    mediaAssetId: created!.mediaAsset.mediaAssetId,
    bodyText: ' Great upload ',
  });
  assert.ok(comment);
  assert.equal(comment?.bodyText, 'Great upload');

  const comments = await harness.service.listComments(created!.mediaAsset.mediaAssetId, 10);
  assert.equal(comments.length, 1);
  assert.ok(harness.metadataEvents.some((event) => event.startsWith('comment:')));

  await assert.rejects(
    () => harness.service.updateProcessingStatus({
      mediaAssetId: created!.mediaAsset.mediaAssetId,
      processingStatus: 'processing',
      eventSource: 'worker',
    }),
    /Invalid media processing status transition/,
  );
});

test('MediaService rejects unsupported MIME and oversized uploads', async () => {
  const harness = createServiceHarness();

  await assert.rejects(
    () => harness.service.createUploadSession({
      actorUserId: 'user-x',
      mediaKind: 'photo',
      mimeType: 'application/pdf',
      fileSizeBytes: 512,
    }),
    /Unsupported photo MIME type/,
  );

  await assert.rejects(
    () => harness.service.createUploadSession({
      actorUserId: 'user-x',
      mediaKind: 'video',
      mimeType: 'video/mp4',
      fileSizeBytes: 1024 * 1024 * 1024,
    }),
    /File exceeds maximum configured size/,
  );
});

test('MediaService upload completion moves uploading asset into processing pipeline', async () => {
  const harness = createServiceHarness();

  const created = await harness.service.createUploadSession({
    actorUserId: 'user-44',
    mediaKind: 'photo',
    mimeType: 'image/png',
    fileSizeBytes: 1024,
  });
  assert.ok(created);

  const completed = await harness.service.completeUploadSession({
    uploadSessionId: created!.uploadSession.uploadSessionId,
    source: 'object_storage_callback',
  });

  assert.ok(completed);
  assert.equal(completed?.processingStatus, 'processing');
  assert.ok(
    harness.metadataEvents.some((event) => event.includes(':uploaded')),
  );
  assert.ok(
    harness.metadataEvents.some((event) => event.includes(':processing')),
  );
});
