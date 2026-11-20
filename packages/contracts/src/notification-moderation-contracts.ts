export type NotificationCategory =
  | 'follow'
  | 'reply'
  | 'mention'
  | 'subscription'
  | 'live'
  | 'billing'
  | 'moderation';

export type NotificationChannel = 'in_app' | 'push' | 'email';

export interface NotificationPreferenceView {
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export type ModerationCaseStatus = 'open' | 'triaged' | 'escalated' | 'resolved' | 'appealed';
export type ModerationTargetType = 'post' | 'media' | 'account' | 'comment' | 'campaign' | 'live_stream';

export interface ReportInput {
  actorUserId: string;
  targetType: ModerationTargetType;
  targetId: string;
  category: string;
  description: string;
  evidenceUrls?: string[];
}

export interface ModerationCaseView {
  caseId: string;
  reporterUserId: string;
  targetType: ModerationTargetType;
  targetId: string;
  category: string;
  status: ModerationCaseStatus;
  resolution: string | null;
  assignedModeratorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveModerationCaseInput {
  actorUserId: string;
  caseId: string;
  status: 'resolved' | 'escalated';
  resolution: string;
}

export interface AppealModerationCaseInput {
  actorUserId: string;
  caseId: string;
  appealReason: string;
}

export interface ModerationQueueInput {
  actorUserId: string;
  status?: ModerationCaseStatus;
  limit?: number;
}

export interface EscalateFakeBotInput {
  actorUserId: string;
  targetUserId: string;
  reason: string;
  evidenceUrls?: string[];
}

export interface FakeBotEscalationView {
  caseId: string;
  targetUserId: string;
  status: 'triaged' | 'escalated';
  reason: string;
  createdAt: string;
}
