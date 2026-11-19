export type UserStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'deleted';

export type VerificationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface VerificationCallbackInput {
  provider: string;
  eventId: string;
  userId: string;
  providerSessionRef: string;
  status: VerificationStatus;
  failureCode?: string;
  signature: string;
}

export interface VerificationCallbackResult {
  processed: boolean;
  duplicate: boolean;
  userId: string;
  userStatus: UserStatus;
  identityVerificationStatus: VerificationStatus;
}

export interface RegisterUserInput {
  handle: string;
  email: string;
  password: string;
}

export interface RegisterUserResult {
  userId: string;
  email: string;
  status: UserStatus;
}

export interface StartVerificationInput {
  userId: string;
  provider: string;
}

export interface StartVerificationResult {
  verificationSessionId: string;
  providerSessionRef: string;
  status: VerificationStatus;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface StartPasskeyRegistrationResult {
  challenge: string;
  expiresAtEpochSeconds: number;
}

export interface FinishPasskeyRegistrationInput {
  userId: string;
  challenge: string;
  credentialId: string;
  attestationResponse: string;
}

export interface StartPasskeyAuthenticationResult {
  challenge: string;
  expiresAtEpochSeconds: number;
}

export interface FinishPasskeyAuthenticationInput {
  userId: string;
  challenge: string;
  credentialId: string;
  assertionResponse: string;
}
