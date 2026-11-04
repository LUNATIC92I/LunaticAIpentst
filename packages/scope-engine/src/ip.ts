/**
 * IP address utilities for the scope engine.
 *
 * Dependency-free IPv4/IPv6 parsing, CIDR matching and private/reserved-range
 * detection. Used to enforce SSRF protection: targets that resolve to internal
 * or reserved ranges are blocked unless the operator explicitly authorizes them.
 */

export type IpKind = 'ipv4' | 'ipv6';

export interface ParsedIp {
  kind: IpKind;
  /** Normalized string form. */
  normalized: string;
  /** Big-integer value for range comparisons. */
  value: bigint;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIpv4(input: string): ParsedIp | null {
  const m = IPV4_RE.exec(input.trim());
  if (!m) return null;
  const octets = m.slice(1, 5).map((o) => Number(o));
  if (octets.some((o) => o < 0 || o > 255)) return null;
  // Reject leading zeros like 01 to avoid ambiguity.
  if (m.slice(1, 5).some((o) => o.length > 1 && o.startsWith('0'))) return null;
  const value =
    (BigInt(octets[0]!) << 24n) |
    (BigInt(octets[1]!) << 16n) |
    (BigInt(octets[2]!) << 8n) |
    BigInt(octets[3]!);
  return { kind: 'ipv4', normalized: octets.join('.'), value };
}

export function parseIpv6(input: string): ParsedIp | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  // Embedded IPv4 (e.g. ::ffff:127.0.0.1) — convert the trailing dotted quad
  // into two hex groups before the main parse.
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = parseIpv4(s.slice(lastColon + 1));
    if (!v4) return null;
    const hi = (v4.value >> 16n).toString(16);
    const lo = (v4.value & 0xffffn).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  // Reject zone ids and anything with invalid chars.
  if (!/^[0-9a-f:]+$/.test(s) || s.indexOf(':') === -1) return null;

  const doubleColon = s.split('::');
  if (doubleColon.length > 2) return null;

  let head: string[] = [];
  let tail: string[] = [];
  if (doubleColon.length === 2) {
    head = doubleColon[0] ? doubleColon[0]!.split(':') : [];
    tail = doubleColon[1] ? doubleColon[1]!.split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    head = [...head, ...Array(fill).fill('0'), ...tail];
  } else {
    head = s.split(':');
    if (head.length !== 8) return null;
  }
  if (head.length !== 8) return null;

  let value = 0n;
  for (const group of head) {
    if (group === '') return null;
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return { kind: 'ipv6', normalized: s, value };
}

export function parseIp(input: string): ParsedIp | null {
  return parseIpv4(input) ?? parseIpv6(input);
}

export interface Cidr {
  base: ParsedIp;
  prefix: number;
}

export function parseCidr(input: string): Cidr | null {
  const [addr, prefixStr, ...rest] = input.trim().split('/');
  if (rest.length > 0 || prefixStr === undefined || addr === undefined) return null;
  const base = parseIp(addr);
  if (!base) return null;
  const prefix = Number(prefixStr);
  const max = base.kind === 'ipv4' ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { base, prefix };
}

export function cidrContains(cidr: Cidr, ip: ParsedIp): boolean {
  if (cidr.base.kind !== ip.kind) return false;
  const bits = cidr.base.kind === 'ipv4' ? 32 : 128;
  const hostBits = BigInt(bits - cidr.prefix);
  if (hostBits === 0n) return cidr.base.value === ip.value;
  const mask = ((1n << BigInt(cidr.prefix)) - 1n) << hostBits;
  return (cidr.base.value & mask) === (ip.value & mask);
}

// RFC1918 / loopback / link-local / reserved ranges (SSRF-sensitive).
const PRIVATE_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (incl. 169.254.169.254 cloud metadata)
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15', // benchmarking
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved
].map((c) => parseCidr(c)!);

const PRIVATE_V6 = ['::1/128', 'fc00::/7', 'fe80::/10', '::ffff:0:0/96', '::/128'].map(
  (c) => parseCidr(c)!,
);

/** True if the IP is in a private/loopback/link-local/reserved range. */
export function isPrivateOrReserved(ip: ParsedIp): boolean {
  const ranges = ip.kind === 'ipv4' ? PRIVATE_V4 : PRIVATE_V6;
  if (ranges.some((c) => cidrContains(c, ip))) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap and check as v4.
  if (ip.kind === 'ipv6') {
    const mapped = ip.value & ((1n << 32n) - 1n);
    const high = ip.value >> 32n;
    if (high === 0xffffn) {
      const v4: ParsedIp = { kind: 'ipv4', normalized: '', value: mapped };
      return PRIVATE_V4.some((c) => cidrContains(c, v4));
    }
  }
  return false;
}
