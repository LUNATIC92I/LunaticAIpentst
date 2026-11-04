/**
 * Per-request SSRF filter for the integrated browser (pure).
 *
 * The browser must never reach internal/metadata endpoints, even via a
 * sub-resource or a redirect. Every request's host is checked: non-http(s) is
 * blocked, literal private/reserved IPs are blocked, and a hostname is blocked
 * if ANY of its resolved addresses is private/reserved. DNS resolution is done
 * by the caller and passed in, keeping this unit-testable.
 */
import { parseIp, isPrivateOrReserved } from '@lunatic/scope-engine';

export interface FilterResult {
  block: boolean;
  reason?: string;
}

export function filterRequest(rawUrl: string, resolvedIps: string[] | null): FilterResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { block: true, reason: 'invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { block: true, reason: `blocked scheme ${url.protocol}` };
  }
  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');

  const literal = parseIp(host);
  if (literal) {
    return isPrivateOrReserved(literal)
      ? { block: true, reason: `private/reserved IP ${host}` }
      : { block: false };
  }

  // Hostname: require resolution; block if unresolved or any IP is internal.
  if (!resolvedIps || resolvedIps.length === 0) {
    return { block: true, reason: `unresolved host ${host}` };
  }
  for (const ip of resolvedIps) {
    const parsed = parseIp(ip);
    if (parsed && isPrivateOrReserved(parsed)) {
      return { block: true, reason: `${host} resolves to private/reserved ${ip}` };
    }
  }
  return { block: false };
}
