const assert = require('node:assert/strict');
const test = require('node:test');

const { verifyEmailVerificationToken } = require('../../../../../packages/auth/src/email-verification');
const { signVerificationCallbackPayload } = require('../../../../../packages/auth/src/verification-callback');
const { verifyJwt } = require('../../../../../packages/auth/src/jwt.js');
const { AuthService } = require('./auth.service');

test('registerUser normalizes handle/email and returns signed verification token', async () => {
  const createdUsers = new Map();
  const sessions = new Map();
  const outboxEvents = [];

  const fakeRepo = {
    async createPendingUser(input, outbox) {
      createdUsers.set('user-123', {
        email: input.email,
        status: 'pending_verification',
        role: 'user',
      });
      outboxEvents.push({
        eventType: 'user.created',
        eventId: outbox.eventId,
        userId: 'user-123',
      });
      return {
        id: 'user-123',
        handle: input.handle,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: 'pending_verification',
        role: 'user',
      };
    },
    async getUserById(userId) {
      const existing = createdUsers.get(userId);
      if (!existing) {
        return null;
      }
      return {
        id: userId,
        handle: 'ryan',
        email: existing.email,
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: existing.status,
        role: existing.role,
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: false,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
    async createSession(input) {
      sessions.set(input.refreshTokenId, {
        userId: input.userId,
        revoked: false,
        expiresAtEpochSeconds: input.expiresAtEpochSeconds,
      });
    },
    async getSessionByRefreshTokenId(refreshTokenId) {
      return sessions.get(refreshTokenId) ?? null;
    },
    async revokeSessionByRefreshTokenId(refreshTokenId) {
      const existing = sessions.get(refreshTokenId);
      if (!existing) {
        return;
      }
      sessions.set(refreshTokenId, {
        ...existing,
        revoked: true,
      });
    },
    async activateUserByVerification(userId, email) {
      const existing = createdUsers.get(userId);
      if (!existing) {
        return null;
      }
      if (existing.email !== email) {
        return null;
      }
      createdUsers.set(userId, {
        ...existing,
        status: 'active',
      });
      return {
        id: userId,
        handle: 'ryan',
        email,
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: existing.role,
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: false,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
    async getUserByEmail(email) {
      if (email === 'ryan@rmwhs.com') {
        return {
          id: 'user-123',
          handle: 'ryan',
          email: 'ryan@rmwhs.com',
          displayName: 'Ryan Waite',
          passwordHash: 'hashed',
          status: 'active',
          role: 'user',
          flaggedForReview: false,
          flaggedReason: null,
          trialActivatedOnce: true,
          trialStartedAt: null,
          trialEndsAt: null,
          exportRequestedAt: null,
          deactivatedAt: null,
        };
      }
      return null;
    },
    async enqueueUserEmailResetRequestedEvent(input) {
      outboxEvents.push({
        eventType: 'user.email-reset-requested',
        eventId: input.eventId,
        userId: input.userId,
      });
      return true;
    },
    async applyVerificationCallback(input) {
      const existing = createdUsers.get(input.userId);
      if (!existing) {
        return null;
      }
      return {
        processed: input.eventId !== 'evt-dup',
        duplicate: input.eventId === 'evt-dup',
        user: {
          id: input.userId,
          handle: 'ryan',
          email: existing.email,
          displayName: 'Ryan Waite',
          passwordHash: 'hashed',
          status: input.status === 'approved' ? 'active' : existing.status,
          role: existing.role,
          flaggedForReview: false,
          flaggedReason: null,
          trialActivatedOnce: true,
          trialStartedAt: null,
          trialEndsAt: null,
          exportRequestedAt: null,
          deactivatedAt: null,
        },
        identityVerificationStatus: input.status,
      };
    },
    async createVerificationSession(input) {
      return {
        verificationSessionId: 'verif-1',
        providerSessionRef: input.providerSessionRef,
        status: input.status,
      };
    },
    async updateUserProfile(input) {
      outboxEvents.push({
        eventType: 'user.updated',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: input.handle ?? 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: input.displayName ?? 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
    async suspendUser(input) {
      outboxEvents.push({
        eventType: 'user.suspended',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'suspended',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: Math.floor(Date.now() / 1000).toString(),
      };
    },
    async flagUserForReview(input) {
      outboxEvents.push({
        eventType: 'user.flagged',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: 'user',
        flaggedForReview: true,
        flaggedReason: input.reason,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
    async activateTrialEntitlementOnce(input) {
      outboxEvents.push({
        eventType: 'user.trial-activated',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
    async requestAccountExport(input) {
      outboxEvents.push({
        eventType: 'user.export-requested',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: Math.floor(Date.now() / 1000).toString(),
        deactivatedAt: null,
      };
    },
    async deactivateUser(input) {
      outboxEvents.push({
        eventType: 'user.deactivated',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'deactivated',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: Math.floor(Date.now() / 1000).toString(),
      };
    },
    async markUserDeleted(input) {
      outboxEvents.push({
        eventType: 'user.deleted',
        eventId: input.eventId,
        userId: input.userId,
      });
      return {
        id: input.userId,
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'deleted',
        role: 'user',
        flaggedForReview: false,
        flaggedReason: null,
        trialActivatedOnce: true,
        trialStartedAt: null,
        trialEndsAt: null,
        exportRequestedAt: null,
        deactivatedAt: null,
      };
    },
  };

  const service = new AuthService(fakeRepo, 'test-secret', 'jwt-secret', 'callback-secret');

  const result = await service.registerUser({
    handle: '  Ryan  ',
    email: '  RYAN@RMWHS.COM ',
    password: 'StrongPassword123!@#',
    displayName: 'Ryan Waite',
  });

  assert.equal(result.userId, 'user-123');
  assert.equal(result.email, 'ryan@rmwhs.com');
  assert.equal(result.status, 'pending_verification');
  assert.equal(outboxEvents[0].eventType, 'user.created');
  assert.equal(outboxEvents[0].userId, 'user-123');

  const payload = verifyEmailVerificationToken(result.verificationToken, 'test-secret');
  assert.ok(payload);
  assert.equal(payload?.userId, 'user-123');
  assert.equal(payload?.email, 'ryan@rmwhs.com');

  const verified = await service.verifyEmailToken(result.verificationToken);
  assert.ok(verified);
  assert.equal(verified?.userId, 'user-123');
  assert.equal(verified?.status, 'active');
  assert.equal(outboxEvents[1].eventType, 'user.trial-activated');

  const tokens = await service.issueSessionTokens('user-123');
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.equal(tokens.expiresInSeconds, 900);

  const accessPayload = verifyJwt(tokens.accessToken, 'jwt-secret');
  assert.equal(accessPayload?.sub, 'user-123');
  assert.equal(accessPayload?.tokenType, 'access');
  assert.equal(accessPayload?.role, 'user');

  const refreshed = await service.rotateRefreshToken(tokens.refreshToken);
  assert.ok(refreshed);
  assert.notEqual(refreshed?.refreshToken, tokens.refreshToken);

  const replayAttempt = await service.rotateRefreshToken(tokens.refreshToken);
  assert.equal(replayAttempt, null);

  createdUsers.set('user-123', {
    email: 'ryan@rmwhs.com',
    status: 'suspended',
    role: 'user',
  });

  await assert.rejects(
    service.issueSessionTokens('user-123'),
    /Account is not eligible for session issuance/
  );

  const callbackPayload = {
    provider: 'persona',
    eventId: 'evt-1',
    userId: 'user-123',
    providerSessionRef: 'session-abc',
    status: 'approved',
  };

  const callbackResult = await service.processVerificationCallback({
    ...callbackPayload,
    signature: signVerificationCallbackPayload(callbackPayload, 'callback-secret'),
  });

  assert.equal(callbackResult?.processed, true);
  assert.equal(callbackResult?.duplicate, false);
  assert.equal(callbackResult?.userId, 'user-123');
  assert.equal(callbackResult?.identityVerificationStatus, 'approved');

  const duplicateResult = await service.processVerificationCallback({
    ...callbackPayload,
    eventId: 'evt-dup',
    signature: signVerificationCallbackPayload({ ...callbackPayload, eventId: 'evt-dup' }, 'callback-secret'),
  });
  assert.equal(duplicateResult?.processed, false);
  assert.equal(duplicateResult?.duplicate, true);

  const invalidSignatureResult = await service.processVerificationCallback({
    ...callbackPayload,
    eventId: 'evt-invalid',
    signature: 'deadbeef',
  });
  assert.equal(invalidSignatureResult, null);

  createdUsers.set('user-123', {
    email: 'ryan@rmwhs.com',
    status: 'active',
    role: 'user',
  });

  const verificationStart = await service.startIdentityVerification(
    {
      userId: 'user-123',
      provider: 'persona',
    },
    {
      async createSession(input) {
        assert.equal(input.userId, 'user-123');
        assert.equal(input.provider, 'persona');
        return {
          providerSessionRef: 'persona-session-1',
          status: 'in_review',
          expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
        };
      },
    }
  );

  assert.equal(verificationStart?.verificationSessionId, 'verif-1');
  assert.equal(verificationStart?.providerSessionRef, 'persona-session-1');
  assert.equal(verificationStart?.status, 'in_review');

  createdUsers.set('user-123', {
    email: 'ryan@rmwhs.com',
    status: 'deleted',
    role: 'user',
  });

  const deletedUserVerificationStart = await service.startIdentityVerification(
    {
      userId: 'user-123',
      provider: 'persona',
    },
    {
      async createSession() {
        return {
          providerSessionRef: 'should-not-run',
          status: 'pending',
          expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
        };
      },
    }
  );

  assert.equal(deletedUserVerificationStart, null);

  const resetResult = await service.requestEmailReset({
    email: 'RYAN@RMWHS.COM',
  });
  assert.equal(resetResult.accepted, true);
  assert.equal(outboxEvents[2].eventType, 'user.email-reset-requested');

  const updatedProfile = await service.updateUserProfile({
    userId: 'user-123',
    handle: 'RyanUpdated',
    displayName: 'Ryan Updated',
  });
  assert.equal(updatedProfile?.userId, 'user-123');
  assert.equal(outboxEvents[3].eventType, 'user.updated');

  const suspendedUser = await service.suspendUser({ userId: 'user-123' });
  assert.equal(suspendedUser?.status, 'suspended');
  assert.equal(outboxEvents[4].eventType, 'user.suspended');

  const flaggedUser = await service.flagUserForReview({
    userId: 'user-123',
    reason: 'suspicious automation signals',
  });
  assert.equal(flaggedUser?.flagged, true);
  assert.equal(outboxEvents[5].eventType, 'user.flagged');

  const exportRequest = await service.requestAccountExport({ userId: 'user-123' });
  assert.equal(exportRequest?.accepted, true);
  assert.equal(outboxEvents[6].eventType, 'user.export-requested');

  const deactivated = await service.deactivateAccount({ userId: 'user-123' });
  assert.equal(deactivated?.status, 'deactivated');
  assert.equal(outboxEvents[7].eventType, 'user.deactivated');

  const deleted = await service.deleteAccount({ userId: 'user-123' });
  assert.equal(deleted?.status, 'deleted');
  assert.equal(outboxEvents[8].eventType, 'user.deleted');

  const unknownResetResult = await service.requestEmailReset({
    email: 'unknown@rmwhs.com',
  });
  assert.equal(unknownResetResult.accepted, true);
});
