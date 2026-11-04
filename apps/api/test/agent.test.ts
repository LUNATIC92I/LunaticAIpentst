import { describe, it, expect } from 'vitest';
import { buildBaselinePlan } from '../src/agent/plan';
import { autoApproves } from '../src/agent/gating';
import { computeEvidenceHash, verifyEvidenceChain } from '../src/agent/evidence-hash';
import type { ScopeEntry } from '@lunatic/scope-engine';

const scope: ScopeEntry[] = [
  { type: 'host', value: 'example.com' },
  { type: 'ip', value: '93.184.216.34' },
  { type: 'cidr', value: '203.0.113.0/24' },
];

describe('buildBaselinePlan', () => {
  it('verifies authorization before any tool step', () => {
    const steps = buildBaselinePlan(scope, 50);
    const first = steps.find((s) => s.target === 'example.com');
    expect(first?.action).toBe('scope_verify');
    // a scope_verify for a target always precedes its tool steps
    const hostSteps = steps.filter((s) => s.target === 'example.com');
    expect(hostSteps[0]!.action).toBe('scope_verify');
    expect(hostSteps.some((s) => s.action === 'dns_recon')).toBe(true);
    expect(hostSteps.some((s) => s.action === 'tool')).toBe(true);
  });
  it('does not DNS-resolve bare IPs, and plans nmap for them', () => {
    const ipSteps = buildBaselinePlan(scope, 50).filter((s) => s.target === '93.184.216.34');
    expect(ipSteps.some((s) => s.action === 'dns_recon')).toBe(false);
    expect(ipSteps.some((s) => s.tool === 'nmap')).toBe(true);
  });
  it('respects the max step cap', () => {
    expect(buildBaselinePlan(scope, 3)).toHaveLength(3);
  });
});

describe('permission gating', () => {
  it('APPROVAL never auto-approves', () => {
    expect(autoApproves('APPROVAL', 'low')).toBe(false);
    expect(autoApproves('APPROVAL', 'high')).toBe(false);
  });
  it('SUPERVISED auto-approves only low risk', () => {
    expect(autoApproves('SUPERVISED', 'low')).toBe(true);
    expect(autoApproves('SUPERVISED', 'medium')).toBe(false);
    expect(autoApproves('SUPERVISED', 'high')).toBe(false);
  });
  it('AUTONOMOUS auto-approves all risks', () => {
    expect(autoApproves('AUTONOMOUS', 'high')).toBe(true);
  });
});

describe('evidence hash chain', () => {
  function chain(contents: string[], taskId = 't1') {
    const records: { contentHash: string; prevHash: string | null; hash: string; createdAtIso: string; taskId: string }[] = [];
    let prev: string | null = null;
    contents.forEach((c, i) => {
      const contentHash = `h_${c}`;
      const createdAtIso = new Date(1700000000000 + i * 1000).toISOString();
      const hash = computeEvidenceHash({ contentHash, prevHash: prev, createdAtIso, taskId });
      records.push({ contentHash, prevHash: prev, hash, createdAtIso, taskId });
      prev = hash;
    });
    return records;
  }

  it('verifies an intact chain', () => {
    expect(verifyEvidenceChain(chain(['a', 'b', 'c']))).toEqual({ valid: true });
  });
  it('detects tampering of content', () => {
    const records = chain(['a', 'b', 'c']);
    records[1]!.contentHash = 'h_TAMPERED';
    const res = verifyEvidenceChain(records);
    expect(res.valid).toBe(false);
    expect(res.brokenAtIndex).toBe(1);
  });
  it('detects a broken link (reordering)', () => {
    const records = chain(['a', 'b', 'c']);
    [records[1], records[2]] = [records[2]!, records[1]!];
    expect(verifyEvidenceChain(records).valid).toBe(false);
  });
});
