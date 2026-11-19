import type { ExpireStoriesResult } from '../../packages/contracts/src';

export interface StoriesCleanupClient {
  expireStoriesByWorker(input?: { limit?: number }): Promise<ExpireStoriesResult>;
}

export interface CleanupWorkerDependencies {
  storiesCleanupClient: StoriesCleanupClient;
}

export interface CleanupWorker {
  runCleanupTick(input?: { limit?: number }): Promise<ExpireStoriesResult>;
}

export function buildCleanupWorker(dependencies: CleanupWorkerDependencies): CleanupWorker {
  return {
    runCleanupTick: (input) => dependencies.storiesCleanupClient.expireStoriesByWorker(input),
  };
}
