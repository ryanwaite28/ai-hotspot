import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMediaWorker } from './bootstrap';

test('buildMediaWorker wires router and delegates startConsumer with router', async () => {
  const serviceCalls: Array<{ mediaAssetId: string; processingStatus: string; eventSource: string }> = [];

  const worker = buildMediaWorker({
    mediaServiceClient: {
      async updateProcessingStatus(input: { mediaAssetId: string; processingStatus: 'ready'; eventSource: 'worker' }) {
        serviceCalls.push(input);
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
    },
  });

  let closed = false;

  const runtime = await worker.startConsumer({
    amqpUrl: 'amqp://example',
    clientFactory: () => ({
      forQueue() {
        return {
          subscribe() {
            return {
              unsubscribe() {},
            };
          },
        };
      },
      async close() {
        closed = true;
      },
    }),
  });

  const handled = await worker.router.handle({
    eventId: 'evt-media-10',
    eventType: 'media.processing.requested',
    aggregateType: 'media_asset',
    aggregateId: 'media-10',
    aggregateVersion: null,
    occurredAt: new Date().toISOString(),
    payload: {},
    headers: { schemaVersion: 1, producer: 'test' },
  });

  assert.equal(handled, true);
  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].mediaAssetId, 'media-10');

  await runtime.close();
  assert.equal(closed, true);
});
