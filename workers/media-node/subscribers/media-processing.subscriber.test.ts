import assert from 'node:assert/strict';
import test from 'node:test';

import { MediaProcessingRequestedSubscriber } from './media-processing.subscriber';

test('MediaProcessingRequestedSubscriber marks media ready for processing-requested events', async () => {
  const calls: Array<{ mediaAssetId: string; processingStatus: string; eventSource: string }> = [];

  const service = {
    async updateProcessingStatus(input: { mediaAssetId: string; processingStatus: 'ready'; eventSource: 'worker' }) {
      calls.push(input);
      return {
        mediaAssetId: input.mediaAssetId,
        ownerUserId: 'owner-1',
        mediaKind: 'video' as const,
        mimeType: 'video/mp4',
        objectKey: 'media/key.mp4',
        processingStatus: 'ready' as const,
        visibility: 'public' as const,
        caption: null,
        altText: null,
        allowRemix: false,
        sourceMediaAssetId: null,
        readyAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  };

  const subscriber = new MediaProcessingRequestedSubscriber(service);

  await subscriber.handle({
    eventId: 'evt-1',
    eventType: 'media.processing.requested',
    aggregateType: 'media_asset',
    aggregateId: 'media-asset-1',
    aggregateVersion: null,
    occurredAt: new Date().toISOString(),
    payload: {
      mediaAssetId: 'media-asset-1',
      ownerUserId: 'owner-1',
      processingStatus: 'processing',
    },
    headers: {
      schemaVersion: 1,
      producer: 'test',
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mediaAssetId, 'media-asset-1');
  assert.equal(calls[0].processingStatus, 'ready');
  assert.equal(calls[0].eventSource, 'worker');
});

test('MediaProcessingRequestedSubscriber ignores unrelated events', async () => {
  let callCount = 0;

  const service = {
    async updateProcessingStatus() {
      callCount += 1;
      return null;
    },
  };

  const subscriber = new MediaProcessingRequestedSubscriber(service);

  await subscriber.handle({
    eventId: 'evt-2',
    eventType: 'media.uploaded',
    aggregateType: 'media_asset',
    aggregateId: 'media-asset-2',
    aggregateVersion: null,
    occurredAt: new Date().toISOString(),
    payload: {
      mediaAssetId: 'media-asset-2',
      ownerUserId: 'owner-2',
      processingStatus: 'uploaded',
    },
    headers: {
      schemaVersion: 1,
      producer: 'test',
    },
  });

  assert.equal(callCount, 0);
});
