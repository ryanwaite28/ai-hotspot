import assert from 'node:assert/strict';
import test from 'node:test';

import { startNotificationConsumer } from './notification-consumer';

interface TestRmqEvent {
  data: unknown;
  ack(): void;
  nack(requeue?: boolean): void;
}

type ConsumeHandler = (event: TestRmqEvent) => Promise<void> | void;

test('startNotificationConsumer binds keys and acknowledges handled events', async () => {
  const acks: boolean[] = [];
  const nacks: boolean[] = [];
  const consumed: string[] = [];
  let consumeHandler!: ConsumeHandler;
  let clientConfig!: { bindings: Array<{ queue: string; exchange: string; routingKey: string }> };

  const client = {
    forQueue(queueName: string) {
      consumed.push(queueName);
      return {
        subscribe({ next }: { next: ConsumeHandler }) {
          consumeHandler = next;
          return {
            unsubscribe() {},
          };
        },
      };
    },
    async close() {},
  };

  const clientFactory = (config: {
    bindings: Array<{ queue: string; exchange: string; routingKey: string }>;
  }) => {
    clientConfig = config;
    return client;
  };

  const router = {
    async handle(event: { eventType: string }) {
      assert.equal(event.eventType, 'user.created');
      return true;
    },
  };

  const runtime = await startNotificationConsumer({
    amqpUrl: 'amqp://example',
    router,
    clientFactory,
    queue: 'hotspot.notifications',
    exchange: 'hotspot.domain.events',
  });

  await consumeHandler({
    data: {
      eventId: 'evt-1',
      eventType: 'user.created',
      payload: { userId: 'user-1', email: 'user@rmwhs.com', handle: 'u' },
    },
    ack() {
      acks.push(true);
    },
    nack() {
      nacks.push(true);
    },
  });

  assert.equal(consumed.length, 1);
  assert.equal(consumed[0], 'hotspot.notifications');
  assert.equal(clientConfig.bindings.length, 2);
  assert.equal(acks.length, 1);
  assert.equal(nacks.length, 0);

  await runtime.close();
});

test('startNotificationConsumer nacks malformed events', async () => {
  const acks: boolean[] = [];
  const nacks: boolean[] = [];
  let consumeHandler!: ConsumeHandler;

  const client = {
    forQueue() {
      return {
        subscribe({ next }: { next: ConsumeHandler }) {
          consumeHandler = next;
          return {
            unsubscribe() {},
          };
        },
      };
    },
    async close() {},
  };

  const router = {
    async handle() {
      throw new Error('should not run for malformed payload');
    },
  };

  const runtime = await startNotificationConsumer({
    amqpUrl: 'amqp://example',
    router,
    clientFactory: () => client,
    logger: { error() {} },
  });

  await consumeHandler({
    data: '{"eventType":',
    ack() {
      acks.push(true);
    },
    nack() {
      nacks.push(true);
    },
  });

  assert.equal(acks.length, 0);
  assert.equal(nacks.length, 1);

  await runtime.close();
});

test('startNotificationConsumer nacks and dead-letters handler failures', async () => {
  const acks: boolean[] = [];
  const nacks: Array<{ requeue?: boolean }> = [];
  let consumeHandler!: ConsumeHandler;

  const client = {
    forQueue() {
      return {
        subscribe({ next }: { next: ConsumeHandler }) {
          consumeHandler = next;
          return {
            unsubscribe() {},
          };
        },
      };
    },
    async close() {},
  };

  const router = {
    async handle() {
      throw new Error('subscriber failure');
    },
  };

  const runtime = await startNotificationConsumer({
    amqpUrl: 'amqp://example',
    router,
    clientFactory: () => client,
    logger: { error() {} },
  });

  await consumeHandler({
    data: {
      eventId: 'evt-fail',
      eventType: 'user.created',
      payload: { userId: 'user-1', email: 'u@rmwhs.com', handle: 'u' },
    },
    ack() {
      acks.push(true);
    },
    nack(requeue?: boolean) {
      nacks.push({ requeue });
    },
  });

  assert.equal(acks.length, 0);
  assert.equal(nacks.length, 1);
  assert.equal(nacks[0].requeue, false);

  await runtime.close();
});
