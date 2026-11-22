export interface CampaignEntitlementPort {
  canCreatePaidCampaign(input: {
    actorUserId: string;
    nowEpochSeconds: number;
  }): Promise<{ allowed: boolean; source: 'platform_tier' | 'trial' | 'none' }>;
}
