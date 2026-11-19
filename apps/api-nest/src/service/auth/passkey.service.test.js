const assert = require('node:assert/strict');
const test = require('node:test');

const { PasskeyService } = require('./passkey.service.js');

test('PasskeyService registration/authentication flow', async () => {
  const challenges = new Map();
  const credentials = new Map();

  const repository = {
    async getUserById(userId) {
      if (userId !== 'user-123') {
        return null;
      }
      return {
        id: 'user-123',
        handle: 'ryan',
        email: 'ryan@rmwhs.com',
        displayName: 'Ryan Waite',
        passwordHash: 'hashed',
        status: 'active',
        role: 'user',
      };
    },
    async createPasskeyChallenge(input) {
      challenges.set(`${input.userId}:${input.challengeType}:${input.challenge}`, input.expiresAtEpochSeconds);
    },
    async consumePasskeyChallenge(input) {
      const key = `${input.userId}:${input.challengeType}:${input.challenge}`;
      const expiresAt = challenges.get(key);
      if (!expiresAt || expiresAt <= input.currentEpochSeconds) {
        return false;
      }
      challenges.delete(key);
      return true;
    },
    async createPasskeyCredential(input) {
      credentials.set(input.credentialId, {
        userId: input.userId,
        credentialId: input.credentialId,
        signCount: input.signCount,
        revoked: false,
      });
    },
    async getPasskeyCredentialById(credentialId) {
      return credentials.get(credentialId) ?? null;
    },
    async updatePasskeySignCount(input) {
      const existing = credentials.get(input.credentialId);
      if (!existing) {
        return;
      }
      credentials.set(input.credentialId, {
        ...existing,
        signCount: input.signCount,
      });
    },
  };

  const sessionIssuer = {
    async issueSessionTokens(userId) {
      return {
        accessToken: `access:${userId}`,
        refreshToken: `refresh:${userId}`,
        expiresInSeconds: 900,
      };
    },
  };

  const service = new PasskeyService(repository, sessionIssuer);

  const registrationStart = await service.startRegistration('user-123');
  assert.ok(registrationStart?.challenge);

  const registrationComplete = await service.finishRegistration(
    {
      userId: 'user-123',
      challenge: registrationStart.challenge,
      credentialId: 'cred-1',
      attestationResponse: 'attestation',
    },
    {
      async verifyRegistration() {
        return {
          publicKey: 'public-key-1',
          signCount: 1,
        };
      },
      async verifyAuthentication() {
        return { newSignCount: 2 };
      },
    }
  );

  assert.equal(registrationComplete, true);

  const authenticationStart = await service.startAuthentication('user-123');
  assert.ok(authenticationStart?.challenge);

  const authenticationComplete = await service.finishAuthentication(
    {
      userId: 'user-123',
      challenge: authenticationStart.challenge,
      credentialId: 'cred-1',
      assertionResponse: 'assertion',
    },
    {
      async verifyRegistration() {
        return {
          publicKey: 'unused',
          signCount: 0,
        };
      },
      async verifyAuthentication(input) {
        assert.equal(input.expectedSignCount, 1);
        return { newSignCount: 2 };
      },
    }
  );

  assert.equal(authenticationComplete?.accessToken, 'access:user-123');
  assert.equal(authenticationComplete?.refreshToken, 'refresh:user-123');

  const replay = await service.finishAuthentication(
    {
      userId: 'user-123',
      challenge: authenticationStart.challenge,
      credentialId: 'cred-1',
      assertionResponse: 'assertion',
    },
    {
      async verifyRegistration() {
        return {
          publicKey: 'unused',
          signCount: 0,
        };
      },
      async verifyAuthentication() {
        return { newSignCount: 3 };
      },
    }
  );

  assert.equal(replay, null);
});
