/**
 * Scope authorization engine - the mandatory choke point.
 *
 * Every active operation must pass `evaluateTarget` BEFORE dispatch. The engine
 * is pure and side-effect-free so it can be unit-tested exhaustively and reused
 * identically by the API and the local agent.
 *
 * Design rules:
 *  - Default deny. A target is allowed only if it matches an authorized entry.
 *  - DNS-rebind defense: a hostname is allowed only if EVERY resolved IP is also
 *    permitted (either by an ip/cidr entry or by allowPrivateRanges).
 *  - SSRF defense: targets resolving to private/reserved ranges are blocked
 *    unless explicitly authorized via allowPrivateRanges (lab use).
 *  - The decision carries a machine-readable `code` and a human reason, and is
 *    snapshotted into the audit log.
 */

import { URL } from 'node:url';
import { parseIp, parseCidr, cidrContains, isPrivateOrReserved, type ParsedIp } from './ip.js';

export type ScopeEntryType = 'host' | 'ip' | 'cidr';

export interface ScopeEntry {
  type: ScopeEntryType;
  value: string;
  note?: string;
}

export type DecisionCode =
  | 'ALLOWED'
  | 'EMERGENCY_STOP'
  | 'NO_SCOPE'
  | 'NOT_IN_SCOPE'
  | 'PRIVATE_RANGE_BLOCKED'
  | 'DNS_REBIND_BLOCKED'
  | 'UNRESOLVED'
  | 'INVALID_TARGET';

export interface ScopeDecision {
  allowed: boolean;
  code: DecisionCode;
  reason: string;
  matched?: ScopeEntry;
}

export interface EvaluateOptions {
  /** Allow private/reserved ranges - lab environments only. Default false. */
  allowPrivateRanges?: boolean;
  /** Global emergency stop flag for the mission. */
  emergencyStop?: boolean;
  /**
   * Resolved IPs for a hostname target. The CALLER resolves DNS (so the engine
   * stays pure) and passes every A/AAAA answer. Required for host targets when
   * the operation is active.
   */
  resolvedIps?: string[];
  /**
   * If true (active operation), a hostname target with no resolvedIps is a hard
   * block. If false (passive/metadata), hostname matching alone may pass.
   */
  requireResolution?: boolean;
}

/** Normalize a raw target (URL, host:port, bare host/IP) to a hostname/IP. */
export function normalizeTarget(raw: string): string | null {
  let t = raw.trim();
  if (!t) return null;
  // URL form
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      t = u.hostname;
    } catch {
      return null;
    }
  } else {
    // strip path/query
    t = t.split('/')[0]!;
    if (t.startsWith('[')) {
      // bracketed IPv6, optionally with :port -> take inside the brackets
      const close = t.indexOf(']');
      if (close !== -1) t = t.slice(1, close);
    } else if ((t.match(/:/g)?.length ?? 0) === 1) {
      // host:port
      t = t.split(':')[0]!;
    }
  }
  return t.toLowerCase() || null;
}

function hostMatches(entryValue: string, host: string): boolean {
  const e = entryValue.trim().toLowerCase();
  if (e === host) return true;
  // Wildcard subdomain entry: "*.example.com" matches a.example.com (not root).
  if (e.startsWith('*.')) {
    const suffix = e.slice(1); // ".example.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return false;
}

function ipInEntries(ip: ParsedIp, entries: ScopeEntry[]): ScopeEntry | undefined {
  for (const entry of entries) {
    if (entry.type === 'ip') {
      const parsed = parseIp(entry.value);
      if (parsed && parsed.kind === ip.kind && parsed.value === ip.value) return entry;
    } else if (entry.type === 'cidr') {
      const cidr = parseCidr(entry.value);
      if (cidr && cidrContains(cidr, ip)) return entry;
    }
  }
  return undefined;
}

/**
 * Evaluate whether an operation against `rawTarget` is authorized by `entries`.
 */
export function evaluateTarget(
  rawTarget: string,
  entries: ScopeEntry[],
  options: EvaluateOptions = {},
): ScopeDecision {
  if (options.emergencyStop) {
    return { allowed: false, code: 'EMERGENCY_STOP', reason: 'Emergency stop is active for this mission.' };
  }
  if (!entries || entries.length === 0) {
    return { allowed: false, code: 'NO_SCOPE', reason: 'No authorized scope is defined.' };
  }

  const host = normalizeTarget(rawTarget);
  if (!host) {
    return { allowed: false, code: 'INVALID_TARGET', reason: `Target "${rawTarget}" is not a valid host/IP/URL.` };
  }

  const asIp = parseIp(host);

  // Case 1: target is a literal IP.
  if (asIp) {
    if (isPrivateOrReserved(asIp) && !options.allowPrivateRanges) {
      return {
        allowed: false,
        code: 'PRIVATE_RANGE_BLOCKED',
        reason: `Target ${host} is in a private/reserved range (SSRF protection). Authorize explicitly for lab use.`,
      };
    }
    const match = ipInEntries(asIp, entries);
    if (match) return { allowed: true, code: 'ALLOWED', reason: `IP ${host} is in scope.`, matched: match };
    return { allowed: false, code: 'NOT_IN_SCOPE', reason: `IP ${host} is not in the authorized scope.` };
  }

  // Case 2: target is a hostname.
  const hostEntry = entries.find((e) => e.type === 'host' && hostMatches(e.value, host));

  // Resolve & validate IPs (DNS-rebind + SSRF defense).
  const resolved = options.resolvedIps ?? [];
  if (resolved.length === 0) {
    if (options.requireResolution) {
      return { allowed: false, code: 'UNRESOLVED', reason: `Hostname ${host} must be resolved before an active operation.` };
    }
    // Passive context: hostname entry alone may authorize.
    if (hostEntry) return { allowed: true, code: 'ALLOWED', reason: `Host ${host} is in scope (passive).`, matched: hostEntry };
    return { allowed: false, code: 'NOT_IN_SCOPE', reason: `Host ${host} is not in the authorized scope.` };
  }

  const parsedIps: ParsedIp[] = [];
  for (const raw of resolved) {
    const p = parseIp(raw);
    if (!p) return { allowed: false, code: 'INVALID_TARGET', reason: `Resolved address "${raw}" is not a valid IP.` };
    parsedIps.push(p);
  }

  // SSRF: every resolved IP must be public (unless allowPrivateRanges).
  for (const ip of parsedIps) {
    if (isPrivateOrReserved(ip) && !options.allowPrivateRanges) {
      return {
        allowed: false,
        code: 'PRIVATE_RANGE_BLOCKED',
        reason: `Host ${host} resolves to a private/reserved address - blocked (SSRF / DNS-rebind protection).`,
      };
    }
  }

  // Authorization: either the host entry authorizes it AND every resolved IP is
  // also acceptable, or every resolved IP is itself in an ip/cidr entry.
  if (hostEntry) {
    // host entry authorizes the name; resolved IPs already passed SSRF check.
    return { allowed: true, code: 'ALLOWED', reason: `Host ${host} is in scope and resolves to permitted address(es).`, matched: hostEntry };
  }

  // No host entry: require EVERY resolved IP to be explicitly in scope.
  const everyIpInScope = parsedIps.every((ip) => ipInEntries(ip, entries));
  if (everyIpInScope && parsedIps.length > 0) {
    return { allowed: true, code: 'ALLOWED', reason: `All resolved addresses for ${host} are in scope.` };
  }

  return {
    allowed: false,
    code: 'NOT_IN_SCOPE',
    reason: `Host ${host} is not authorized (no matching host entry and not all resolved IPs are in scope).`,
  };
}
