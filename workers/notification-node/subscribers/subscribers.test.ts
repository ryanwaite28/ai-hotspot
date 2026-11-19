import assert from 'node:assert/strict';
import test from 'node:test';

import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import { buildNotificationWorker } from '../bootstrap';
import { InMemoryEventIdempotencyStore } from './event-idempotency.store';
import { NotificationSubscriberRouter } from './notification-subscriber-router';
import { StoryReplyCreatedNotificationSubscriber } from './story-reply-created-notification.subscriber';
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

test('notification subscribers handle story.reply.created and deduplicate', async () => {
  const sentEmails: EmailTemplateSendInput[] = [];
  const emailService = {
    async sendTemplate(input: EmailTemplateSendInput) {
      sentEmails.push(input);
    },
  };

  const store = new InMemoryEventIdempotencyStore();
  const subscriber = new StoryReplyCreatedNotificationSubscriber(store, emailService);

  const event = createDomainEvent('evt-3', 'story.reply.created', {
      storyId: 'story-1',
      storyOwnerUserId: 'owner-1',
      storyOwnerEmail: 'owner@rmwhs.com',
      replyAuthorUserId: 'author-1',
      replyBodyText: 'nice story',
    });

  const first = await subscriber.handle(event);
  const second = await subscriber.handle(event);

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].templateId, 'story_reply_received');
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
    new StoryReplyCreatedNotificationSubscriber(store, emailService),
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

  const handledStoryReply = await router.handle(createDomainEvent('evt-story-reply', 'story.reply.created', {
      storyId: 'story-1',
      storyOwnerUserId: 'owner-1',
      storyOwnerEmail: 'owner@rmwhs.com',
      replyAuthorUserId: 'author-1',
      replyBodyText: 'nice story',
    }));

  assert.equal(handledCreated, true);
  assert.equal(handledReset, true);
  assert.equal(handledStoryReply, true);
  assert.equal(handledUnknown, false);
  assert.equal(sentEmails.length, 3);
});

test('buildNotificationWorker uses repository idempotency store when provided', async () => {
  const starts: Array<{ subscriberName: string; eventId: string; eventType: string }> = [];
  const processed: Array<{ subscriberName: string; eventId: string; eventType: string }> = [];
  const repository = {
    async tryStartEventProcessing(input: { subscriberName: string; eventId: string; eventType: string }) {
      starts.push(input);
      return true;
    },
    async markEventProcessed(input: { subscriberName: string; eventId: string; eventType: string }) {
      processed.push(input);
    },
    async markEventFailed() {},
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
  assert.equal(starts.length, 1);
  assert.equal(starts[0].subscriberName, 'user_created_email_welcome');
  assert.equal(processed.length, 1);
  assert.equal(sentEmails.length, 1);
});

test('notification subscribers retry event after a failed delivery attempt', async () => {
  const sentEmails: EmailTemplateSendInput[] = [];
  let attempts = 0;

  const emailService = {
    async sendTemplate(input: EmailTemplateSendInput) {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('smtp unavailable');
      }
      sentEmails.push(input);
    },
  };

  const store = new InMemoryEventIdempotencyStore();
  const subscriber = new UserEmailResetRequestedSubscriber(store, emailService);

  const event = createDomainEvent('evt-retry', 'user.email-reset-requested', {
      userId: 'user-123',
      email: 'ryan@rmwhs.com',
    });

  await assert.rejects(() => subscriber.handle(event), /smtp unavailable/);

  const second = await subscriber.handle(event);

  assert.equal(second, true);
  assert.equal(sentEmails.length, 1);
});
