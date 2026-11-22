import { createEmailVerificationToken, verifyEmailVerificationToken } from '../../../../../packages/auth/src/email-verification';
import {
  hashVerificationCallbackPayload,
  verifyVerificationCallbackSignature,
} from '../../../../../packages/auth/src/verification-callback';
import { hashPassword } from '../../../../../packages/auth/src/password.js';
import { issueJwt, verifyJwt } from '../../../../../packages/auth/src/jwt.js';
import type {
  RegisterUserResult,
  SessionTokens,
  StartVerificationInput,
  StartVerificationResult,
  VerificationCallbackInput,
  VerificationCallbackResult,
  VerificationStatus,
} from '../../../../../packages/contracts/src/index';

export interface RegisterUserInput {
  handle: string;
  email: string;
  password: string;
  displayName: string;
}

export interface UserRecord {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deactivated' | 'deleted';
  role: 'user' | 'moderator' | 'admin';
  flaggedForReview: boolean;
  flaggedReason: string | null;
  trialActivatedOnce: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  exportRequestedAt: string | null;
  deactivatedAt: string | null;
}

export interface AuthRepository {
  createPendingUser(
    input: {
      handle: string;
      email: string;
      displayName: string;
      passwordHash: string;
    },
    outbox: { eventId: string; occurredAtEpochSeconds: number },
  ): Promise<UserRecord>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserByHandle?(handle: string): Promise<UserRecord | null>;
  createSession(input: {
    userId: string;
    refreshTokenId: string;
    expiresAtEpochSeconds: number;
  }): Promise<void>;
  getSessionByRefreshTokenId(refreshTokenId: string): Promise<{
    userId: string;
    revoked: boolean;
    expiresAtEpochSeconds: number;
  } | null>;
  revokeSessionByRefreshTokenId(refreshTokenId: string): Promise<void>;
  activateUserByVerification(userId: string, email: string): Promise<UserRecord | null>;
  applyVerificationCallback(input: {
    provider: string;
    eventId: string;
    userId: string;
    providerSessionRef: string;
    status: VerificationStatus;
    failureCode?: string;
    payloadHash: string;
  }): Promise<{
    processed: boolean;
    duplicate: boolean;
    user: UserRecord;
    identityVerificationStatus: VerificationStatus;
  } | null>;
  createVerificationSession(input: {
    userId: string;
    provider: string;
    providerSessionRef: string;
    status: VerificationStatus;
    expiresAtEpochSeconds: number;
  }): Promise<{
    verificationSessionId: string;
    providerSessionRef: string;
    status: VerificationStatus;
  }>;
  enqueueUserEmailResetRequestedEvent(input: {
    userId: string;
    email: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<boolean>;
  updateUserProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  suspendUser(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  flagUserForReview(input: {
    userId: string;
    reason: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  activateTrialEntitlementOnce(input: {
    userId: string;
    durationSeconds: number;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  requestAccountExport(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  deactivateUser(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
  markUserDeleted(input: {
    userId: string;
    eventId: string;
    occurredAtEpochSeconds: number;
  }): Promise<UserRecord | null>;
}

export interface IdentityVerificationProviderAdapter {
  createSession(input: {
    userId: string;
    provider: string;
  }): Promise<{
    providerSessionRef: string;
    status: VerificationStatus;
    expiresAtEpochSeconds: number;
  }>;
}

export class DuplicateUserError extends Error {
  constructor() {
    super('A user with this handle or email already exists');
    this.name = 'DuplicateUserError';
  }
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly emailVerificationSecret: string,
    private readonly jwtSigningSecret: string,
    private readonly verificationCallbackSecret: string,
  ) {}

  private isAccountEligibleForSession(status: UserRecord['status']): boolean {
    return status === 'active';
  }

  private isAccountEligibleForIdentityVerification(status: UserRecord['status']): boolean {
    return status !== 'suspended' && status !== 'deactivated' && status !== 'deleted';
  }

  async registerUser(input: RegisterUserInput): Promise<RegisterUserResult & { verificationToken: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedHandle = input.handle.trim().toLowerCase();

    if (await this.repository.getUserByHandle?.(normalizedHandle)) {
      throw new DuplicateUserError();
    }
    if (await this.repository.getUserByEmail(normalizedEmail)) {
      throw new DuplicateUserError();
    }

    const now = Math.floor(Date.now() / 1000);
    const created = await this.repository.createPendingUser(
      {
        handle: normalizedHandle,
        email: normalizedEmail,
        displayName: input.displayName.trim(),
        passwordHash: await hashPassword(input.password),
      },
      {
        eventId: crypto.randomUUID(),
        occurredAtEpochSeconds: now,
      },
    );

    const verificationToken = createEmailVerificationToken(
      {
        userId: created.id,
        email: created.email,
        issuedAtEpochSeconds: now,
        expiresAtEpochSeconds: now + 60 * 60,
      },
      this.emailVerificationSecret,
    );

    return {
      userId: created.id,
      email: created.email,
      status: created.status,
      verificationToken,
    };
  }

  async issueSessionTokens(userId: string): Promise<SessionTokens> {
    const user = await this.repository.getUserById(userId);
    if (!user || !this.isAccountEligibleForSession(user.status)) {
      throw new Error('Account is not eligible for session issuance');
    }

    const now = Math.floor(Date.now() / 1000);
    const refreshTokenId = crypto.randomUUID();
    const refreshExpiry = now + 60 * 60 * 24 * 14;

    await this.repository.createSession({
      userId,
      refreshTokenId,
      expiresAtEpochSeconds: refreshExpiry,
    });

    const accessToken = issueJwt(
      {
        sub: user.id,
        tokenType: 'access',
        role: user.role,
      },
      this.jwtSigningSecret,
      '15m',
    );

    const refreshToken = issueJwt(
      {
        sub: user.id,
        tokenType: 'refresh',
        jti: refreshTokenId,
        role: user.role,
      },
      this.jwtSigningSecret,
      '14d',
    );

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 900,
    };
  }

  async rotateRefreshToken(refreshToken: string): Promise<SessionTokens | null> {
    const decoded = verifyJwt(refreshToken, this.jwtSigningSecret) as { sub?: string; tokenType?: string; jti?: string } | null;
    if (!decoded || decoded.tokenType !== 'refresh' || !decoded.sub || !decoded.jti) {
      return null;
    }

    const session = await this.repository.getSessionByRefreshTokenId(decoded.jti);
    if (!session || session.revoked) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAtEpochSeconds < now) {
      return null;
    }

    const user = await this.repository.getUserById(decoded.sub);
    if (!user || !this.isAccountEligibleForSession(user.status)) {
      await this.repository.revokeSessionByRefreshTokenId(decoded.jti);
      return null;
    }

    await this.repository.revokeSessionByRefreshTokenId(decoded.jti);
    return this.issueSessionTokens(user.id);
  }

  async verifyEmailToken(token: string): Promise<{ userId: string; status: UserRecord['status'] } | null> {
    const payload = verifyEmailVerificationToken(token, this.emailVerificationSecret);
    if (!payload) {
      return null;
    }

    const activated = await this.repository.activateUserByVerification(payload.userId, payload.email);
    if (!activated) {
      return null;
    }

    if (activated.status === 'active') {
      await this.repository.activateTrialEntitlementOnce({
        userId: activated.id,
        durationSeconds: 60 * 60 * 24 * 7,
        eventId: crypto.randomUUID(),
        occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
      });
    }

    return {
      userId: activated.id,
      status: activated.status,
    };
  }

  async requestEmailReset(input: { email: string }): Promise<{ accepted: boolean }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.repository.getUserByEmail(normalizedEmail);
    if (!user) {
      return { accepted: true };
    }

    if (user.status === 'deleted' || user.status === 'deactivated') {
      return { accepted: true };
    }

    await this.repository.enqueueUserEmailResetRequestedEvent({
      userId: user.id,
      email: user.email,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    return { accepted: true };
  }

  async startIdentityVerification(
    input: StartVerificationInput,
    adapter: IdentityVerificationProviderAdapter,
  ): Promise<StartVerificationResult | null> {
    const user = await this.repository.getUserById(input.userId);
    if (!user || !this.isAccountEligibleForIdentityVerification(user.status)) {
      return null;
    }

    const providerSession = await adapter.createSession({
      userId: input.userId,
      provider: input.provider,
    });

    return this.repository.createVerificationSession({
      userId: input.userId,
      provider: input.provider,
      providerSessionRef: providerSession.providerSessionRef,
      status: providerSession.status,
      expiresAtEpochSeconds: providerSession.expiresAtEpochSeconds,
    });
  }

  async processVerificationCallback(input: VerificationCallbackInput): Promise<VerificationCallbackResult | null> {
    const payload = {
      provider: input.provider,
      eventId: input.eventId,
      userId: input.userId,
      providerSessionRef: input.providerSessionRef,
      status: input.status,
      failureCode: input.failureCode,
    };

    const hasValidSignature = verifyVerificationCallbackSignature(
      payload,
      input.signature,
      this.verificationCallbackSecret,
    );

    if (!hasValidSignature) {
      return null;
    }

    const applied = await this.repository.applyVerificationCallback({
      ...payload,
      payloadHash: hashVerificationCallbackPayload(payload),
    });

    if (!applied) {
      return null;
    }

    return {
      processed: applied.processed,
      duplicate: applied.duplicate,
      userId: applied.user.id,
      userStatus: applied.user.status,
      identityVerificationStatus: applied.identityVerificationStatus,
    };
  }

  async updateUserProfile(input: {
    userId: string;
    handle?: string;
    displayName?: string;
  }): Promise<{ userId: string; status: UserRecord['status'] } | null> {
    const updated = await this.repository.updateUserProfile({
      userId: input.userId,
      handle: input.handle?.trim().toLowerCase(),
      displayName: input.displayName?.trim(),
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!updated) {
      return null;
    }

    return {
      userId: updated.id,
      status: updated.status,
    };
  }

  async suspendUser(input: { userId: string }): Promise<{ userId: string; status: UserRecord['status'] } | null> {
    const suspended = await this.repository.suspendUser({
      userId: input.userId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!suspended) {
      return null;
    }

    return {
      userId: suspended.id,
      status: suspended.status,
    };
  }

  async flagUserForReview(input: { userId: string; reason: string }): Promise<{ userId: string; flagged: boolean } | null> {
    const flagged = await this.repository.flagUserForReview({
      userId: input.userId,
      reason: input.reason.trim(),
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!flagged) {
      return null;
    }

    return {
      userId: flagged.id,
      flagged: flagged.flaggedForReview,
    };
  }

  async requestAccountExport(input: { userId: string }): Promise<{ userId: string; accepted: boolean } | null> {
    const requested = await this.repository.requestAccountExport({
      userId: input.userId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!requested) {
      return null;
    }

    return {
      userId: requested.id,
      accepted: true,
    };
  }

  async deactivateAccount(input: { userId: string }): Promise<{ userId: string; status: UserRecord['status'] } | null> {
    const deactivated = await this.repository.deactivateUser({
      userId: input.userId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!deactivated) {
      return null;
    }

    return {
      userId: deactivated.id,
      status: deactivated.status,
    };
  }

  async deleteAccount(input: { userId: string }): Promise<{ userId: string; status: UserRecord['status'] } | null> {
    const deleted = await this.repository.markUserDeleted({
      userId: input.userId,
      eventId: crypto.randomUUID(),
      occurredAtEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!deleted) {
      return null;
    }

    return {
      userId: deleted.id,
      status: deleted.status,
    };
  }
}
