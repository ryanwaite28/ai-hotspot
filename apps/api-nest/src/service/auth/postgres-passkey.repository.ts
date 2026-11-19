import {
  authQueries,
  type PasskeyCredentialRow,
  type QueryExecutor,
  type UserRow,
} from '../../db/queries/auth.queries';
import type { PasskeyRepository } from './passkey.service';
import type { UserRecord } from './auth.service';

interface PasskeyCredentialRecord {
  userId: string;
  credentialId: string;
  signCount: number;
  revoked: boolean;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    handle: row.handle,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    status: row.status,
    role: row.role,
    flaggedForReview: row.flagged_for_review,
    flaggedReason: row.flagged_reason,
    trialActivatedOnce: row.trial_activated_once,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    exportRequestedAt: row.export_requested_at,
    deactivatedAt: row.deactivated_at,
  };
}

export class PostgresPasskeyRepository implements PasskeyRepository {
  constructor(private readonly db: QueryExecutor) {}

  async getUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.selectUserById, [userId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapUser(result.rows[0]);
  }

  async createPasskeyChallenge(input: {
    userId: string;
    challengeType: 'registration' | 'authentication';
    challenge: string;
    expiresAtEpochSeconds: number;
  }): Promise<void> {
    await this.db.query(authQueries.insertPasskeyChallenge, [
      input.userId,
      input.challengeType,
      input.challenge,
      input.expiresAtEpochSeconds,
    ]);
  }

  async consumePasskeyChallenge(input: {
    userId: string;
    challengeType: 'registration' | 'authentication';
    challenge: string;
    currentEpochSeconds: number;
  }): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(authQueries.consumePasskeyChallenge, [
      input.userId,
      input.challengeType,
      input.challenge,
      input.currentEpochSeconds,
    ]);
    return result.rows.length === 1;
  }

  async createPasskeyCredential(input: {
    userId: string;
    credentialId: string;
    publicKey: string;
    signCount: number;
  }): Promise<void> {
    await this.db.query(authQueries.insertPasskeyCredential, [
      input.userId,
      input.credentialId,
      input.publicKey,
      input.signCount,
    ]);
  }

  async getPasskeyCredentialById(credentialId: string): Promise<PasskeyCredentialRecord | null> {
    const result = await this.db.query<PasskeyCredentialRow>(authQueries.selectPasskeyCredentialByCredentialId, [credentialId]);
    if (result.rows.length === 0) {
      return null;
    }

    return {
      userId: result.rows[0].user_id,
      credentialId: result.rows[0].credential_id,
      signCount: Number(result.rows[0].sign_count),
      revoked: result.rows[0].revoked_at !== null,
    };
  }

  async updatePasskeySignCount(input: { credentialId: string; signCount: number }): Promise<void> {
    await this.db.query(authQueries.updatePasskeyCredentialSignCount, [
      input.credentialId,
      input.signCount,
    ]);
  }
}
