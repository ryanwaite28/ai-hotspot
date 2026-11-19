import { strict as assert } from 'node:assert';
import test from 'node:test';

import { verifyEmailVerificationToken } from '../../../../../packages/auth/src/index';
import { AuthService, type AuthRepository } from './auth.service';

test('registerUser normalizes handle/email and returns signed verification token', async () => {
  const fakeRepo: AuthRepository = {
    async createPendingUser(input) {
      return {
        id: 'user-123',
        handle: input.handle,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: 'pending_verification',
      };
    },
  };

  const service = new AuthService(fakeRepo, 'test-secret');

  const result = await service.registerUser({
    handle: '  Ryan  ',
    email: '  RYAN@RMWHS.COM ',
    password: 'StrongPassword123!@#',
    displayName: 'Ryan Waite',
  });

  assert.equal(result.userId, 'user-123');
  assert.equal(result.email, 'ryan@rmwhs.com');
  assert.equal(result.status, 'pending_verification');

  const payload = verifyEmailVerificationToken(result.verificationToken, 'test-secret');
  assert.ok(payload);
  assert.equal(payload?.userId, 'user-123');
  assert.equal(payload?.email, 'ryan@rmwhs.com');
});
