import { RabbitMQClient } from 'rxjs-rabbitmq';

import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';

export interface NotificationEventRouter {
  handle(event: DomainEventEnvelope): Promise<unknown>;
}

interface LoggerLike {
  error(message: string, context?: Record<string, string>): void;
}

interface RabbitMqEvent {
  data: unknown;
  ack(): void;
  nack(requeue?: boolean): void;
}

interface SubscriptionLike {
  unsubscribe(): void;
}

interface RabbitMqQueueStream {
  subscribe(input: { next: (event: RabbitMqEvent) => void | Promise<void> }): SubscriptionLike;
}

interface RabbitMqConsumerClient {
  forQueue(queueName: string): RabbitMqQueueStream;
  close(): Promise<void>;
}

interface RabbitMqQueueConfig {
  name: string;
  options: {
    durable: boolean;
  };
}

interface RabbitMqExchangeConfig {
  name: string;
  type: 'topic';
  options: {
    durable: boolean;
  };
}

interface RabbitMqBindingConfig {
  queue: string;
  exchange: string;
  routingKey: string;
}

interface RabbitMqClientConfig {
  connection_url: string;
  queues: RabbitMqQueueConfig[];
  exchanges: RabbitMqExchangeConfig[];
  bindings: RabbitMqBindingConfig[];
  defaultContentType: 'application/json';
  retryAttempts: number;
  retryDelay: number;
}

type RabbitMqClientFactory = (config: RabbitMqClientConfig) => RabbitMqConsumerClient;

export interface StartNotificationConsumerInput {
  amqpUrl: string;
  router: NotificationEventRouter;
  logger?: LoggerLike;
  exchange?: string;
  queue?: string;
  routingKeys?: string[];
  clientFactory?: RabbitMqClientFactory;
}

const createRabbitMqClient: RabbitMqClientFactory = (config) => (
  new RabbitMQClient(config) as unknown as RabbitMqConsumerClient
);

function toDomainEventEnvelope(input: unknown): DomainEventEnvelope {
  if (typeof input === 'string') {
    return JSON.parse(input) as DomainEventEnvelope;
  }

  if (Buffer.isBuffer(input)) {
    return JSON.parse(input.toString('utf8')) as DomainEventEnvelope;
  }

  if (input && typeof input === 'object' && 'eventId' in input && 'eventType' in input) {
    return input as DomainEventEnvelope;
  }

  throw new Error('invalid event payload');
}

export async function startNotificationConsumer({
  amqpUrl,
  router,
  logger = console,
  exchange = 'hotspot.domain.events',
  queue = 'hotspot.notifications',
  routingKeys = ['user.created', 'user.email-reset-requested'],
  clientFactory = createRabbitMqClient,
}: StartNotificationConsumerInput): Promise<{ close(): Promise<void> }> {
  if (!amqpUrl) {
    throw new Error('amqpUrl is required');
  }
  if (!router || typeof router.handle !== 'function') {
    throw new Error('router with handle(event) is required');
  }

  const client = clientFactory({
    connection_url: amqpUrl,
    retryAttempts: 3,
    retryDelay: 1000,
    defaultContentType: 'application/json',
    queues: [{
      name: queue,
      options: { durable: true },
    }],
    exchanges: [{
      name: exchange,
      type: 'topic',
      options: { durable: true },
    }],
    bindings: routingKeys.map((routingKey) => ({ queue, exchange, routingKey })),
  });

  const subscription = client.forQueue(queue).subscribe({
    next: async (message) => {
      try {
        const event = toDomainEventEnvelope(message.data);
        await router.handle(event);
        message.ack();
      } catch (error) {
        logger.error('notification event handling failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        message.nack(false);
      }
    },
  });

  return {
    close: async () => {
      subscription.unsubscribe();
      await client.close();
    },
  };
}
