import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ModerationCaseView,
  NotificationPreferenceView,
  NotificationCategory,
  NotificationChannel,
  ReportInput,
  ResolveModerationCaseInput,
  AppealModerationCaseInput,
  ModerationQueueInput,
  EscalateFakeBotInput,
} from '../../../../../packages/contracts/src';
import { NotificationModerationService } from './moderation.service';

function createHarness() {
  const preferences = new Map<string, NotificationPreferenceView>();
  const cases = new Map<string, ModerationCaseView>();

  const repository = {
    async getPreference(userId: string, category: NotificationCategory, channel: NotificationChannel) {
      return preferences.get(`${userId}:${category}:${channel}`) ?? null;
    },
    async setPreference(input: NotificationPreferenceView) {
      preferences.set(`${input.userId}:${input.category}:${input.channel}`, input);
      return input;
    },
    async createReport(input: ReportInput & { caseId: string; occurredAtEpochSeconds: number }) {
      const now = new Date(input.occurredAtEpochSeconds * 1000).toISOString();
      const caseView: ModerationCaseView = {
        caseId: input.caseId,
        reporterUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        category: input.category,
        status: 'open',
        resolution: null,
        assignedModeratorUserId: null,
        createdAt: now,
        updatedAt: now,
      };
      cases.set(caseView.caseId, caseView);
      return caseView;
    },
    async resolveCase(input: ResolveModerationCaseInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = cases.get(input.caseId);
      if (!existing) {
        return null;
      }
      const resolved: ModerationCaseView = {
        ...existing,
        status: input.status === 'resolved' ? 'resolved' : 'escalated',
        resolution: input.resolution,
        assignedModeratorUserId: input.actorUserId,
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      cases.set(resolved.caseId, resolved);
      return resolved;
    },
    async appealCase(input: AppealModerationCaseInput & { eventId: string; occurredAtEpochSeconds: number }) {
      const existing = cases.get(input.caseId);
      if (!existing) {
        return null;
      }
      const appealed: ModerationCaseView = {
        ...existing,
        status: 'appealed',
        updatedAt: new Date(input.occurredAtEpochSeconds * 1000).toISOString(),
      };
      cases.set(appealed.caseId, appealed);
      return appealed;
    },
    async listQueue(input: ModerationQueueInput) {
      return Array.from(cases.values())
        .filter((item) => input.status === undefined || item.status === input.status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, input.limit ?? 50);
    },
    async escalateFakeBot(input: EscalateFakeBotInput & { caseId: string; eventId: string; occurredAtEpochSeconds: number }) {
      const now = new Date(input.occurredAtEpochSeconds * 1000).toISOString();
      const caseView: ModerationCaseView = {
        caseId: input.caseId,
        reporterUserId: input.actorUserId,
        targetType: 'account',
        targetId: input.targetUserId,
        category: 'fake_bot_escalation',
        status: 'escalated',
        resolution: input.reason,
        assignedModeratorUserId: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      };
      cases.set(caseView.caseId, caseView);
      return {
        caseId: caseView.caseId,
        targetUserId: input.targetUserId,
        status: 'escalated' as const,
        reason: input.reason,
        createdAt: now,
      };
    },
  };

  const rolePort = {
    async isModerator(actorUserId: string) {
      return actorUserId.startsWith('moderator-');
    },
  };

  return { service: new NotificationModerationService(repository, rolePort), cases };
}

test('notification preferences default enabled and can disable delivery', async () => {
  const harness = createHarness();

  assert.equal(await harness.service.isNotificationAllowed('user-1', 'reply', 'email'), true);

  await harness.service.setPreference({
    userId: 'user-1',
    category: 'reply',
    channel: 'email',
    enabled: false,
  });

  assert.equal(await harness.service.isNotificationAllowed('user-1', 'reply', 'email'), false);
});

test('moderation report resolves escalates and appeals with append-only lifecycle', async () => {
  const harness = createHarness();

  const report = await harness.service.submitReport({
    actorUserId: 'reporter-1',
    targetType: 'post',
    targetId: 'post-1',
    category: 'harassment',
    description: 'Repeated abusive reply',
    evidenceUrls: ['https://hotspot.local/evidence/1'],
  });
  assert.ok(report);
  assert.equal(report?.status, 'open');

  const escalated = await harness.service.resolveCase({
    actorUserId: 'moderator-1',
    caseId: report!.caseId,
    status: 'escalated',
    resolution: 'Needs trust and safety review',
  });
  assert.equal(escalated?.status, 'escalated');

  const appealed = await harness.service.appealCase({
    actorUserId: 'reporter-1',
    caseId: report!.caseId,
    appealReason: 'The target context was incomplete',
  });
  assert.equal(appealed?.status, 'appealed');
});

test('moderation report and resolution validate required text', async () => {
  const harness = createHarness();

  await assert.rejects(
    () => harness.service.submitReport({
      actorUserId: 'reporter-1',
      targetType: 'account',
      targetId: 'account-1',
      category: ' ',
      description: 'reason',
    }),
    /category is required/,
  );

  await assert.rejects(
    () => harness.service.resolveCase({
      actorUserId: 'moderator-1',
      caseId: 'case-1',
      status: 'resolved',
      resolution: ' ',
    }),
    /resolution is required/,
  );
});

test('moderation dashboard requires moderator role and supports queue filtering', async () => {
  const harness = createHarness();
  await harness.service.submitReport({
    actorUserId: 'reporter-1',
    targetType: 'post',
    targetId: 'post-10',
    category: 'spam',
    description: 'Repeated spam post',
  });

  await assert.rejects(
    () => harness.service.listQueue({ actorUserId: 'regular-user', status: 'open', limit: 20 }),
    /FORBIDDEN/,
  );

  const queue = await harness.service.listQueue({
    actorUserId: 'moderator-1',
    status: 'open',
    limit: 20,
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'open');
});

test('fake/bot escalation requires moderator role and creates escalated case', async () => {
  const harness = createHarness();

  await assert.rejects(
    () => harness.service.escalateFakeBot({
      actorUserId: 'regular-user',
      targetUserId: 'bot-account-1',
      reason: 'Automated bulk creation pattern',
      evidenceUrls: ['https://hotspot.local/evidence/bot-1'],
    }),
    /FORBIDDEN/,
  );

  const escalation = await harness.service.escalateFakeBot({
    actorUserId: 'moderator-1',
    targetUserId: 'bot-account-1',
    reason: 'Automated bulk creation pattern',
    evidenceUrls: ['https://hotspot.local/evidence/bot-1'],
  });

  assert.ok(escalation);
  assert.equal(escalation?.status, 'escalated');
  assert.equal(escalation?.targetUserId, 'bot-account-1');
});
