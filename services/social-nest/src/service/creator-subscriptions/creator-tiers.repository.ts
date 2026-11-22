import type {
  ArchiveCreatorTierInput,
  CreatorTierView,
  CreateCreatorTierInput,
  UpdateCreatorTierInput,
} from '../../../../../packages/contracts/src';

export interface CreatorTiersRepository {
  createTier(input: CreateCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null>;
  updateTier(input: UpdateCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null>;
  archiveTier(input: ArchiveCreatorTierInput & {
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<CreatorTierView | null>;
}
