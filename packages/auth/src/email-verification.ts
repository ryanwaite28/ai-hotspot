declare const require: (moduleName: string) => any;
declare const Buffer: any;

const { createHmac } = require('crypto');

export interface EmailVerificationTokenPayload {
  userId: string;
  email: string;
  issuedAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
}

export function createEmailVerificationToken(
  payload: EmailVerificationTokenPayload,
  secret: string,
): string {
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(serialized).digest('base64url');
  return `${serialized}.${signature}`;
}

export function verifyEmailVerificationToken(token: string, secret: string): EmailVerificationTokenPayload | null {
  const [serialized, signature] = token.split('.');
  if (!serialized || !signature) {
    return null;
  }

  const expected = createHmac('sha256', secret).update(serialized).digest('base64url');
  if (expected !== signature) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as EmailVerificationTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAtEpochSeconds < now) {
    return null;
  }
  return payload;
}
