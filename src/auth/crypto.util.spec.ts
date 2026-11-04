import {
  decryptSecret,
  encryptSecret,
  isValidState,
  signState,
} from './crypto.util.js';

const SECRET = 'test-secret';

describe('signState / isValidState', () => {
  it('accepts a state that matches the signed cookie', () => {
    const state = signState(SECRET);

    expect(state).toMatch(/^[0-9a-f]{64}\.[0-9a-f]{64}$/);
    expect(isValidState(state, state, SECRET)).toBe(true);
  });

  it('issues a different value on every call', () => {
    expect(signState(SECRET)).not.toBe(signState(SECRET));
  });

  it('rejects a missing or different cookie', () => {
    const state = signState(SECRET);

    expect(isValidState(state, undefined, SECRET)).toBe(false);
    expect(isValidState(state, signState(SECRET), SECRET)).toBe(false);
  });

  it('rejects a tampered value or signature', () => {
    const state = signState(SECRET);
    const [value, signature] = state.split('.');

    expect(isValidState(`${'0'.repeat(64)}.${signature}`, state, SECRET)).toBe(
      false,
    );
    expect(isValidState(`${value}.${'a'.repeat(64)}`, state, SECRET)).toBe(
      false,
    );
    expect(isValidState(`${value}.${signature}`, `${value}.abcd`, SECRET)).toBe(
      false,
    );
  });

  it('rejects a different secret and malformed states', () => {
    const state = signState(SECRET);

    expect(isValidState(state, state, 'other-secret')).toBe(false);
    expect(isValidState('nosignature', 'nosignature', SECRET)).toBe(false);
    expect(isValidState('value.', 'value.', SECRET)).toBe(false);
    expect(isValidState('.signature', '.signature', SECRET)).toBe(false);
  });

  it('rejects a signature whose length does not match', () => {
    const state = signState(SECRET);
    const [value] = state.split('.');
    const shortened = `${value}.abcd`;

    expect(isValidState(shortened, shortened, SECRET)).toBe(false);
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret', () => {
    const plaintext = 'refresh-token-ção-🔐';
    const ciphertext = encryptSecret(plaintext, SECRET);

    expect(ciphertext.split('.')).toHaveLength(3);
    expect(decryptSecret(ciphertext, SECRET)).toBe(plaintext);
  });

  it('uses a fresh iv so identical plaintexts differ', () => {
    expect(encryptSecret('same', SECRET)).not.toBe(
      encryptSecret('same', SECRET),
    );
  });

  it('rejects the wrong key, tampered ciphertext, and malformed payloads', () => {
    const ciphertext = encryptSecret('secret', SECRET);
    const [iv, tag, encrypted] = ciphertext.split('.');

    const flipped =
      encrypted[0] === 'A'
        ? `B${encrypted.slice(1)}`
        : `A${encrypted.slice(1)}`;

    expect(() => decryptSecret(ciphertext, 'wrong-key')).toThrow();
    expect(() => decryptSecret(`${iv}.${tag}.${flipped}`, SECRET)).toThrow();
    expect(() => decryptSecret('not-a-payload', SECRET)).toThrow(
      'Invalid ciphertext',
    );
    expect(() => decryptSecret('...', SECRET)).toThrow('Invalid ciphertext');
  });
});
