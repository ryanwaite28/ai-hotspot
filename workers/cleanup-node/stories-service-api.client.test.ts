import assert from 'node:assert/strict';
import test from 'node:test';

import { StoriesServiceApiClient } from './stories-service-api.client';

test('StoriesServiceApiClient posts expire request to stories API', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init,
    });
    return new Response(JSON.stringify({
      expiredCount: 3,
      storyIds: ['s1', 's2', 's3'],
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  }) as typeof fetch;

  try {
    const client = new StoriesServiceApiClient({
      baseUrl: 'http://api.hotspot.local',
      authToken: 'cleanup-token',
    });

    const result = await client.expireStoriesByWorker({
      limit: 200,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://api.hotspot.local/internal/v1/stories/expire');
    assert.equal(calls[0].init?.method, 'POST');

    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer cleanup-token');

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.eventSource, 'worker');
    assert.equal(body.limit, 200);

    assert.equal(result.expiredCount, 3);
    assert.equal(result.storyIds.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('StoriesServiceApiClient throws on API failures', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response('denied', {
    status: 403,
  })) as typeof fetch;

  try {
    const client = new StoriesServiceApiClient({
      baseUrl: 'http://api.hotspot.local',
    });

    await assert.rejects(
      () => client.expireStoriesByWorker(),
      /Stories API expireStories failed with 403/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
