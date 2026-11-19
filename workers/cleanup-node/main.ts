import { buildCleanupWorker } from './bootstrap';
import { StoriesServiceApiClient } from './stories-service-api.client';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('cleanup worker numeric environment values must be positive integers');
  }

  return parsed;
}

async function main(): Promise<void> {
  const storiesApiBaseUrl = process.env.STORIES_API_BASE_URL;
  if (!storiesApiBaseUrl) {
    throw new Error('STORIES_API_BASE_URL is required');
  }

  const intervalSeconds = parsePositiveInteger(process.env.STORY_CLEANUP_INTERVAL_SECONDS, 30);
  const expireLimit = parsePositiveInteger(process.env.STORY_CLEANUP_LIMIT, 200);

  const storiesClient = new StoriesServiceApiClient({
    baseUrl: storiesApiBaseUrl,
    authToken: process.env.STORIES_API_TOKEN,
    expirePath: process.env.STORIES_API_EXPIRE_PATH,
  });

  const worker = buildCleanupWorker({
    storiesCleanupClient: storiesClient,
  });

  let isTickRunning = false;
  const runTick = async (): Promise<void> => {
    if (isTickRunning) {
      return;
    }

    isTickRunning = true;
    try {
      const result = await worker.runCleanupTick({
        limit: expireLimit,
      });
      console.log('story cleanup tick completed', {
        expiredCount: result.expiredCount,
      });
    } catch (error) {
      console.error('story cleanup tick failed', error);
    } finally {
      isTickRunning = false;
    }
  };

  await runTick();

  const timer = setInterval(() => {
    void runTick();
  }, intervalSeconds * 1000);

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
  };

  process.on('SIGINT', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('cleanup worker shutdown failed', error);
        process.exit(1);
      });
  });

  process.on('SIGTERM', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('cleanup worker shutdown failed', error);
        process.exit(1);
      });
  });
}

main().catch((error) => {
  console.error('cleanup worker failed', error);
  process.exit(1);
});
