/**
 * CVSS v3.1 base score calculator (pure). Parses a vector string and computes
 * the base score + severity rating per the FIRST.org specification. Unit-tested
 * against published vectors.
 */
export type CvssSeverity = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

const AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC: Record<string, number> = { L: 0.77, H: 0.44 };
const UI: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };
const PR_U: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_C: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };

export interface CvssResult {
  score: number;
  severity: CvssSeverity;
  vector: string;
}

function roundUp(x: number): number {
  // CVSS "Roundup": smallest number, to 1 decimal, >= x (integer-math safe).
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

export function ratingForScore(score: number): CvssSeverity {
  if (score === 0) return 'None';
  if (score <= 3.9) return 'Low';
  if (score <= 6.9) return 'Medium';
  if (score <= 8.9) return 'High';
  return 'Critical';
}

/** Parse "CVSS:3.1/AV:N/AC:L/..." into a metrics map. */
export function parseVector(vector: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of vector.split('/')) {
    const [k, v] = part.split(':');
    if (k && v && k !== 'CVSS') map[k] = v;
  }
  return map;
}

/** Compute the CVSS v3.1 base score. Returns null if required metrics missing. */
export function computeBaseScore(vector: string): CvssResult | null {
  const m = parseVector(vector);
  const required = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];
  if (required.some((k) => !(k in m))) return null;

  const scopeChanged = m.S === 'C';
  const pr = (scopeChanged ? PR_C : PR_U)[m.PR!];
  const av = AV[m.AV!];
  const ac = AC[m.AC!];
  const ui = UI[m.UI!];
  const c = CIA[m.C!];
  const i = CIA[m.I!];
  const a = CIA[m.A!];
  if ([pr, av, ac, ui, c, i, a].some((x) => x === undefined)) return null;

  const iss = 1 - (1 - c!) * (1 - i!) * (1 - a!);
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * av! * ac! * pr! * ui!;

  let score: number;
  if (impact <= 0) {
    score = 0;
  } else {
    const raw = scopeChanged
      ? Math.min(1.08 * (impact + exploitability), 10)
      : Math.min(impact + exploitability, 10);
    score = roundUp(raw);
  }
  return { score, severity: ratingForScore(score), vector };
}
