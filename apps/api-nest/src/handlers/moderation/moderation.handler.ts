import type {
  AppealModerationCaseInput,
  ReportInput,
  ResolveModerationCaseInput,
} from '../../../../../packages/contracts/src';
import type { NotificationModerationService } from '../../service/moderation/moderation.service';

export class ModerationHandler {
  constructor(private readonly service: NotificationModerationService) {}

  async submitReport(
    actorUserId: string,
    body: Omit<ReportInput, 'actorUserId'>,
  ) {
    return this.service.submitReport({ actorUserId, ...body });
  }

  async resolveCase(
    actorUserId: string,
    body: Omit<ResolveModerationCaseInput, 'actorUserId'>,
  ) {
    return this.service.resolveCase({ actorUserId, ...body });
  }

  async appealCase(
    actorUserId: string,
    body: Omit<AppealModerationCaseInput, 'actorUserId'>,
  ) {
    return this.service.appealCase({ actorUserId, ...body });
  }
}
