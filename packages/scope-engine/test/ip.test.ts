import { describe, it, expect } from 'vitest';
import {
  parseIpv4,
  parseIpv6,
  parseCidr,
  cidrContains,
  isPrivateOrReserved,
} from '../src/ip.js';

describe('parseIpv4', () => {
  it('parses valid addresses', () => {
    expect(parseIpv4('192.168.1.1')?.normalized).toBe('192.168.1.1');
    expect(parseIpv4('0.0.0.0')?.value).toBe(0n);
    expect(parseIpv4('255.255.255.255')?.value).toBe(0xffffffffn);
  });
  it('rejects malformed addresses', () => {
    expect(parseIpv4('256.0.0.1')).toBeNull();
    expect(parseIpv4('1.2.3')).toBeNull();
    expect(parseIpv4('01.2.3.4')).toBeNull(); // leading zero
    expect(parseIpv4('a.b.c.d')).toBeNull();
  });
});

describe('parseIpv6', () => {
  it('parses full and compressed forms', () => {
    expect(parseIpv6('::1')?.value).toBe(1n);
    expect(parseIpv6('fe80::1')).not.toBeNull();
    expect(parseIpv6('2001:db8::')).not.toBeNull();
  });
  it('rejects invalid forms', () => {
    expect(parseIpv6('gggg::1')).toBeNull();
    expect(parseIpv6('1:2:3')).toBeNull();
    expect(parseIpv6('1::2::3')).toBeNull();
  });
});

describe('cidrContains', () => {
  it('matches v4 ranges', () => {
    const cidr = parseCidr('10.0.0.0/8')!;
    expect(cidrContains(cidr, parseIpv4('10.1.2.3')!)).toBe(true);
    expect(cidrContains(cidr, parseIpv4('11.0.0.1')!)).toBe(false);
  });
  it('handles /32 and /0', () => {
    expect(cidrContains(parseCidr('1.2.3.4/32')!, parseIpv4('1.2.3.4')!)).toBe(true);
    expect(cidrContains(parseCidr('1.2.3.4/32')!, parseIpv4('1.2.3.5')!)).toBe(false);
    expect(cidrContains(parseCidr('0.0.0.0/0')!, parseIpv4('8.8.8.8')!)).toBe(true);
  });
});

describe('isPrivateOrReserved', () => {
  it('flags private, loopback, link-local and metadata', () => {
    expect(isPrivateOrReserved(parseIpv4('10.0.0.1')!)).toBe(true);
    expect(isPrivateOrReserved(parseIpv4('192.168.0.5')!)).toBe(true);
    expect(isPrivateOrReserved(parseIpv4('172.16.5.5')!)).toBe(true);
    expect(isPrivateOrReserved(parseIpv4('127.0.0.1')!)).toBe(true);
    expect(isPrivateOrReserved(parseIpv4('169.254.169.254')!)).toBe(true); // cloud metadata
    expect(isPrivateOrReserved(parseIpv6('::1')!)).toBe(true);
    expect(isPrivateOrReserved(parseIpv6('fe80::1')!)).toBe(true);
  });
  it('allows public addresses', () => {
    expect(isPrivateOrReserved(parseIpv4('8.8.8.8')!)).toBe(false);
    expect(isPrivateOrReserved(parseIpv4('93.184.216.34')!)).toBe(false);
  });
  it('unwraps IPv4-mapped IPv6', () => {
    expect(isPrivateOrReserved(parseIpv6('::ffff:127.0.0.1')!)).toBe(true);
  });
});
