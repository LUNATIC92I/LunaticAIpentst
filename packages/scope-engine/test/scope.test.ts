import { describe, it, expect } from 'vitest';
import { evaluateTarget, normalizeTarget, type ScopeEntry } from '../src/scope.js';

const scope: ScopeEntry[] = [
  { type: 'host', value: 'example.com' },
  { type: 'host', value: '*.test.example.com' },
  { type: 'ip', value: '93.184.216.34' },
  { type: 'cidr', value: '203.0.113.0/24' },
];

describe('normalizeTarget', () => {
  it('extracts host from URLs and host:port', () => {
    expect(normalizeTarget('https://example.com/path?x=1')).toBe('example.com');
    expect(normalizeTarget('example.com:8443')).toBe('example.com');
    expect(normalizeTarget('[::1]:80')).toBe('::1');
    expect(normalizeTarget('  EXAMPLE.com ')).toBe('example.com');
  });
  it('rejects empties', () => {
    expect(normalizeTarget('')).toBeNull();
    expect(normalizeTarget('http://')).toBeNull();
  });
});

describe('evaluateTarget — default deny', () => {
  it('blocks when no scope defined', () => {
    expect(evaluateTarget('example.com', []).code).toBe('NO_SCOPE');
  });
  it('blocks out-of-scope hosts', () => {
    const d = evaluateTarget('evil.com', scope, { resolvedIps: ['1.2.3.4'] });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe('NOT_IN_SCOPE');
  });
  it('honors emergency stop', () => {
    const d = evaluateTarget('example.com', scope, { emergencyStop: true });
    expect(d.code).toBe('EMERGENCY_STOP');
  });
});

describe('evaluateTarget — IP targets', () => {
  it('allows in-scope public IP', () => {
    expect(evaluateTarget('93.184.216.34', scope).allowed).toBe(true);
  });
  it('allows in-scope CIDR member', () => {
    expect(evaluateTarget('203.0.113.55', scope).allowed).toBe(true);
  });
  it('blocks private IP even if someone lists it without lab flag', () => {
    const local: ScopeEntry[] = [{ type: 'ip', value: '192.168.1.10' }];
    const d = evaluateTarget('192.168.1.10', local);
    expect(d.code).toBe('PRIVATE_RANGE_BLOCKED');
  });
  it('allows private IP in lab mode (explicit authorization)', () => {
    const local: ScopeEntry[] = [{ type: 'ip', value: '192.168.1.10' }];
    const d = evaluateTarget('192.168.1.10', local, { allowPrivateRanges: true });
    expect(d.allowed).toBe(true);
  });
});

describe('evaluateTarget — hostnames, SSRF & DNS rebind', () => {
  it('allows in-scope host resolving to public IP', () => {
    const d = evaluateTarget('example.com', scope, {
      resolvedIps: ['93.184.216.34'],
      requireResolution: true,
    });
    expect(d.allowed).toBe(true);
  });
  it('blocks in-scope host that resolves to a private IP (DNS rebind)', () => {
    const d = evaluateTarget('example.com', scope, {
      resolvedIps: ['127.0.0.1'],
      requireResolution: true,
    });
    expect(d.code).toBe('PRIVATE_RANGE_BLOCKED');
  });
  it('blocks when ANY resolved IP is private', () => {
    const d = evaluateTarget('example.com', scope, {
      resolvedIps: ['93.184.216.34', '169.254.169.254'],
      requireResolution: true,
    });
    expect(d.code).toBe('PRIVATE_RANGE_BLOCKED');
  });
  it('requires resolution for active operations', () => {
    const d = evaluateTarget('example.com', scope, { requireResolution: true });
    expect(d.code).toBe('UNRESOLVED');
  });
  it('matches wildcard subdomain entries', () => {
    const d = evaluateTarget('api.test.example.com', scope, {
      resolvedIps: ['93.184.216.34'],
      requireResolution: true,
    });
    expect(d.allowed).toBe(true);
  });
  it('does not let wildcard match the bare root', () => {
    const onlyWild: ScopeEntry[] = [{ type: 'host', value: '*.test.example.com' }];
    const d = evaluateTarget('test.example.com', onlyWild, {
      resolvedIps: ['93.184.216.34'],
      requireResolution: true,
    });
    expect(d.allowed).toBe(false);
  });
  it('allows a host with no host-entry only if every resolved IP is in scope', () => {
    const d = evaluateTarget('somehost.net', scope, {
      resolvedIps: ['93.184.216.34'],
      requireResolution: true,
    });
    expect(d.allowed).toBe(true); // resolved IP is explicitly in scope
  });
});
