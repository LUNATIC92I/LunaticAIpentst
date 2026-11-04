/**
 * Password hashing using scrypt (built into Node — no native build step).
 * Format: scrypt$N$r$p$saltB64$hashB64 so parameters travel with the hash and
 * can be upgraded over time. Verification is constant-time.
 */
import { scrypt as scryptCb, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto';

function scrypt(
  password: string | Buffer,
  salt: string | Buffer,
  keyLen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keyLen, options, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey),
    );
  });
}

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keyLen: number;
}

// OWASP-aligned defaults (N=2^16). maxmem raised to fit N.
const DEFAULTS: ScryptParams = { N: 1 << 16, r: 8, p: 1, keyLen: 64 };

export async function hashPassword(password: string, params: ScryptParams = DEFAULTS): Promise<string> {
  if (!password) throw new Error('password required');
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * params.N * params.r,
  })) as Buffer;
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (!N || !r || !p || expected.length === 0) return false;
  const derived = (await scrypt(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 256 * N * r,
  })) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
