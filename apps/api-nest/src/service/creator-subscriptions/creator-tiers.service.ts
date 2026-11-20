import crypto from 'node:crypto';

import type {
  ArchiveCreatorTierInput,
  CreatorTierView,
  CreateCreatorTierInput,
  UpdateCreatorTierInput,
} from '../../../../../packages/contracts/src';
import type { CreatorTiersRepository } from './creator-tiers.repository';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class CreatorTiersService {
  constructor(private readonly repository: CreatorTiersRepository) {}

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (normalized.length === 0) {
      throw new Error('Creator tier name is required');
    }
    if (normalized.length > 100) {
      throw new Error('Creator tier name exceeds maximum length');
    }
    return normalized;
  }

  private normalizeDescription(description?: string): string | undefined {
    if (description === undefined) {
      return undefined;
    }
    const normalized = description.trim();
    if (normalized.length > 2000) {
      throw new Error('Creator tier description exceeds maximum length');
    }
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeMonthlyCents(monthlyCents: number): number {
    if (!Number.isInteger(monthlyCents) || monthlyCents <= 0) {
      throw new Error('Creator tier monthlyCents must be a positive integer');
    }
    return monthlyCents;
  }

  private normalizeSubscriberLimit(subscriberLimit?: number): number | undefined {
    if (subscriberLimit === undefined) {
      return undefined;
    }
    if (!Number.isInteger(subscriberLimit) || subscriberLimit < 0) {
      throw new Error('Creator tier subscriberLimit must be a non-negative integer');
    }
    return subscriberLimit;
  }

  private normalizeCurrency(currency?: string): string {
    const normalized = (currency ?? 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new Error('Creator tier currency must be a three-letter code');
    }
    return normalized;
  }

  async createTier(input: CreateCreatorTierInput): Promise<CreatorTierView | null> {
    const description = this.normalizeDescription(input.description);
    return this.repository.createTier({
      actorUserId: input.actorUserId,
      name: this.normalizeName(input.name),
      description,
      monthlyCents: this.normalizeMonthlyCents(input.monthlyCents),
      currency: this.normalizeCurrency(input.currency),
      recurringInterval: input.recurringInterval ?? 'monthly',
      subscriberLimit: this.normalizeSubscriberLimit(input.subscriberLimit),
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async updateTier(input: UpdateCreatorTierInput): Promise<CreatorTierView | null> {
    if (input.name !== undefined) {
      input = { ...input, name: this.normalizeName(input.name) };
    }
    if (input.description !== undefined) {
      input = { ...input, description: this.normalizeDescription(input.description) };
    }
    if (input.monthlyCents !== undefined) {
      input = { ...input, monthlyCents: this.normalizeMonthlyCents(input.monthlyCents) };
    }
    if (input.currency !== undefined) {
      input = { ...input, currency: this.normalizeCurrency(input.currency) };
    }
    if (input.subscriberLimit !== undefined) {
      const normalized = this.normalizeSubscriberLimit(input.subscriberLimit);
      input = { ...input, subscriberLimit: normalized };
    }

    return this.repository.updateTier({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }

  async archiveTier(input: ArchiveCreatorTierInput): Promise<CreatorTierView | null> {
    return this.repository.archiveTier({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: nowEpochSeconds(),
    });
  }
}
