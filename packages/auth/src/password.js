const PBKDF2_ITERATIONS = 310000;
const KEY_LENGTH = 32;

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(password, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt);
  return `pbkdf2:${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export async function verifyPassword(password, hash) {
  const [algorithm, saltHex, storedHex] = hash.split(':');
  if (algorithm !== 'pbkdf2' || !saltHex || !storedHex) {
    return false;
  }

  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(storedHex);
  const actual = await derive(password, salt);

  if (expected.length !== actual.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected[i] ^ actual[i];
  }
  return diff === 0;
}
