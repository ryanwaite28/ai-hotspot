export interface OutboxPublishBatchResult {
  fetched: number;
  published: number;
  failed: number;
  failedEventIds: string[];
}

export interface OutboxPublishService {
  publishPendingBatch(limit: number): Promise<OutboxPublishBatchResult>;
}

interface LoggerLike {
  info(message: string, context: OutboxPublishBatchResult): void;
  error(message: string, error: Error): void;
}

export interface RunOutboxPublisherInput {
  service: OutboxPublishService;
  intervalMs?: number;
  batchSize?: number;
  logger?: LoggerLike;
}

export async function runOutboxPublisher({
  service,
  intervalMs = 2000,
  batchSize = 50,
  logger = console,
}: RunOutboxPublisherInput): Promise<never> {
  for (;;) {
    try {
      const result = await service.publishPendingBatch(batchSize);
      if (result.fetched > 0) {
        logger.info('outbox batch processed', result);
      }
    } catch (error) {
      const mappedError = error instanceof Error ? error : new Error(String(error));
      logger.error('outbox publisher batch failed', mappedError);
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }
}
