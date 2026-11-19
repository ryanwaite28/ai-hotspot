export interface RabbitMqQueueDefinition {
  name: string;
  durable: boolean;
  deadLetterExchange: string;
  deadLetterRoutingKey: string;
}

export interface RabbitMqBindingDefinition {
  queue: string;
  exchange: string;
  routingKey: string;
}

export interface MediaTopologyDefinition {
  exchange: string;
  deadLetterExchange: string;
  queues: RabbitMqQueueDefinition[];
  bindings: RabbitMqBindingDefinition[];
}

export const mediaTopology: MediaTopologyDefinition = {
  exchange: 'hotspot.events',
  deadLetterExchange: 'hotspot.events.dlx',
  queues: [
    {
      name: 'hotspot.media.processing',
      durable: true,
      deadLetterExchange: 'hotspot.events.dlx',
      deadLetterRoutingKey: 'media.processing.dlq',
    },
    {
      name: 'hotspot.media.processing.retry',
      durable: true,
      deadLetterExchange: 'hotspot.events',
      deadLetterRoutingKey: 'media.processing.requested',
    },
    {
      name: 'hotspot.media.processing.dlq',
      durable: true,
      deadLetterExchange: 'hotspot.events.dlx',
      deadLetterRoutingKey: 'media.processing.dead',
    },
  ],
  bindings: [
    {
      queue: 'hotspot.media.processing',
      exchange: 'hotspot.events',
      routingKey: 'media.processing.requested',
    },
    {
      queue: 'hotspot.media.processing.retry',
      exchange: 'hotspot.events.dlx',
      routingKey: 'media.processing.retry',
    },
    {
      queue: 'hotspot.media.processing.dlq',
      exchange: 'hotspot.events.dlx',
      routingKey: 'media.processing.dlq',
    },
  ],
};
