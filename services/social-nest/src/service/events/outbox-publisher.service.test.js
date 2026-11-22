const assert = require('node:assert/strict');
const test = require('node:test');

const { OutboxPublisherService } = require('./outbox-publisher.service');

test('OutboxPublisherService publishes pending events and tracks failures', async () => {
  const publishedEvents = [];
  const markedPublished = [];
  const incrementedAttempts = [];

  const rows = [
    {
      id: '1',
      event_id: 'evt-1',
      aggregate_type: 'user',
      aggregate_id: 'user-1',
      aggregate_version: 1,
      event_type: 'user.created',
      payload: { userId: 'user-1' },
      headers: { schemaVersion: 1 },
      occurred_at: new Date().toISOString(),
      publish_attempts: 0,
    },
    {
      id: '2',
      event_id: 'evt-2',
      aggregate_type: 'user',
      aggregate_id: 'user-2',
      aggregate_version: 1,
      event_type: 'user.email-reset-requested',
      payload: { userId: 'user-2' },
      headers: { schemaVersion: 1 },
      occurred_at: new Date().toISOString(),
      publish_attempts: 1,
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
      if (event.eventId === 'evt-2') {
        throw new Error('publish failure');
      }
      publishedEvents.push(event);
    },
  };

  const service = new OutboxPublisherService(db, publisher);
  const result = await service.publishPendingBatch(20);

  assert.equal(result.fetched, 2);
  assert.equal(result.published, 1);
  assert.equal(result.failed, 1);
  assert.equal(publishedEvents.length, 1);
  assert.equal(publishedEvents[0].eventId, 'evt-1');
  assert.deepEqual(markedPublished, ['1']);
  assert.deepEqual(incrementedAttempts, ['2']);
});
