import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password.js';
import { sealSecret, openSecret, generateMasterKeyBase64, lastFour } from '../src/secrets.js';
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotp,
  verifyTotp,
  buildOtpauthUri,
} from '../src/totp.js';

// Use lighter scrypt params so tests stay fast but still exercise the format.
const fast = { N: 1 << 12, r: 8, p: 1, keyLen: 32 };

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('Correct-Horse-Battery', fast);
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Correct-Horse-Battery', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });
  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same', fast);
    const b = await hashPassword('same', fast);
    expect(a).not.toBe(b);
  });
  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
  });
});

describe('envelope encryption', () => {
  const key = generateMasterKeyBase64();
  it('round-trips a secret', () => {
    const sealed = sealSecret('sk-provider-123456', key);
    expect(sealed.ciphertext).not.toContain('sk-provider');
    expect(openSecret(sealed, key)).toBe('sk-provider-123456');
  });
  it('fails to decrypt with the wrong key', () => {
    const sealed = sealSecret('top-secret', key);
    expect(() => openSecret(sealed, generateMasterKeyBase64())).toThrow();
  });
  it('detects tampering (GCM auth tag)', () => {
    const sealed = sealSecret('top-secret', key);
    const tampered = { ...sealed, ciphertext: Buffer.from('zzzz').toString('base64') };
    expect(() => openSecret(tampered, key)).toThrow();
  });
  it('rejects a key of the wrong length', () => {
    expect(() => sealSecret('x', Buffer.from('short').toString('base64'))).toThrow();
  });
  it('lastFour masks the secret', () => {
    expect(lastFour('abcdef')).toBe('cdef');
  });
});

describe('TOTP (RFC 6238)', () => {
  it('base32 round-trips', () => {
    const buf = Buffer.from('hello world');
    expect(base32Decode(base32Encode(buf)).toString()).toBe('hello world');
  });

  // RFC 6238 Appendix B test vector (SHA-1, secret "12345678901234567890").
  it('matches an RFC test vector', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    // T = 59s -> expected TOTP 94287082 (8 digits)
    const otp = generateTotp(secret, 59_000, { digits: 8 });
    expect(otp).toBe('94287082');
  });

  it('verifies a freshly generated token and rejects a stale one', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const token = generateTotp(secret, now);
    expect(verifyTotp(token, secret, now)).toBe(true);
    // 5 minutes later, outside the drift window
    expect(verifyTotp(token, secret, now + 300_000)).toBe(false);
  });

  it('builds a provisioning URI', () => {
    const uri = buildOtpauthUri({ issuer: 'Lunatic', account: 'a@b.c', secretBase32: 'JBSWY3DPEHPK3PXP' });
    expect(uri).toContain('otpauth://totp/Lunatic:a%40b.c');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});
