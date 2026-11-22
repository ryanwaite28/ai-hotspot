import type { CampaignEntitlementPort } from './campaign-entitlement.port';

export class InMemoryCampaignEntitlementPort implements CampaignEntitlementPort {
  constructor(private readonly allowedUserIds: ReadonlySet<string>) {}

  async canCreatePaidCampaign(input: {
    actorUserId: string;
    nowEpochSeconds: number;
  }): Promise<{ allowed: boolean; source: 'platform_tier' | 'trial' | 'none' }> {
    if (this.allowedUserIds.has(input.actorUserId)) {
      return { allowed: true, source: 'platform_tier' };
    }
    return { allowed: false, source: 'none' };
  }
}
