import crypto from 'node:crypto';

import type {
  AppealModerationCaseInput,
  ModerationCaseView,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferenceView,
  ReportInput,
  ResolveModerationCaseInput,
} from '../../../../../packages/contracts/src';
import type { ModerationRepository } from './moderation.repository';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class NotificationModerationService {
  constructor(private readonly repository: ModerationRepository) {}

  async getPreference(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<NotificationPreferenceView | null> {
    return this.repository.getPreference(userId, category, channel);
  }

  async setPreference(input: NotificationPreferenceView): Promise<NotificationPreferenceView> {
    return this.repository.setPreference(input);
  }

  async isNotificationAllowed(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.repository.getPreference(userId, category, channel);
    return preference ? preference.enabled : true;
  }

  async submitReport(input: ReportInput): Promise<ModerationCaseView | null> {
    const category = input.category.trim();
    const description = input.description.trim();
    if (category.length === 0) {
      throw new Error('Moderation report category is required');
    }
    if (description.length === 0) {
      throw new Error('Moderation report description is required');
    }
    if (description.length > 5000) {
      throw new Error('Moderation report description exceeds maximum length');
    }

    return this.repository.createReport({
      ...input,
      category,
      description,
      evidenceUrls: input.evidenceUrls?.slice(0, 10),
      caseId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async resolveCase(input: ResolveModerationCaseInput): Promise<ModerationCaseView | null> {
    const resolution = input.resolution.trim();
    if (resolution.length === 0) {
      throw new Error('Moderation resolution is required');
    }

    return this.repository.resolveCase({
      ...input,
      resolution,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async appealCase(input: AppealModerationCaseInput): Promise<ModerationCaseView | null> {
    const appealReason = input.appealReason.trim();
    if (appealReason.length === 0) {
      throw new Error('Appeal reason is required');
    }

    return this.repository.appealCase({
      ...input,
      appealReason,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }
}
