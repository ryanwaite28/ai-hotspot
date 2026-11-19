class InMemoryPasskeyVerifierAdapter {
  async verifyRegistration(input) {
    if (!input.attestationResponse || input.attestationResponse.length < 4) {
      throw new Error('Invalid passkey attestation response');
    }

    return {
      publicKey: `pk:${input.credentialId}`,
      signCount: 1,
    };
  }

  async verifyAuthentication(input) {
    if (!input.assertionResponse || input.assertionResponse.length < 4) {
      throw new Error('Invalid passkey assertion response');
    }

    return {
      newSignCount: input.expectedSignCount + 1,
    };
  }
}

module.exports = {
  InMemoryPasskeyVerifierAdapter,
};
