import { describe, it, expect } from 'vitest';
import { computeBaseScore, ratingForScore, parseVector } from '../src/reports/cvss';
import { buildReportModel, type ReportFinding } from '../src/reports/report-model';
import { toCsv, toJson, toHtml } from '../src/reports/renderers';

describe('CVSS v3.1', () => {
  it('scores Log4Shell as 10.0 Critical', () => {
    const r = computeBaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H');
    expect(r?.score).toBe(10);
    expect(r?.severity).toBe('Critical');
  });
  it('scores a classic medium vector', () => {
    // AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N -> 5.4 Medium
    const r = computeBaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N');
    expect(r?.score).toBeCloseTo(5.4, 1);
    expect(r?.severity).toBe('Medium');
  });
  it('returns null for an incomplete vector', () => {
    expect(computeBaseScore('CVSS:3.1/AV:N/AC:L')).toBeNull();
  });
  it('rates score bands', () => {
    expect(ratingForScore(0)).toBe('None');
    expect(ratingForScore(3.9)).toBe('Low');
    expect(ratingForScore(7.0)).toBe('High');
    expect(ratingForScore(9.1)).toBe('Critical');
  });
  it('parses a vector', () => {
    expect(parseVector('CVSS:3.1/AV:N/AC:H').AV).toBe('N');
  });
});

const findings: ReportFinding[] = [
  { title: 'RCE', description: 'remote code execution', severity: 'CRITICAL', state: 'CONFIRMED', cwe: 'CWE-502', cve: 'CVE-2021-44228', owasp: null, cvssScore: 10, cvssVector: 'CVSS:3.1/...', remediation: 'patch', evidence: [{ kind: 'command_output', summary: 'poc', hash: 'abcdef1234567890' }] },
  { title: 'Info header', description: null, severity: 'INFO', state: 'DETECTED', cwe: null, cve: null, owasp: null, cvssScore: null, cvssVector: null, remediation: null, evidence: [] },
];

const model = buildReportModel({
  mission: { id: 'm1', name: 'Acme test', description: null, status: 'COMPLETED', mode: 'AGENT', permissionMode: 'SUPERVISED' },
  organization: { name: 'Acme' },
  scope: [{ type: 'host', value: 'example.com' }],
  findings,
  evidenceIntegrity: { count: 3, valid: true },
  now: new Date('2026-01-02T03:04:05Z'),
});

describe('report model', () => {
  it('summarizes counts and sorts by severity', () => {
    expect(model.summary.total).toBe(2);
    expect(model.summary.highOrCritical).toBe(1);
    expect(model.summary.confirmed).toBe(1);
    expect(model.findings[0]!.severity).toBe('CRITICAL'); // critical sorts first
  });
  it('derives executive summary + conclusion from real counts', () => {
    expect(model.executiveSummary).toContain('2 finding');
    expect(model.conclusion).toMatch(/high\/critical/);
  });
});

describe('renderers', () => {
  it('JSON round-trips', () => {
    expect(JSON.parse(toJson(model)).summary.total).toBe(2);
  });
  it('CSV has a header + one row per finding, escaped', () => {
    const rows = toCsv(model).split('\n');
    expect(rows[0]).toContain('title,severity,state');
    expect(rows).toHaveLength(3);
  });
  it('HTML includes findings, CVSS, CVE and integrity', () => {
    const html = toHtml(model);
    expect(html).toContain('Security Assessment');
    expect(html).toContain('CVE-2021-44228');
    expect(html).toContain('CVSS 10');
    expect(html).toContain('Hash chain intact');
    // escaping: no raw script injection from titles
    expect(html).not.toContain('<script>');
  });
});
