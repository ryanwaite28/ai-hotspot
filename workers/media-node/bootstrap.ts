import {
  type StartMediaProcessingConsumerInput,
  startMediaProcessingConsumer,
} from './rabbitmq/media-processing-consumer';
import {
  type MediaProcessingStatusClient,
  MediaProcessingRequestedSubscriber,
} from './subscribers/media-processing.subscriber';
import { MediaProcessingSubscriberRouter } from './subscribers/media-processing-subscriber-router';

export interface MediaWorkerDependencies {
  mediaServiceClient: MediaProcessingStatusClient;
}

export interface MediaWorker {
  router: MediaProcessingSubscriberRouter;
  startConsumer: (input: Omit<StartMediaProcessingConsumerInput, 'router'>) => Promise<{ close(): Promise<void> }>;
}

export function buildMediaWorker(dependencies: MediaWorkerDependencies): MediaWorker {
  const router = new MediaProcessingSubscriberRouter([
    new MediaProcessingRequestedSubscriber(dependencies.mediaServiceClient),
  ]);

  return {
    router,
    startConsumer: (input) => startMediaProcessingConsumer({
      ...input,
      router,
    }),
  };
}
