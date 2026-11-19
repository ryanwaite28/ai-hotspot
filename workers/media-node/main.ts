import { buildMediaWorker } from './bootstrap';
import { MediaServiceApiClient } from './media-service-api.client';

async function main(): Promise<void> {
  const rabbitMqUrl = process.env.RABBITMQ_URL;
  const mediaApiBaseUrl = process.env.MEDIA_API_BASE_URL;
  const mediaApiToken = process.env.MEDIA_API_TOKEN;

  if (!rabbitMqUrl) {
    throw new Error('RABBITMQ_URL is required');
  }
  if (!mediaApiBaseUrl) {
    throw new Error('MEDIA_API_BASE_URL is required');
  }

  const mediaServiceClient = new MediaServiceApiClient({
    baseUrl: mediaApiBaseUrl,
    authToken: mediaApiToken,
    processingStatusPathTemplate: process.env.MEDIA_API_PROCESSING_STATUS_PATH,
  });

  const worker = buildMediaWorker({
    mediaServiceClient,
  });

  const consumerRuntime = await worker.startConsumer({
    amqpUrl: rabbitMqUrl,
    exchange: process.env.MEDIA_PROCESSING_EXCHANGE || 'hotspot.events',
    queue: process.env.MEDIA_PROCESSING_QUEUE || 'hotspot.media.processing',
    routingKeys: ['media.processing.requested'],
  });

  const shutdown = async (): Promise<void> => {
    await consumerRuntime.close();
  };

  process.on('SIGINT', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('media worker shutdown failed', error);
        process.exit(1);
      });
  });

  process.on('SIGTERM', () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('media worker shutdown failed', error);
        process.exit(1);
      });
  });
}

main().catch((error) => {
  console.error('media worker failed', error);
  process.exit(1);
});
