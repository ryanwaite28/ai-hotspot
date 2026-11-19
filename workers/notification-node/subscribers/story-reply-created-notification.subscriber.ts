import type {
  DomainEventEnvelope,
  StoryReplyCreatedPayload,
} from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import type { EmailService } from '../email/email-service.adapter';
import type { EventIdempotencyStore } from './event-idempotency.store';

const SUBSCRIBER_NAME = 'story_reply_created_notification';

function isStoryReplyCreatedEvent(event: DomainEventEnvelope): boolean {
  return event.eventType === 'story.reply.created';
}

function mapStoryReplyCreatedPayload(payload: DomainEventEnvelope['payload']): StoryReplyCreatedPayload | null {
  const storyId = payload['storyId'];
  const storyOwnerUserId = payload['storyOwnerUserId'];
  const storyOwnerEmail = payload['storyOwnerEmail'];
  const replyAuthorUserId = payload['replyAuthorUserId'];
  const replyBodyText = payload['replyBodyText'];

  if (
    typeof storyId !== 'string'
    || typeof storyOwnerUserId !== 'string'
    || typeof storyOwnerEmail !== 'string'
    || typeof replyAuthorUserId !== 'string'
    || typeof replyBodyText !== 'string'
  ) {
    return null;
  }

  return {
    storyId,
    storyOwnerUserId,
    storyOwnerEmail,
    replyAuthorUserId,
    replyBodyText,
  };
}

export class StoryReplyCreatedNotificationSubscriber {
  constructor(
    private readonly idempotencyStore: EventIdempotencyStore,
    private readonly emailService: EmailService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    if (!isStoryReplyCreatedEvent(event)) {
      return false;
    }

    const payload = mapStoryReplyCreatedPayload(event.payload);
    if (!payload) {
      throw new Error('story.reply.created payload is invalid');
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
      storyId: payload.storyId,
      storyOwnerUserId: payload.storyOwnerUserId,
      replyAuthorUserId: payload.replyAuthorUserId,
      replyBodyText: payload.replyBodyText,
    };

    try {
      await this.emailService.sendTemplate({
        recipient: payload.storyOwnerEmail,
        templateId: 'story_reply_received',
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
