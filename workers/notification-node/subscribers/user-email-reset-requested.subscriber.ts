import type {
  DomainEventEnvelope,
  UserEmailResetRequestedPayload,
} from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import type { EmailService } from '../email/email-service.adapter';
import type { EventIdempotencyStore } from './event-idempotency.store';

const SUBSCRIBER_NAME = 'user_email_reset_requested';

function isUserEmailResetRequestedEvent(
  event: DomainEventEnvelope,
): boolean {
  return event.eventType === 'user.email-reset-requested';
}

function mapUserEmailResetRequestedPayload(
  payload: DomainEventEnvelope['payload'],
): UserEmailResetRequestedPayload | null {
  const userId = payload['userId'];
  const email = payload['email'];

  if (typeof userId !== 'string' || typeof email !== 'string') {
    return null;
  }

  return {
    userId,
    email,
  };
}

export class UserEmailResetRequestedSubscriber {
  constructor(
    private readonly idempotencyStore: EventIdempotencyStore,
    private readonly emailService: EmailService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    if (!isUserEmailResetRequestedEvent(event)) {
      return false;
    }

    const payload = mapUserEmailResetRequestedPayload(event.payload);
    if (!payload) {
      throw new Error('user.email-reset-requested payload is invalid');
    }

    const accepted = await this.idempotencyStore.markIfUnseen({
      subscriberName: SUBSCRIBER_NAME,
      eventId: event.eventId,
      eventType: event.eventType,
    });

    if (!accepted) {
      return false;
    }

    const templateParams: JsonObject = {
      userId: payload.userId,
      email: payload.email,
    };

    await this.emailService.sendTemplate({
      recipient: payload.email,
      templateId: 'email_reset_verification',
      templateParams,
    });

    return true;
  }
}
