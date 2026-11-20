import assert from 'node:assert/strict';
import test from 'node:test';

import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';
import { InMemoryEventIdempotencyStore } from './event-idempotency.store';
import { TransactionalTemplateSubscriber } from './transactional-template.subscriber';

function event(eventId: string, eventType: string): DomainEventEnvelope {
  return {
    eventId,
    eventType,
    aggregateType: 'billing',
    aggregateId: 'aggregate-1',
    aggregateVersion: 1,
    occurredAt: new Date().toISOString(),
    payload: {
      recipientEmail: 'member@rmwhs.com',
      subscriptionId: 'sub-1',
    },
    headers: { schemaVersion: 1, producer: 'hotspot-test' },
  };
}

test('transactional template subscriber routes billing events and deduplicates', async () => {
  const sent: Array<{ recipient: string; templateId: string }> = [];
  const subscriber = new TransactionalTemplateSubscriber(
    new InMemoryEventIdempotencyStore(),
    {
      async sendTemplate(input) {
        sent.push({ recipient: input.recipient, templateId: input.templateId });
      },
    },
  );

  const first = await subscriber.handle(event('evt-template-1', 'subscription.purchased'));
  const duplicate = await subscriber.handle(event('evt-template-1', 'subscription.purchased'));

  assert.equal(first, true);
  assert.equal(duplicate, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].templateId, 'subscription_purchased');
});

test('transactional template subscriber ignores unrelated events', async () => {
  const subscriber = new TransactionalTemplateSubscriber(
    new InMemoryEventIdempotencyStore(),
    {
      async sendTemplate() {},
    },
  );

  assert.equal(await subscriber.handle(event('evt-other', 'post.created')), false);
});
