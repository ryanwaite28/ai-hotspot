import {
  type EmailService,
  ConsoleEmailServiceAdapter,
} from './email/email-service.adapter';
import { runOutboxPublisher } from './outbox-publisher';
import {
  type EventIdempotencyStore,
  type SubscriberIdempotencyRepository,
  InMemoryEventIdempotencyStore,
  RepositoryEventIdempotencyStore,
} from './subscribers/event-idempotency.store';
import { NotificationSubscriberRouter } from './subscribers/notification-subscriber-router';
import { StoryReplyCreatedNotificationSubscriber } from './subscribers/story-reply-created-notification.subscriber';
import { UserCreatedEmailWelcomeSubscriber } from './subscribers/user-created-email-welcome.subscriber';
import { UserEmailResetRequestedSubscriber } from './subscribers/user-email-reset-requested.subscriber';
import {
  type StartNotificationConsumerInput,
  startNotificationConsumer,
} from './rabbitmq/notification-consumer';

export interface NotificationWorkerDependencies {
  emailService?: EmailService;
  idempotencyStore?: EventIdempotencyStore;
  subscriberIdempotencyRepository?: SubscriberIdempotencyRepository;
}

export function buildNotificationWorker(dependencies: NotificationWorkerDependencies = {}): {
  router: NotificationSubscriberRouter;
  runOutboxPublisher: typeof runOutboxPublisher;
  startConsumer: (input: Omit<StartNotificationConsumerInput, 'router'>) => Promise<{ close(): Promise<void> }>;
} {
  const emailService = dependencies.emailService ?? new ConsoleEmailServiceAdapter();
  const idempotencyStore =
    dependencies.idempotencyStore
    ?? (dependencies.subscriberIdempotencyRepository
      ? new RepositoryEventIdempotencyStore(dependencies.subscriberIdempotencyRepository)
      : new InMemoryEventIdempotencyStore());

  const router = new NotificationSubscriberRouter([
    new UserCreatedEmailWelcomeSubscriber(idempotencyStore, emailService),
    new UserEmailResetRequestedSubscriber(idempotencyStore, emailService),
    new StoryReplyCreatedNotificationSubscriber(idempotencyStore, emailService),
  ]);

  return {
    router,
    runOutboxPublisher,
    startConsumer: (input) => startNotificationConsumer({
      ...input,
      router,
    }),
  };
}
