import assert from 'node:assert/strict';
import test from 'node:test';

import { startMediaProcessingConsumer } from './media-processing-consumer';

interface TestRmqEvent {
  data: unknown;
  ack(): void;
  nack(requeue?: boolean): void;
}

type ConsumeHandler = (event: TestRmqEvent) => Promise<void> | void;

test('startMediaProcessingConsumer binds and acknowledges processed events', async () => {
  const acks: boolean[] = [];
  const nacks: boolean[] = [];
  let consumeHandler!: ConsumeHandler;
  let capturedBindings: Array<{ queue: string; exchange: string; routingKey: string }> = [];

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
    async handle(event: { eventType: string }) {
      assert.equal(event.eventType, 'media.processing.requested');
      return true;
    },
  };

  const runtime = await startMediaProcessingConsumer({
    amqpUrl: 'amqp://example',
    router,
    clientFactory: (config) => {
      capturedBindings = config.bindings;
      return client;
    },
  });

  await consumeHandler({
    data: {
      eventId: 'evt-media-1',
      eventType: 'media.processing.requested',
      aggregateType: 'media_asset',
      aggregateId: 'media-1',
      aggregateVersion: null,
      occurredAt: new Date().toISOString(),
      payload: {},
      headers: { schemaVersion: 1, producer: 'test' },
    },
    ack() {
      acks.push(true);
    },
    nack() {
      nacks.push(true);
    },
  });

  assert.equal(capturedBindings.length, 1);
  assert.equal(capturedBindings[0].routingKey, 'media.processing.requested');
  assert.equal(acks.length, 1);
  assert.equal(nacks.length, 0);

  await runtime.close();
});

test('startMediaProcessingConsumer nacks malformed payloads', async () => {
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

  const runtime = await startMediaProcessingConsumer({
    amqpUrl: 'amqp://example',
    router: {
      async handle() {
        throw new Error('should not be called for malformed payload');
      },
    },
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
