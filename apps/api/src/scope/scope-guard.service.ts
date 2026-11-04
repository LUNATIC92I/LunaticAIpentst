import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import {
  evaluateTarget,
  normalizeTarget,
  parseIp,
  type ScopeEntry,
  type ScopeDecision,
} from '@lunatic/scope-engine';

export interface ScopeCheckInput {
  target: string;
  entries: ScopeEntry[];
  /** Active operations require DNS resolution + public-range validation. */
  active?: boolean;
  /** Lab mode: allow private/reserved ranges (explicit authorization). */
  allowPrivateRanges?: boolean;
  emergencyStop?: boolean;
}

/**
 * The server-side authorization choke point. Resolves DNS for hostnames (so the
 * pure scope engine can enforce DNS-rebind / SSRF protection), then evaluates
 * the target against the mission's authorized scope. The agent and tool runners
 * MUST call this before any active operation — it cannot be bypassed by a
 * conversational instruction, imported file or tool output.
 */
@Injectable()
export class ScopeGuardService {
  private readonly logger = new Logger(ScopeGuardService.name);

  private async resolveHost(host: string): Promise<string[]> {
    const withTimeout = <T>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 4000)),
      ]);
    const ips: string[] = [];
    try {
      ips.push(...(await withTimeout(dns.resolve4(host))));
    } catch {
      /* no A records */
    }
    try {
      ips.push(...(await withTimeout(dns.resolve6(host))));
    } catch {
      /* no AAAA records */
    }
    return ips;
  }

  async check(input: ScopeCheckInput): Promise<ScopeDecision & { resolvedIps?: string[] }> {
    const host = normalizeTarget(input.target);
    let resolvedIps: string[] | undefined;

    // Resolve DNS only for hostnames (not literal IPs) when running actively.
    if (host && !parseIp(host) && input.active) {
      resolvedIps = await this.resolveHost(host);
    }

    const decision = evaluateTarget(input.target, input.entries, {
      requireResolution: input.active,
      resolvedIps,
      allowPrivateRanges: input.allowPrivateRanges,
      emergencyStop: input.emergencyStop,
    });

    if (!decision.allowed) {
      this.logger.warn(`Scope check BLOCKED target="${input.target}" code=${decision.code}`);
    }
    return { ...decision, resolvedIps };
  }
}
