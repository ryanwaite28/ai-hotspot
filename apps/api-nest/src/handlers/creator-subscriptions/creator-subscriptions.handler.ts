import type {
  CancelCreatorSubscriptionInput,
  StartCreatorSubscriptionCheckoutInput,
  UpdateCreatorSubscriptionWebhookInput,
  CanAccessCreatorTierInput,
} from '../../../../../packages/contracts/src';
import type { CreatorSubscriptionsService } from '../../service/creator-subscriptions/creator-subscriptions.service';

export class CreatorSubscriptionsHandler {
  constructor(private readonly service: CreatorSubscriptionsService) {}

  async startCheckout(
    actorUserId: string,
    body: Omit<StartCreatorSubscriptionCheckoutInput, 'actorUserId'>,
  ) {
    return this.service.startCheckout({ actorUserId, ...body });
  }

  async cancelSubscription(
    actorUserId: string,
    body: Omit<CancelCreatorSubscriptionInput, 'actorUserId'>,
  ) {
    return this.service.cancelSubscription({ actorUserId, ...body });
  }

  async processWebhookUpdate(
    subscriberUserId: string,
    creatorUserId: string,
    creatorTierId: string,
    body: Omit<UpdateCreatorSubscriptionWebhookInput, 'subscriberUserId' | 'creatorUserId' | 'creatorTierId'>,
  ) {
    return this.service.processWebhookUpdate({
      subscriberUserId,
      creatorUserId,
      creatorTierId,
      ...body,
    });
  }

  async canAccessTier(
    viewerUserId: string,
    body: Omit<CanAccessCreatorTierInput, 'viewerUserId'>,
  ) {
    return this.service.canAccessTier({ viewerUserId, ...body });
  }
}
