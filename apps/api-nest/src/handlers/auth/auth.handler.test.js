const assert = require('node:assert/strict');
const test = require('node:test');

const { AuthHandler } = require('./auth.handler');

test('AuthHandler delegates transport calls to service adapters', async () => {
  const calls = [];

  const authService = {
    async registerUser(input) {
      calls.push(['registerUser', input]);
      return { ok: true };
    },
    async verifyEmailToken(token) {
      calls.push(['verifyEmailToken', token]);
      return { token };
    },
    async updateUserProfile(input) {
      calls.push(['updateUserProfile', input]);
      return { userId: input.userId, status: 'active' };
    },
    async suspendUser(input) {
      calls.push(['suspendUser', input]);
      return { userId: input.userId, status: 'suspended' };
    },
    async flagUserForReview(input) {
      calls.push(['flagUserForReview', input]);
      return { userId: input.userId, flagged: true };
    },
    async requestAccountExport(input) {
      calls.push(['requestAccountExport', input]);
      return { userId: input.userId, accepted: true };
    },
    async deactivateAccount(input) {
      calls.push(['deactivateAccount', input]);
      return { userId: input.userId, status: 'deactivated' };
    },
    async deleteAccount(input) {
      calls.push(['deleteAccount', input]);
      return { userId: input.userId, status: 'deleted' };
    },
    async startIdentityVerification(input, adapter) {
      calls.push(['startIdentityVerification', input, adapter]);
      return { started: true };
    },
    async processVerificationCallback(input) {
      calls.push(['processVerificationCallback', input]);
      return { processed: true };
    },
  };

  const identityProvider = {
    async createSession() {
      return { providerSessionRef: 'x', status: 'pending', expiresAtEpochSeconds: 1 };
    },
  };

  const passkeyService = {
    async startRegistration(userId) {
      calls.push(['startRegistration', userId]);
      return { challenge: 'c' };
    },
    async finishRegistration(input, verifier) {
      calls.push(['finishRegistration', input, verifier]);
      return true;
    },
    async startAuthentication(userId) {
      calls.push(['startAuthentication', userId]);
      return { challenge: 'c2' };
    },
    async finishAuthentication(input, verifier) {
      calls.push(['finishAuthentication', input, verifier]);
      return { accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900 };
    },
  };

  const passkeyVerifier = {
    async verifyRegistration() {
      return { publicKey: 'pk', signCount: 1 };
    },
    async verifyAuthentication() {
      return { newSignCount: 2 };
    },
  };

  const handler = new AuthHandler(authService, identityProvider, passkeyService, passkeyVerifier);

  await handler.register({ handle: 'h', email: 'e', password: 'p', displayName: 'd' });
  await handler.verifyEmail({ token: 't' });
  await handler.updateUserProfile({ userId: 'u', handle: 'new-handle', displayName: 'New Name' });
  await handler.suspendUser({ userId: 'u' });
  await handler.flagUserForReview({ userId: 'u', reason: 'risk rule' });
  await handler.requestAccountExport({ userId: 'u' });
  await handler.deactivateAccount({ userId: 'u' });
  await handler.deleteAccount({ userId: 'u' });
  await handler.startIdentityVerification({ userId: 'u', provider: 'persona' });
  await handler.processIdentityVerificationCallback({
    provider: 'persona',
    eventId: 'evt-1',
    userId: 'u',
    providerSessionRef: 's',
    status: 'pending',
    signature: 'sig',
  });
  await handler.startPasskeyRegistration({ userId: 'u' });
  await handler.finishPasskeyRegistration({
    userId: 'u',
    challenge: 'c',
    credentialId: 'cred',
    attestationResponse: 'att',
  });
  await handler.startPasskeyAuthentication({ userId: 'u' });
  await handler.finishPasskeyAuthentication({
    userId: 'u',
    challenge: 'c2',
    credentialId: 'cred',
    assertionResponse: 'assert',
  });

  assert.equal(calls.length, 14);
  assert.equal(calls[0][0], 'registerUser');
  assert.equal(calls[1][0], 'verifyEmailToken');
  assert.equal(calls[2][0], 'updateUserProfile');
  assert.equal(calls[3][0], 'suspendUser');
  assert.equal(calls[4][0], 'flagUserForReview');
  assert.equal(calls[5][0], 'requestAccountExport');
  assert.equal(calls[6][0], 'deactivateAccount');
  assert.equal(calls[7][0], 'deleteAccount');
  assert.equal(calls[8][0], 'startIdentityVerification');
  assert.equal(calls[8][2], identityProvider);
  assert.equal(calls[9][0], 'processVerificationCallback');
  assert.equal(calls[10][0], 'startRegistration');
  assert.equal(calls[11][0], 'finishRegistration');
  assert.equal(calls[11][2], passkeyVerifier);
  assert.equal(calls[12][0], 'startAuthentication');
  assert.equal(calls[13][0], 'finishAuthentication');
  assert.equal(calls[13][2], passkeyVerifier);
});
