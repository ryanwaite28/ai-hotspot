export interface LiveEntitlementPort {
  canStartLive(input: {
    actorUserId: string;
    nowEpochSeconds: number;
  }): Promise<{ allowed: boolean; source: 'platform_tier' | 'trial' | 'none' }>;
  canViewLive(input: {
    viewerUserId: string;
    creatorUserId: string;
    visibility: 'public' | 'followers' | 'subscribers';
  }): Promise<boolean>;
}
