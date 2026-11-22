const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signVerificationCallbackPayload } = require('../../../../../packages/auth/src/verification-callback');

function hasRuntimeDeps() {
  return Boolean(process.env.PHASE1_RUNTIME_INTEGRATION === '1');
}

function uniqueToken() {
  return crypto.randomUUID().slice(0, 8);
}

test('runtime integration: auth registration/verification/session lifecycle', { skip: !hasRuntimeDeps() }, async () => {
  // This test is intentionally runtime-gated. It should run in a Node-enabled environment
  // with real backing services (PostgreSQL + RabbitMQ) and migration state applied.
  const {
    createRuntimeAuthHarness,
    destroyRuntimeAuthHarness,
  } = require('./auth.runtime.integration.harness');

  const harness = await createRuntimeAuthHarness();

  try {
    const id = uniqueToken();
    const registration = await harness.handler.register({
      handle: `runtime_user_${id}`,
      email: `runtime_user_${id}@rmwhs.com`,
      password: 'StrongPassword123!@#',
      displayName: 'Runtime User',
    });

    assert.ok(registration.userId);
    assert.equal(registration.status, 'pending_verification');

    const verified = await harness.handler.verifyEmail({ token: registration.verificationToken });
    assert.equal(verified?.status, 'active');

    const tokens = await harness.service.issueSessionTokens(registration.userId);
    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);

    const rotated = await harness.service.rotateRefreshToken(tokens.refreshToken);
    assert.ok(rotated?.refreshToken);
  } finally {
    await destroyRuntimeAuthHarness(harness);
  }
});

test('runtime integration: auth mutation outbox events persisted', { skip: !hasRuntimeDeps() }, async () => {
  const {
    createRuntimeAuthHarness,
    destroyRuntimeAuthHarness,
  } = require('./auth.runtime.integration.harness');

  const harness = await createRuntimeAuthHarness();

  try {
    const id = uniqueToken();
    const registration = await harness.handler.register({
      handle: `runtime_events_${id}`,
      email: `runtime_events_${id}@rmwhs.com`,
      password: 'StrongPassword123!@#',
      displayName: 'Runtime Events',
    });

    await harness.handler.verifyEmail({ token: registration.verificationToken });
    await harness.handler.updateUserProfile({
      userId: registration.userId,
      handle: `runtime_events_updated_${id}`,
      displayName: 'Runtime Events Updated',
    });
    await harness.handler.flagUserForReview({
      userId: registration.userId,
      reason: 'runtime test flag',
    });
    await harness.handler.suspendUser({ userId: registration.userId });

    const eventTypes = await harness.listOutboxEventTypesForAggregate(registration.userId);

    assert.ok(eventTypes.includes('user.created'));
    assert.ok(eventTypes.includes('user.updated'));
    assert.ok(eventTypes.includes('user.flagged'));
    assert.ok(eventTypes.includes('user.suspended'));
  } finally {
    await destroyRuntimeAuthHarness(harness);
  }
});

test('runtime integration: identity verification start and signed callback processing', { skip: !hasRuntimeDeps() }, async () => {
  const {
    createRuntimeAuthHarness,
    destroyRuntimeAuthHarness,
  } = require('./auth.runtime.integration.harness');

  const harness = await createRuntimeAuthHarness();

  try {
    const id = uniqueToken();
    const registration = await harness.handler.register({
      handle: `runtime_verify_${id}`,
      email: `runtime_verify_${id}@rmwhs.com`,
      password: 'StrongPassword123!@#',
      displayName: 'Runtime Verify',
    });

    await harness.handler.verifyEmail({ token: registration.verificationToken });

    const started = await harness.handler.startIdentityVerification({
      userId: registration.userId,
      provider: 'persona',
    });

    assert.ok(started?.verificationSessionId);
    assert.ok(started?.providerSessionRef);

    const callbackPayload = {
      provider: 'persona',
      eventId: `evt-callback-${registration.userId}`,
      userId: registration.userId,
      providerSessionRef: started.providerSessionRef,
      status: 'approved',
    };

    const callback = await harness.handler.processIdentityVerificationCallback({
      ...callbackPayload,
      signature: signVerificationCallbackPayload(
        callbackPayload,
        process.env.VERIFICATION_CALLBACK_SECRET || 'runtime-callback-secret',
      ),
    });

    assert.equal(callback?.processed, true);
    assert.equal(callback?.duplicate, false);
    assert.equal(callback?.identityVerificationStatus, 'approved');

    const duplicateCallback = await harness.handler.processIdentityVerificationCallback({
      ...callbackPayload,
      signature: signVerificationCallbackPayload(
        callbackPayload,
        process.env.VERIFICATION_CALLBACK_SECRET || 'runtime-callback-secret',
      ),
    });

    assert.equal(duplicateCallback?.duplicate, true);
  } finally {
    await destroyRuntimeAuthHarness(harness);
  }
});

test('runtime integration: passkey challenge and authentication lifecycle', { skip: !hasRuntimeDeps() }, async () => {
  const {
    createRuntimeAuthHarness,
    destroyRuntimeAuthHarness,
  } = require('./auth.runtime.integration.harness');

  const harness = await createRuntimeAuthHarness();

  try {
    const id = uniqueToken();
    const registration = await harness.handler.register({
      handle: `runtime_passkey_${id}`,
      email: `runtime_passkey_${id}@rmwhs.com`,
      password: 'StrongPassword123!@#',
      displayName: 'Runtime Passkey',
    });

    await harness.handler.verifyEmail({ token: registration.verificationToken });

    const startRegistration = await harness.handler.startPasskeyRegistration({
      userId: registration.userId,
    });
    assert.ok(startRegistration?.challenge);

    const finishRegistration = await harness.handler.finishPasskeyRegistration({
      userId: registration.userId,
      challenge: startRegistration.challenge,
      credentialId: `cred-${registration.userId}`,
      attestationResponse: 'runtime-attestation',
    });
    assert.equal(finishRegistration, true);

    const startAuthentication = await harness.handler.startPasskeyAuthentication({
      userId: registration.userId,
    });
    assert.ok(startAuthentication?.challenge);

    const finishAuthentication = await harness.handler.finishPasskeyAuthentication({
      userId: registration.userId,
      challenge: startAuthentication.challenge,
      credentialId: `cred-${registration.userId}`,
      assertionResponse: 'runtime-assertion',
    });

    assert.ok(finishAuthentication?.accessToken);
    assert.ok(finishAuthentication?.refreshToken);
  } finally {
    await destroyRuntimeAuthHarness(harness);
  }
});
