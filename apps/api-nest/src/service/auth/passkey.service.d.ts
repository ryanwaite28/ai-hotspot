import type {
  FinishPasskeyAuthenticationInput,
  FinishPasskeyRegistrationInput,
  SessionTokens,
  StartPasskeyAuthenticationResult,
  StartPasskeyRegistrationResult,
} from '../../../../../packages/contracts/src/index';

export interface PasskeyRepository {
  getUserById(userId: string): Promise<{
    id: string;
    status: 'pending_verification' | 'active' | 'suspended' | 'deactivated' | 'deleted';
  } | null>;
  createPasskeyChallenge(input: {
    userId: string;
    challengeType: 'registration' | 'authentication';
    challenge: string;
    expiresAtEpochSeconds: number;
  }): Promise<void>;
  consumePasskeyChallenge(input: {
    userId: string;
    challengeType: 'registration' | 'authentication';
    challenge: string;
    currentEpochSeconds: number;
  }): Promise<boolean>;
  createPasskeyCredential(input: {
    userId: string;
    credentialId: string;
    publicKey: string;
    signCount: number;
  }): Promise<void>;
  getPasskeyCredentialById(credentialId: string): Promise<{
    userId: string;
    credentialId: string;
    signCount: number;
    revoked: boolean;
  } | null>;
  updatePasskeySignCount(input: { credentialId: string; signCount: number }): Promise<void>;
}

export interface SessionIssuer {
  issueSessionTokens(userId: string): Promise<SessionTokens>;
}

export interface PasskeyVerifierAdapter {
  verifyRegistration(input: {
    userId: string;
    challenge: string;
    credentialId: string;
    attestationResponse: string;
  }): Promise<{ publicKey: string; signCount: number }>;
  verifyAuthentication(input: {
    userId: string;
    challenge: string;
    credentialId: string;
    assertionResponse: string;
    expectedSignCount: number;
  }): Promise<{ newSignCount: number }>;
}

export class PasskeyService {
  constructor(repository: PasskeyRepository, sessionIssuer: SessionIssuer);
  startRegistration(userId: string): Promise<StartPasskeyRegistrationResult | null>;
  finishRegistration(input: FinishPasskeyRegistrationInput, verifier: PasskeyVerifierAdapter): Promise<boolean>;
  startAuthentication(userId: string): Promise<StartPasskeyAuthenticationResult | null>;
  finishAuthentication(input: FinishPasskeyAuthenticationInput, verifier: PasskeyVerifierAdapter): Promise<SessionTokens | null>;
}
