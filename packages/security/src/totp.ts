/**
 * TOTP (RFC 6238) for MFA - dependency-free. Also RFC 4648 base32 and the
 * otpauth:// URI used to provision authenticator apps.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export interface TotpOptions {
  digits?: number;
  periodSeconds?: number;
  algorithm?: 'sha1' | 'sha256' | 'sha512';
}

export function generateTotp(secretBase32: string, forTimeMs: number, opts: TotpOptions = {}): string {
  const digits = opts.digits ?? 6;
  const period = opts.periodSeconds ?? 30;
  const algo = opts.algorithm ?? 'sha1';
  const counter = Math.floor(forTimeMs / 1000 / period);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(algo, base32Decode(secretBase32)).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = (binary % 10 ** digits).toString().padStart(digits, '0');
  return otp;
}

/** Verify a token, tolerating +/- `window` steps of clock drift. */
export function verifyTotp(
  token: string,
  secretBase32: string,
  nowMs: number,
  window = 1,
  opts: TotpOptions = {},
): boolean {
  const period = (opts.periodSeconds ?? 30) * 1000;
  const candidateBuf = Buffer.from(token.trim());
  for (let w = -window; w <= window; w++) {
    const expected = generateTotp(secretBase32, nowMs + w * period, opts);
    const expBuf = Buffer.from(expected);
    if (candidateBuf.length === expBuf.length && timingSafeEqual(candidateBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUri(params: {
  issuer: string;
  account: string;
  secretBase32: string;
  digits?: number;
  periodSeconds?: number;
}): string {
  const { issuer, account, secretBase32 } = params;
  // Keep the issuer:account separator a literal colon (otpauth convention);
  // encode the two parts individually.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const q = new URLSearchParams({
    secret: secretBase32,
    issuer,
    digits: String(params.digits ?? 6),
    period: String(params.periodSeconds ?? 30),
    algorithm: 'SHA1',
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
