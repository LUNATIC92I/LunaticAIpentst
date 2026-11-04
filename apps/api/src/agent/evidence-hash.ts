/**
 * Tamper-evident evidence hashing (pure). Each evidence record stores a
 * contentHash (of the artifact) and a chain hash that folds in the previous
 * record's hash, so the whole per-mission chain can be verified later.
 */
import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeEvidenceHash(params: {
  contentHash: string;
  prevHash: string | null;
  createdAtIso: string;
  taskId: string;
}): string {
  return sha256(
    [params.contentHash, params.prevHash ?? 'GENESIS', params.createdAtIso, params.taskId].join('|'),
  );
}

/** Verify a chain of {contentHash, prevHash, hash, createdAtIso, taskId}. */
export function verifyEvidenceChain(
  records: { contentHash: string; prevHash: string | null; hash: string; createdAtIso: string; taskId: string }[],
): { valid: boolean; brokenAtIndex?: number } {
  let prev: string | null = null;
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.prevHash !== prev) return { valid: false, brokenAtIndex: i };
    const expected = computeEvidenceHash({
      contentHash: r.contentHash,
      prevHash: r.prevHash,
      createdAtIso: r.createdAtIso,
      taskId: r.taskId,
    });
    if (expected !== r.hash) return { valid: false, brokenAtIndex: i };
    prev = r.hash;
  }
  return { valid: true };
}
