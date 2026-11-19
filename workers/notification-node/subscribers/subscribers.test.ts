import assert from 'node:assert/strict';
import test from 'node:test';

import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import { buildNotificationWorker } from '../bootstrap';
import { InMemoryEventIdempotencyStore } from './event-idempotency.store';
import { NotificationSubscriberRouter } from './notification-subscriber-router';
import { UserCreatedEmailWelcomeSubscriber } from './user-created-email-welcome.subscriber';
import { UserEmailResetRequestedSubscriber } from './user-email-reset-requested.subscriber';

interface EmailTemplateSendInput {
  recipient: string;
  templateId: string;
  templateParams: Record<string, string>;
}

function createDomainEvent(eventId: string, eventType: string, payload: JsonObject): DomainEventEnvelope {
  return {
    eventId,
    eventType,
    aggregateType: 'user',
    aggregateId: 'test-aggregate',
    aggregateVersion: 1,
    occurredAt: new Date().toISOString(),
    payload,
    headers: {
      schemaVersion: 1,
      producer: 'hotspot-test',
    },
  };
}

test('notification subscribers handle user.created and deduplicate by event id', async () => {
  const sentEmails: EmailTemplateSendInput[] = [];
  const emailService = {
    async sendTemplate(input: EmailTemplateSendInput) {
      sentEmails.push(input);
    },
  };

  const store = new InMemoryEventIdempotencyStore();
  const subscriber = new UserCreatedEmailWelcomeSubscriber(store, emailService);

  const event = createDomainEvent('evt-1', 'user.created', {
      userId: 'user-123',
      handle: 'ryan',
      email: 'ryan@rmwhs.com',
    });

  const first = await subscriber.handle(event);
  const second = await subscriber.handle(event);

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].templateId, 'welcome_email');
});

test('notification subscribers handle user.email-reset-requested and deduplicate', async () => {
  const sentEmails: EmailTemplateSendInput[] = [];
  const emailService = {
    async sendTemplate(input: EmailTemplateSendInput) {
      sentEmails.push(input);
    },
  };

  const store = new InMemoryEventIdempotencyStore();
  const subscriber = new UserEmailResetRequestedSubscriber(store, emailService);

  const event = createDomainEvent('evt-2', 'user.email-reset-requested', {
      userId: 'user-123',
      email: 'ryan@rmwhs.com',
    });

  const first = await subscriber.handle(event);
  const second = await subscriber.handle(event);

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].templateId, 'email_reset_verification');
});

test('router dispatches events to matching subscribers', async () => {
  const sentEmails: EmailTemplateSendInput[] = [];
  const emailService = {
    async sendTemplate(input: EmailTemplateSendInput) {
      sentEmails.push(input);
    },
  };

  const store = new InMemoryEventIdempotencyStore();
  const router = new NotificationSubscriberRouter([
    new UserCreatedEmailWelcomeSubscriber(store, emailService),
    new UserEmailResetRequestedSubscriber(store, emailService),
  ]);

  const handledCreated = await router.handle(createDomainEvent('evt-created', 'user.created', {
      userId: 'user-123',
      handle: 'ryan',
      email: 'ryan@rmwhs.com',
    }));

  const handledReset = await router.handle(createDomainEvent('evt-reset', 'user.email-reset-requested', {
      userId: 'user-123',
      email: 'ryan@rmwhs.com',
    }));

  const handledUnknown = await router.handle(createDomainEvent('evt-other', 'post.created', { postId: 'post-1' }));

  assert.equal(handledCreated, true);
  assert.equal(handledReset, true);
  assert.equal(handledUnknown, false);
  assert.equal(sentEmails.length, 2);
});

test('buildNotificationWorker uses repository idempotency store when provided', async () => {
  const marks: Array<{ subscriberName: string; eventId: string; eventType: string }> = [];
  const repository = {
    async markEventConsumed(input: { subscriberName: string; eventId: string; eventType: string }) {
      marks.push(input);
      return true;
    },
  };

  const sentEmails: EmailTemplateSendInput[] = [];
  const worker = buildNotificationWorker({
    subscriberIdempotencyRepository: repository,
    emailService: {
      async sendTemplate(input: EmailTemplateSendInput) {
        sentEmails.push(input);
      },
    },
  });

  const handled = await worker.router.handle(createDomainEvent('evt-100', 'user.created', {
      userId: 'user-123',
      handle: 'ryan',
      email: 'ryan@rmwhs.com',
    }));

  assert.equal(handled, true);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].subscriberName, 'user_created_email_welcome');
  assert.equal(sentEmails.length, 1);
});
