class PasskeyService {
  constructor(repository, sessionIssuer) {
    this.repository = repository;
    this.sessionIssuer = sessionIssuer;
  }

  isEligibleForPasskey(status) {
    return status === 'active';
  }

  createChallenge() {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  }

  async startRegistration(userId) {
    const user = await this.repository.getUserById(userId);
    if (!user || !this.isEligibleForPasskey(user.status)) {
      return null;
    }

    const challenge = this.createChallenge();
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + 300;

    await this.repository.createPasskeyChallenge({
      userId,
      challengeType: 'registration',
      challenge,
      expiresAtEpochSeconds,
    });

    return {
      challenge,
      expiresAtEpochSeconds,
    };
  }

  async finishRegistration(input, verifier) {
    const consumed = await this.repository.consumePasskeyChallenge({
      userId: input.userId,
      challengeType: 'registration',
      challenge: input.challenge,
      currentEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!consumed) {
      return false;
    }

    const verification = await verifier.verifyRegistration({
      userId: input.userId,
      challenge: input.challenge,
      credentialId: input.credentialId,
      attestationResponse: input.attestationResponse,
    });

    await this.repository.createPasskeyCredential({
      userId: input.userId,
      credentialId: input.credentialId,
      publicKey: verification.publicKey,
      signCount: verification.signCount,
    });

    return true;
  }

  async startAuthentication(userId) {
    const user = await this.repository.getUserById(userId);
    if (!user || !this.isEligibleForPasskey(user.status)) {
      return null;
    }

    const challenge = this.createChallenge();
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + 300;

    await this.repository.createPasskeyChallenge({
      userId,
      challengeType: 'authentication',
      challenge,
      expiresAtEpochSeconds,
    });

    return {
      challenge,
      expiresAtEpochSeconds,
    };
  }

  async finishAuthentication(input, verifier) {
    const consumed = await this.repository.consumePasskeyChallenge({
      userId: input.userId,
      challengeType: 'authentication',
      challenge: input.challenge,
      currentEpochSeconds: Math.floor(Date.now() / 1000),
    });

    if (!consumed) {
      return null;
    }

    const credential = await this.repository.getPasskeyCredentialById(input.credentialId);
    if (!credential || credential.revoked || credential.userId !== input.userId) {
      return null;
    }

    const verification = await verifier.verifyAuthentication({
      userId: input.userId,
      challenge: input.challenge,
      credentialId: input.credentialId,
      assertionResponse: input.assertionResponse,
      expectedSignCount: credential.signCount,
    });

    await this.repository.updatePasskeySignCount({
      credentialId: input.credentialId,
      signCount: verification.newSignCount,
    });

    return this.sessionIssuer.issueSessionTokens(input.userId);
  }
}

module.exports = {
  PasskeyService,
};
