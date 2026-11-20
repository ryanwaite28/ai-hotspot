import type { DomainEventEnvelope } from '../../../packages/contracts/src/domain-events';
import type { JsonObject } from '../../../packages/contracts/src/json-types';
import type { EmailService } from '../email/email-service.adapter';
import type { EventIdempotencyStore } from './event-idempotency.store';

interface TemplateRoute {
  eventTypes: string[];
  templateId: string;
  subscriberName: string;
}

const ROUTES: TemplateRoute[] = [
  { eventTypes: ['subscription.purchased'], templateId: 'subscription_purchased', subscriberName: 'subscription_purchased_email' },
  { eventTypes: ['subscription.renewed'], templateId: 'subscription_renewed', subscriberName: 'subscription_renewed_email' },
  { eventTypes: ['subscription.canceled'], templateId: 'subscription_canceled', subscriberName: 'subscription_canceled_email' },
  { eventTypes: ['billing.refund'], templateId: 'refund', subscriberName: 'billing_refund_email' },
  { eventTypes: ['campaign.approved'], templateId: 'campaign_approved', subscriberName: 'campaign_approved_email' },
  { eventTypes: ['campaign.rejected'], templateId: 'campaign_rejected', subscriberName: 'campaign_rejected_email' },
  { eventTypes: ['moderation.report.received'], templateId: 'report_received', subscriberName: 'moderation_report_received_email' },
  { eventTypes: ['moderation.action'], templateId: 'moderation_action', subscriberName: 'moderation_action_email' },
  { eventTypes: ['live.started'], templateId: 'live_stream_started', subscriberName: 'live_stream_started_email' },
];

export class TransactionalTemplateSubscriber {
  constructor(
    private readonly idempotencyStore: EventIdempotencyStore,
    private readonly emailService: EmailService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<boolean> {
    const route = ROUTES.find((item) => item.eventTypes.includes(event.eventType));
    if (!route) {
      return false;
    }

    const recipient = event.payload['recipientEmail'];
    if (typeof recipient !== 'string' || recipient.trim().length === 0) {
      throw new Error(`${event.eventType} payload is missing recipientEmail`);
    }

    const idempotencyInput = {
      subscriberName: route.subscriberName,
      eventId: event.eventId,
      eventType: event.eventType,
    };

    const accepted = await this.idempotencyStore.tryStartProcessing(idempotencyInput);
    if (!accepted) {
      return false;
    }

    try {
      await this.emailService.sendTemplate({
        recipient,
        templateId: route.templateId,
        templateParams: event.payload as JsonObject,
      });
      await this.idempotencyStore.markProcessed(idempotencyInput);
      return true;
    } catch (error) {
      await this.idempotencyStore.markFailed({
        ...idempotencyInput,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
