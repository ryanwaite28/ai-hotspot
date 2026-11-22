import { Inject, Injectable } from '@nestjs/common';
import type { RegisterUserInput, RegisterUserResult } from '../../../../packages/contracts/src';

export const AUTH_SERVICE_BASE_URL = 'AUTH_SERVICE_BASE_URL';

export interface AuthServiceErrorPayload {
  code?: string;
  message?: string;
}

@Injectable()
export class AuthServiceClient {
  constructor(@Inject(AUTH_SERVICE_BASE_URL) private readonly baseUrl: string) {}

  async register(input: RegisterUserInput): Promise<RegisterUserResult & { verificationToken: string }> {
    const response = await fetch(`${this.baseUrl}/internal/v1/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Auth service request failed' })) as AuthServiceErrorPayload;
      const error = new Error(payload.message ?? 'Auth service request failed');
      error.name = response.status === 409 ? 'DuplicateUserError' : 'AuthServiceError';
      throw error;
    }

    return await response.json() as RegisterUserResult & { verificationToken: string };
  }

  async verifyEmail(token: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/internal/v1/auth/verify-email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error(`Auth service verify-email failed with status ${response.status}`);
    }

    return await response.json() as unknown;
  }

  async requestPasswordReset(email: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/internal/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(`Auth service password-reset failed with status ${response.status}`);
    }

    return await response.json() as unknown;
  }
}