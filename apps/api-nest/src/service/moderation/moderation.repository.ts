import type {
  AppealModerationCaseInput,
  ModerationCaseView,
  ReportInput,
  ResolveModerationCaseInput,
  NotificationPreferenceView,
  NotificationCategory,
  NotificationChannel,
} from '../../../../../packages/contracts/src';

export interface ModerationRepository {
  getPreference(userId: string, category: NotificationCategory, channel: NotificationChannel): Promise<NotificationPreferenceView | null>;
  setPreference(input: NotificationPreferenceView): Promise<NotificationPreferenceView>;
  createReport(input: ReportInput & { caseId: string; occurredAtEpochSeconds: number }): Promise<ModerationCaseView | null>;
  resolveCase(input: ResolveModerationCaseInput & { eventId: string; occurredAtEpochSeconds: number }): Promise<ModerationCaseView | null>;
  appealCase(input: AppealModerationCaseInput & { eventId: string; occurredAtEpochSeconds: number }): Promise<ModerationCaseView | null>;
}
