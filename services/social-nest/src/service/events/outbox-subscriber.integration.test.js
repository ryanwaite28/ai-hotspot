const assert = require('node:assert/strict');
const test = require('node:test');

const { OutboxPublisherService } = require('./outbox-publisher.service');
const { buildNotificationWorker } = require('../../../../../workers/notification-node/bootstrap.ts');

test('integration: outbox publish drives subscribers with dedup and retry accounting', async () => {
  const sentEmails = [];
  const worker = buildNotificationWorker({
    emailService: {
      async sendTemplate(input) {
        sentEmails.push(input);
      },
    },
  });

  const markedPublished = [];
  const incrementedAttempts = [];

  const rows = [
    {
      id: 'outbox-1',
      event_id: 'evt-created',
      aggregate_type: 'user',
      aggregate_id: 'user-1',
      aggregate_version: 1,
      event_type: 'user.created',
      payload: { userId: 'user-1', handle: 'ryan', email: 'ryan@rmwhs.com' },
      headers: { schemaVersion: 1 },
      occurred_at: new Date().toISOString(),
      publish_attempts: 0,
    },
    {
      id: 'outbox-2',
      event_id: 'evt-reset',
      aggregate_type: 'user',
      aggregate_id: 'user-2',
      aggregate_version: null,
      event_type: 'user.email-reset-requested',
      payload: { userId: 'user-2', email: 'ryan@rmwhs.com' },
      headers: { schemaVersion: 1 },
      occurred_at: new Date().toISOString(),
      publish_attempts: 0,
    },
    {
      id: 'outbox-3',
      event_id: 'evt-fail',
      aggregate_type: 'user',
      aggregate_id: 'user-3',
      aggregate_version: null,
      event_type: 'user.created',
      payload: { userId: 'user-3', handle: 'fail', email: 'fail@rmwhs.com' },
      headers: { schemaVersion: 1 },
      occurred_at: new Date().toISOString(),
      publish_attempts: 2,
    },
  ];

  const db = {
    async query(sql, params) {
      if (String(sql).includes('FROM domain_event_outbox')) {
        return { rows };
      }
      if (String(sql).includes('SET published_at = NOW()')) {
        markedPublished.push(params[0]);
        return { rows: [] };
      }
      if (String(sql).includes('SET publish_attempts = publish_attempts + 1')) {
        incrementedAttempts.push(params[0]);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const publisher = {
    async publish(event) {
      if (event.eventId === 'evt-fail') {
        throw new Error('simulated broker publish failure');
      }

      await worker.router.handle(event);

      // Simulate a duplicate broker delivery for the same event id.
      if (event.eventId === 'evt-created') {
        await worker.router.handle(event);
      }
    },
  };

  const service = new OutboxPublisherService(db, publisher);
  const result = await service.publishPendingBatch(50);

  assert.equal(result.fetched, 3);
  assert.equal(result.published, 2);
  assert.equal(result.failed, 1);

  assert.deepEqual(markedPublished, ['outbox-1', 'outbox-2']);
  assert.deepEqual(incrementedAttempts, ['outbox-3']);

  // Deduplication: duplicate evt-created should not trigger duplicate send.
  assert.equal(sentEmails.length, 2);
  assert.equal(sentEmails[0].templateId, 'welcome_email');
  assert.equal(sentEmails[1].templateId, 'email_reset_verification');
});
