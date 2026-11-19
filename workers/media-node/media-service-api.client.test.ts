import assert from 'node:assert/strict';
import test from 'node:test';

import { MediaServiceApiClient } from './media-service-api.client';

test('MediaServiceApiClient posts processing status updates to API', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response('', { status: 200 });
  }) as typeof fetch;

  try {
    const client = new MediaServiceApiClient({
      baseUrl: 'http://api.hotspot.local',
      authToken: 'worker-token',
    });

    await client.updateProcessingStatus({
      mediaAssetId: 'media-abc',
      processingStatus: 'ready',
      eventSource: 'worker',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://api.hotspot.local/internal/v1/media/media-abc/processing-status');
    assert.equal(calls[0].init?.method, 'POST');

    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer worker-token');

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.processingStatus, 'ready');
    assert.equal(body.eventSource, 'worker');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('MediaServiceApiClient throws on API failures', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response('forbidden', { status: 403 })) as typeof fetch;

  try {
    const client = new MediaServiceApiClient({
      baseUrl: 'http://api.hotspot.local',
    });

    await assert.rejects(
      () => client.updateProcessingStatus({
        mediaAssetId: 'media-xyz',
        processingStatus: 'ready',
        eventSource: 'worker',
      }),
      /Media API updateProcessingStatus failed with 403/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
