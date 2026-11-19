import {
  authQueries,
  type AuthSessionRow,
  type OutboxInsertRow,
  type QueryExecutor,
  type UserRow,
  type VerificationSessionInsertRow,
  type VerificationSessionLookupRow,
} from '../../db/queries/auth.queries';
import type { AuthRepository, UserRecord } from './auth.service';

function mapUserRow(row: UserRow): UserRecord {
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

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: QueryExecutor) {}

  async getUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.selectUserById, [userId]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapUserRow(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.selectUserByEmail, [email]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapUserRow(result.rows[0]);
  }

  async createPendingUser(
    input: {
      handle: string;
      email: string;
      displayName: string;
      passwordHash: string;
    },
    outbox: { eventId: string; occurredAtEpochSeconds: number },
  ): Promise<UserRecord> {
    const result = await this.db.query<UserRow>(authQueries.insertPendingUserWithOutbox, [
      input.handle,
      input.displayName,
      input.email,
      input.passwordHash,
      outbox.eventId,
      outbox.occurredAtEpochSeconds,
    ]);

    if (result.rows.length !== 1) {
      throw new Error('Failed to create pending user');
    }

    return mapUserRow(result.rows[0]);
  }

  async createSession(input: {
    userId: string;
    refreshTokenId: string;
    expiresAtEpochSeconds: number;
  }): Promise<void> {
    await this.db.query(authQueries.insertAuthSession, [
      input.userId,
      input.refreshTokenId,
      input.expiresAtEpochSeconds,
    ]);
  }

  async getSessionByRefreshTokenId(refreshTokenId: string): Promise<{
    userId: string;
    revoked: boolean;
    expiresAtEpochSeconds: number;
  } | null> {
    const result = await this.db.query<AuthSessionRow>(authQueries.selectAuthSessionByRefreshTokenId, [refreshTokenId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      revoked: row.revoked_at !== null,
      expiresAtEpochSeconds: Math.floor(new Date(row.expires_at).getTime() / 1000),
    };
  }

  async revokeSessionByRefreshTokenId(refreshTokenId: string): Promise<void> {
    await this.db.query(authQueries.revokeAuthSessionByRefreshTokenId, [refreshTokenId]);
  }

  async activateUserByVerification(userId: string, email: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.activateUserByVerification, [userId, email]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapUserRow(result.rows[0]);
  }

  async applyVerificationCallback(input: {
    provider: string;
    eventId: string;
    userId: string;
    providerSessionRef: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
    failureCode?: string;
    payloadHash: string;
  }): Promise<{
    processed: boolean;
    duplicate: boolean;
    user: UserRecord;
    identityVerificationStatus: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  } | null> {
    const callbackEvent = await this.db.query<{ id: string }>(authQueries.insertVerificationCallbackEvent, [
      input.provider,
      input.eventId,
      input.userId,
      input.providerSessionRef,
      input.status,
      input.payloadHash,
    ]);

    if (callbackEvent.rows.length === 0) {
      const user = await this.getUserById(input.userId);
      if (!user) {
        return null;
      }
      return {
        processed: false,
        duplicate: true,
        user,
        identityVerificationStatus: input.status,
      };
    }

    const verificationSession = await this.db.query<VerificationSessionLookupRow>(
      authQueries.selectVerificationSessionByProviderRef,
      [input.provider, input.providerSessionRef, input.userId],
    );

    if (verificationSession.rows.length === 0) {
      return null;
    }

    await this.db.query(authQueries.updateVerificationSessionStatus, [
      verificationSession.rows[0].id,
      input.status,
      input.failureCode ?? null,
    ]);

    const updatedUser = await this.db.query<UserRow>(authQueries.updateUserIdentityVerificationStatus, [
      input.userId,
      input.status,
      input.providerSessionRef,
    ]);

    if (updatedUser.rows.length === 0) {
      return null;
    }

    return {
      processed: true,
      duplicate: false,
      user: mapUserRow(updatedUser.rows[0]),
      identityVerificationStatus: input.status,
    };
  }

  async createVerificationSession(input: {
    userId: string;
    provider: string;
    providerSessionRef: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
    expiresAtEpochSeconds: number;
  }): Promise<{
    verificationSessionId: string;
    providerSessionRef: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  }> {
    const result = await this.db.query<VerificationSessionInsertRow>(authQueries.insertVerificationSession, [
      input.userId,
      input.provider,
      input.providerSessionRef,
      input.status,
      input.expiresAtEpochSeconds,
    ]);

    if (result.rows.length !== 1 || !result.rows[0].provider_session_ref) {
      throw new Error('Failed to create verification session');
    }

    return {
      verificationSessionId: result.rows[0].id,
      providerSessionRef: result.rows[0].provider_session_ref,
      status: result.rows[0].status,
    };
  }

  async enqueueUserEmailResetRequestedEvent(input: {
    userId: string;
    email: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<boolean> {
    const result = await this.db.query<OutboxInsertRow>(authQueries.insertUserEmailResetRequestedOutbox, [
      input.eventId,
      input.userId,
      input.email,
      input.occurredAtEpochSeconds,
    ]);
    return result.rows.length === 1;
  }

  async updateUserProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.updateUserProfileWithOutbox, [
      input.userId,
      input.handle ?? null,
      input.displayName ?? null,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async suspendUser(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.suspendUserWithOutbox, [
      input.userId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async flagUserForReview(input: {
    userId: string;
    reason: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.flagUserForReviewWithOutbox, [
      input.userId,
      input.reason,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async activateTrialEntitlementOnce(input: {
    userId: string;
    durationSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.activateTrialEntitlementOnceWithOutbox, [
      input.userId,
      input.durationSeconds,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async requestAccountExport(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.requestAccountExportWithOutbox, [
      input.userId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async deactivateUser(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.deactivateUserWithOutbox, [
      input.userId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }

  async markUserDeleted(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(authQueries.markUserDeletedWithOutbox, [
      input.userId,
      input.eventId,
      input.occurredAtEpochSeconds,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return mapUserRow(result.rows[0]);
  }
}
