import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNotificationWorker } from '../bootstrap';
import { startNotificationConsumer } from './notification-consumer';

interface AmqpChannel {
  assertExchange(exchange: string, type: 'topic', options: { durable: boolean }): Promise<void>;
  publish(exchange: string, routingKey: string, content: Buffer, options: { persistent: boolean }): Promise<void>;
  close(): Promise<void>;
}

interface AmqpConnection {
  createChannel(): Promise<AmqpChannel>;
  close(): Promise<void>;
}

interface AmqpClient {
  connect(url: string): Promise<AmqpConnection>;
}

interface EmailTemplateSendInput {
  recipient: string;
  templateId: string;
  templateParams: Record<string, string>;
}

function hasRuntimeDeps(): boolean {
  return process.env.PHASE1_RUNTIME_INTEGRATION === '1';
}

test('runtime integration: consumer routes user events and deduplicates with repository store', { skip: !hasRuntimeDeps() }, async () => {
  if (!process.env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL is required');
  }

  const amqpClient = require('amqplib') as AmqpClient;

  const seen = new Set<string>();
  const sentEmails: EmailTemplateSendInput[] = [];

  const worker = buildNotificationWorker({
    subscriberIdempotencyRepository: {
      async markEventConsumed(input: { subscriberName: string; eventId: string }) {
        const key = `${input.subscriberName}:${input.eventId}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      },
    },
    emailService: {
      async sendTemplate(input: EmailTemplateSendInput) {
        sentEmails.push(input);
      },
    },
  });

  const runtime = await startNotificationConsumer({
    amqpUrl: process.env.RABBITMQ_URL,
    router: worker.router,
    exchange: process.env.NOTIFICATION_EXCHANGE || 'hotspot.domain.events',
    queue: process.env.NOTIFICATION_QUEUE || 'hotspot.notifications.runtime.test',
  });

  try {
    const connection = await amqpClient.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    const exchange = process.env.NOTIFICATION_EXCHANGE || 'hotspot.domain.events';

    await channel.assertExchange(exchange, 'topic', { durable: true });

    const event = {
      eventId: 'evt-runtime-user-created',
      eventType: 'user.created',
      aggregateType: 'user',
      aggregateId: 'user-runtime-1',
      aggregateVersion: 1,
      payload: {
        userId: 'user-runtime-1',
        handle: 'runtime_user',
        email: 'runtime_user@rmwhs.com',
      },
      headers: { schemaVersion: 1 },
      occurredAt: new Date().toISOString(),
    };

    await channel.publish(exchange, 'user.created', Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 500);
    });

    assert.ok(sentEmails.length >= 1);

    await channel.close();
    await connection.close();
  } finally {
    await runtime.close();
  }
});
