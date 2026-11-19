const { createHmac } = require('crypto');

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signInput(input, secret) {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function parseTtlToSeconds(ttl) {
  const value = String(ttl).trim();
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount * 86400;
}

function issueJwt(claims, secret, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseTtlToSeconds(ttl);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    ...claims,
    iat: now,
    exp,
  };

  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = signInput(`${headerPart}.${payloadPart}`, secret);
  return `${headerPart}.${payloadPart}.${signature}`;
}

function verifyJwt(token, secret) {
  const [headerPart, payloadPart, signature] = token.split('.');
  if (!headerPart || !payloadPart || !signature) {
    return null;
  }

  const expected = signInput(`${headerPart}.${payloadPart}`, secret);
  if (expected !== signature) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return null;
  }
  return payload;
}

module.exports = {
  issueJwt,
  verifyJwt,
};
