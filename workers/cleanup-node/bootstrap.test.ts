import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCleanupWorker } from './bootstrap';

test('buildCleanupWorker delegates cleanup tick to stories cleanup client', async () => {
  const calls: Array<{ limit?: number }> = [];

  const worker = buildCleanupWorker({
    storiesCleanupClient: {
      async expireStoriesByWorker(input) {
        calls.push({ limit: input?.limit });
        return {
          expiredCount: 2,
          storyIds: ['story-1', 'story-2'],
        };
      },
    },
  });

  const result = await worker.runCleanupTick({
    limit: 300,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].limit, 300);
  assert.equal(result.expiredCount, 2);
  assert.equal(result.storyIds.length, 2);
});
