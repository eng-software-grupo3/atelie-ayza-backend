import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function signState(secret: string): string {
  const value = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
}

export function isValidState(
  state: string,
  cookieState: string | undefined,
  secret: string,
): boolean {
  if (!cookieState || state !== cookieState) return false;
  const [value, signature] = state.split('.');
  if (!value || !signature) return false;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(
    createHmac('sha256', secret).update(value).digest('hex'),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string, secret: string): string {
  const [iv, authTag, encrypted] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  if (!iv?.length || !authTag?.length || !encrypted?.length) {
    throw new Error('Invalid ciphertext');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}
