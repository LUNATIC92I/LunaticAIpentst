/**
 * Envelope encryption for secrets at rest (provider API keys, MFA secrets).
 * AES-256-GCM with a random IV per record. The master key is supplied from the
 * environment (SECRETS_ENCRYPTION_KEY, 32 bytes base64). Ciphertext, IV and the
 * auth tag are stored separately. Plaintext is never logged or returned to the
 * browser.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

function loadKey(masterKeyB64: string): Buffer {
  const key = Buffer.from(masterKeyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).');
  }
  return key;
}

export function sealSecret(plaintext: string, masterKeyB64: string): SealedSecret {
  const key = loadKey(masterKeyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function openSecret(sealed: SealedSecret, masterKeyB64: string): string {
  const key = loadKey(masterKeyB64);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Last 4 chars of a secret, for non-sensitive display (e.g. "...a1b2"). */
export function lastFour(secret: string): string {
  return secret.slice(-4);
}

export function generateMasterKeyBase64(): string {
  return randomBytes(32).toString('base64');
}
