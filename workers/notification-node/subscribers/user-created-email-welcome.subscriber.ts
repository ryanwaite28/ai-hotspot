import type {
  DomainEventEnvelope,
  UserCreatedPayload,
} from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import type { EmailService } from '../email/email-service.adapter';
import type { EventIdempotencyStore } from './event-idempotency.store';

const SUBSCRIBER_NAME = 'user_created_email_welcome';

function isUserCreatedEventType(event: DomainEventEnvelope): boolean {
  return event.eventType === 'user.created';
}

function mapUserCreatedPayload(payload: DomainEventEnvelope['payload']): UserCreatedPayload | null {
  const userId = payload['userId'];
  const handle = payload['handle'];
  const email = payload['email'];

  if (typeof userId !== 'string' || typeof handle !== 'string' || typeof email !== 'string') {
    return null;
  }

  return {
    userId,
    handle,
    email,
    status: 'active',
    role: 'user',
  };
}

export class UserCreatedEmailWelcomeSubscriber {
  constructor(
    private readonly idempotencyStore: EventIdempotencyStore,
    private readonly emailService: EmailService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    if (!isUserCreatedEventType(event)) {
      return false;
    }

    const payload = mapUserCreatedPayload(event.payload);
    if (!payload) {
      throw new Error('user.created payload is invalid');
    }

    const idempotencyInput = {
      subscriberName: SUBSCRIBER_NAME,
      eventId: event.eventId,
      eventType: event.eventType,
    };

    const accepted = await this.idempotencyStore.tryStartProcessing(idempotencyInput);

    if (!accepted) {
      return false;
    }

    const templateParams: JsonObject = {
      userId: payload.userId,
      handle: payload.handle,
    };

    try {
      await this.emailService.sendTemplate({
        recipient: payload.email,
        templateId: 'welcome_email',
        templateParams,
      });
      await this.idempotencyStore.markProcessed(idempotencyInput);
    } catch (error) {
      await this.idempotencyStore.markFailed({
        ...idempotencyInput,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return true;
  }
}
