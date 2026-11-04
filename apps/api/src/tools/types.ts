/**
 * Tool adapter framework. Each adapter knows how to build a safe argv command
 * for a tool and how to parse its output into structured findings. Parsers are
 * pure so they can be unit-tested against recorded tool output without running
 * the tools. Commands are argv arrays (never shell strings) — no injection.
 */
export type ToolCategory = 'recon' | 'web' | 'network' | 'code';
export type TargetKind = 'host' | 'url' | 'ip' | 'path' | 'any';

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FindingState = 'POTENTIAL' | 'DETECTED' | 'REPRODUCED' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'INCONCLUSIVE';

export interface NewFinding {
  title: string;
  description?: string;
  severity: Severity;
  state: FindingState;
  cwe?: string;
  cve?: string;
  owasp?: string;
}

export interface ParsedToolResult {
  summary: string;
  findings: NewFinding[];
}

export interface ToolAdapter {
  readonly name: string;
  readonly category: ToolCategory;
  readonly targetKind: TargetKind;
  /** Active tools send traffic to the target and require scope authorization. */
  readonly active: boolean;
  readonly description: string;
  /** Build the argv to run. `target` has already been scope-approved. */
  buildCommand(target: string): string[];
  /** Parse tool output into structured findings. Must never throw. */
  parse(stdout: string, stderr: string, exitCode: number): ParsedToolResult;
}

/** Map common vendor severity strings to our enum. */
export function normalizeSeverity(raw: string | undefined): Severity {
  switch ((raw ?? '').toLowerCase()) {
    case 'critical':
      return 'CRITICAL';
    case 'high':
    case 'error':
      return 'HIGH';
    case 'medium':
    case 'warning':
    case 'moderate':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    default:
      return 'INFO';
  }
}

/** Parse newline-delimited JSON leniently (skips blank/garbage lines). */
export function parseJsonLines(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || (t[0] !== '{' && t[0] !== '[')) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}
