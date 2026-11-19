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
