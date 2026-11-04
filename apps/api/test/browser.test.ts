import { describe, it, expect } from 'vitest';
import { filterRequest } from '../src/browser/request-filter';

describe('browser SSRF request filter', () => {
  it('allows a public hostname resolving to public IPs', () => {
    expect(filterRequest('https://example.com/', ['93.184.216.34']).block).toBe(false);
  });
  it('blocks a hostname that resolves to a private IP', () => {
    const r = filterRequest('https://internal.corp/', ['10.0.0.5']);
    expect(r.block).toBe(true);
    expect(r.reason).toMatch(/private/);
  });
  it('blocks cloud metadata by literal IP', () => {
    expect(filterRequest('http://169.254.169.254/latest/meta-data', null).block).toBe(true);
  });
  it('blocks loopback literal', () => {
    expect(filterRequest('http://127.0.0.1:8080/', null).block).toBe(true);
  });
  it('allows a public literal IP', () => {
    expect(filterRequest('https://8.8.8.8/', null).block).toBe(false);
  });
  it('blocks non-http(s) schemes', () => {
    expect(filterRequest('file:///etc/passwd', null).block).toBe(true);
    expect(filterRequest('ftp://example.com/', null).block).toBe(true);
  });
  it('blocks an unresolved hostname (fail closed)', () => {
    expect(filterRequest('https://nonexistent.invalid/', []).block).toBe(true);
  });
  it('blocks if ANY resolved IP is private (DNS rebind)', () => {
    expect(filterRequest('https://rebind.example/', ['93.184.216.34', '127.0.0.1']).block).toBe(true);
  });
});
