import crypto from 'node:crypto';

export interface VerificationCallbackPayload {
  provider: string;
  eventId: string;
  userId: string;
  providerSessionRef: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  failureCode?: string;
}

function canonicalizeCallbackPayload(payload: VerificationCallbackPayload): string {
  const failureCode = payload.failureCode ?? '';
  return [
    payload.provider,
    payload.eventId,
    payload.userId,
    payload.providerSessionRef,
    payload.status,
    failureCode,
  ].join('|');
}

export function hashVerificationCallbackPayload(payload: VerificationCallbackPayload): string {
  return crypto
    .createHash('sha256')
    .update(canonicalizeCallbackPayload(payload), 'utf8')
    .digest('hex');
}

export function signVerificationCallbackPayload(payload: VerificationCallbackPayload, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalizeCallbackPayload(payload), 'utf8')
    .digest('hex');
}

export function verifyVerificationCallbackSignature(
  payload: VerificationCallbackPayload,
  signature: string,
  secret: string,
): boolean {
  const expected = signVerificationCallbackPayload(payload, secret);
  const expectedBytes = Buffer.from(expected, 'hex');
  const providedBytes = Buffer.from(signature, 'hex');

  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBytes, providedBytes);
}
