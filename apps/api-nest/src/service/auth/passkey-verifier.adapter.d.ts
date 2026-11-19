export interface PasskeyRegistrationVerifyInput {
  userId: string;
  challenge: string;
  credentialId: string;
  attestationResponse: string;
}

export interface PasskeyAuthenticationVerifyInput {
  userId: string;
  challenge: string;
  credentialId: string;
  assertionResponse: string;
  expectedSignCount: number;
}

export interface PasskeyVerifierAdapter {
  verifyRegistration(input: PasskeyRegistrationVerifyInput): Promise<{ publicKey: string; signCount: number }>;
  verifyAuthentication(input: PasskeyAuthenticationVerifyInput): Promise<{ newSignCount: number }>;
}

export class InMemoryPasskeyVerifierAdapter implements PasskeyVerifierAdapter {
  verifyRegistration(input: PasskeyRegistrationVerifyInput): Promise<{ publicKey: string; signCount: number }>;
  verifyAuthentication(input: PasskeyAuthenticationVerifyInput): Promise<{ newSignCount: number }>;
}
