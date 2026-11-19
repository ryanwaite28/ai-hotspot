import { createEmailVerificationToken, hashPassword } from '../../../../../packages/auth/src/index';
import type { RegisterUserResult } from '../../../../../packages/contracts/src/index';

export interface RegisterUserInput {
  handle: string;
  email: string;
  password: string;
  displayName: string;
}

export interface UserRecord {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deactivated' | 'deleted';
}

export interface AuthRepository {
  createPendingUser(input: Omit<UserRecord, 'id' | 'status'>): Promise<UserRecord>;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly emailVerificationSecret: string,
  ) {}

  async registerUser(input: RegisterUserInput): Promise<RegisterUserResult & { verificationToken: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedHandle = input.handle.trim().toLowerCase();

    const created = await this.repository.createPendingUser({
      handle: normalizedHandle,
      email: normalizedEmail,
      displayName: input.displayName.trim(),
      passwordHash: await hashPassword(input.password),
    });

    const now = Math.floor(Date.now() / 1000);
    const verificationToken = createEmailVerificationToken(
      {
        userId: created.id,
        email: created.email,
        issuedAtEpochSeconds: now,
        expiresAtEpochSeconds: now + 60 * 60,
      },
      this.emailVerificationSecret,
    );

    return {
      userId: created.id,
      email: created.email,
      status: created.status,
      verificationToken,
    };
  }
}
