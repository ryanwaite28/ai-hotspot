import type {
  IdentityVerificationProviderAdapter,
} from './auth.service';

export interface IdentityVerificationProviderConfig {
  defaultProvider: string;
  sessionTtlSeconds: number;
  initialStatus: 'pending' | 'in_review';
}

export class StaticIdentityVerificationProviderAdapter implements IdentityVerificationProviderAdapter {
  constructor(private readonly config: IdentityVerificationProviderConfig) {}

  async createSession(input: {
    userId: string;
    provider: string;
  }): Promise<{
    providerSessionRef: string;
    status: 'pending' | 'in_review';
    expiresAtEpochSeconds: number;
  }> {
    if (input.provider !== this.config.defaultProvider) {
      throw new Error(`Unsupported identity verification provider: ${input.provider}`);
    }

    const now = Math.floor(Date.now() / 1000);
    return {
      providerSessionRef: `${input.provider}:${input.userId}:${crypto.randomUUID()}`,
      status: this.config.initialStatus,
      expiresAtEpochSeconds: now + this.config.sessionTtlSeconds,
    };
  }
}
