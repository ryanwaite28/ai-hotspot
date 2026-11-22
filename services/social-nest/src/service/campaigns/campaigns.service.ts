import crypto from 'node:crypto';

import type {
  CampaignView,
  CreateCampaignInput,
  SubmitCampaignInput,
  UpdateCampaignStatusInput,
} from '../../../../../packages/contracts/src';
import type { CampaignEntitlementPort } from './campaign-entitlement.port';
import type { CampaignsRepository } from './campaigns.repository';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class CampaignsService {
  constructor(
    private readonly repository: CampaignsRepository,
    private readonly entitlementPort: CampaignEntitlementPort,
  ) {}

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (normalized.length === 0) {
      throw new Error('Campaign name is required');
    }
    if (normalized.length > 120) {
      throw new Error('Campaign name exceeds maximum length');
    }
    return normalized;
  }

  private normalizeCategory(category: string): string {
    const normalized = category.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new Error('Campaign category is required');
    }
    if (normalized.length > 80) {
      throw new Error('Campaign category exceeds maximum length');
    }
    return normalized;
  }

  private validateHttpsUrl(url: string, fieldName: string): string {
    const normalized = url.trim();
    if (!/^https:\/\//.test(normalized)) {
      throw new Error(`${fieldName} must use HTTPS`);
    }
    return normalized;
  }

  async createCampaign(input: CreateCampaignInput): Promise<CampaignView | null> {
    const now = nowEpochSeconds();
    const entitlement = await this.entitlementPort.canCreatePaidCampaign({
      actorUserId: input.actorUserId,
      nowEpochSeconds: now,
    });

    if (!entitlement.allowed) {
      throw new Error('ENTITLEMENT_REQUIRED');
    }

    if (!Number.isInteger(input.budgetCents) || input.budgetCents <= 0) {
      throw new Error('Campaign budgetCents must be a positive integer');
    }

    const startsAt = Date.parse(input.startsAt);
    if (!Number.isFinite(startsAt)) {
      throw new Error('Invalid campaign startsAt');
    }

    const endsAt = input.endsAt ? Date.parse(input.endsAt) : null;
    if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt <= startsAt)) {
      throw new Error('Campaign endsAt must be after startsAt');
    }

    const currency = (input.currency ?? 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Campaign currency must be a three-letter code');
    }

    return this.repository.createCampaign({
      ...input,
      name: this.normalizeName(input.name),
      currency,
      category: this.normalizeCategory(input.category),
      creativeUrl: this.validateHttpsUrl(input.creativeUrl, 'creativeUrl'),
      destinationUrl: this.validateHttpsUrl(input.destinationUrl, 'destinationUrl'),
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: now,
    });
  }

  async submitCampaign(input: SubmitCampaignInput): Promise<CampaignView | null> {
    return this.repository.submitCampaign({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async updateCampaignStatus(input: UpdateCampaignStatusInput): Promise<CampaignView | null> {
    if (input.status === 'rejected' && (!input.reason || input.reason.trim().length === 0)) {
      throw new Error('Campaign rejection reason is required');
    }
    return this.repository.updateCampaignStatus({
      ...input,
      reason: input.reason?.trim(),
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }
}
