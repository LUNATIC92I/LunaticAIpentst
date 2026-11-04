import { describe, it, expect } from 'vitest';
import {
  nmapAdapter,
  httpxAdapter,
  nucleiAdapter,
  subfinderAdapter,
  semgrepAdapter,
  gitleaksAdapter,
  trivyAdapter,
} from '../src/tools/adapters';
import { getAdapter, toolCatalog } from '../src/tools/registry';

describe('command builders produce safe argv', () => {
  it('build argv arrays (no shell)', () => {
    expect(nmapAdapter.buildCommand('example.com')).toEqual(['nmap', '-Pn', '-sV', '-T4', '-oX', '-', 'example.com']);
    expect(nucleiAdapter.buildCommand('https://example.com')).toContain('-jsonl');
    // target is placed as a discrete argv element, not interpolated into a string
    expect(httpxAdapter.buildCommand('https://x; rm -rf /')).toContain('https://x; rm -rf /');
  });
});

describe('nmap parser', () => {
  const xml = `<nmaprun><host><ports>
    <port protocol="tcp" portid="443"><state state="open" reason="syn-ack"/><service name="https" product="nginx" version="1.25.3"/></port>
    <port protocol="tcp" portid="22"><state state="open" reason="syn-ack"/><service name="ssh"/></port>
    <port protocol="tcp" portid="81"><state state="closed"/></port>
  </ports></host></nmaprun>`;
  it('extracts open ports only', () => {
    const r = nmapAdapter.parse(xml, '', 0);
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0]!.title).toContain('443/tcp');
    expect(r.findings[0]!.description).toContain('nginx');
  });
});

describe('httpx parser', () => {
  const jsonl = [
    JSON.stringify({ url: 'https://example.com', status_code: 200, title: 'Example', tech: ['nginx', 'HSTS'] }),
    'garbage line',
    JSON.stringify({ url: 'https://example.com/admin', status_code: 403 }),
  ].join('\n');
  it('parses JSONL probes and skips garbage', () => {
    const r = httpxAdapter.parse(jsonl, '', 0);
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0]!.description).toContain('nginx');
  });
});

describe('nuclei parser', () => {
  const jsonl = [
    JSON.stringify({
      'template-id': 'CVE-2021-44228',
      'matched-at': 'https://example.com/',
      info: { name: 'Log4j RCE', severity: 'critical', classification: { 'cve-id': ['CVE-2021-44228'], 'cwe-id': ['CWE-502'] } },
    }),
    JSON.stringify({ 'template-id': 'tech-detect', info: { name: 'nginx', severity: 'info' } }),
  ].join('\n');
  it('maps severity + CVE/CWE and summarizes', () => {
    const r = nucleiAdapter.parse(jsonl, '', 0);
    expect(r.findings).toHaveLength(2);
    const crit = r.findings[0]!;
    expect(crit.severity).toBe('CRITICAL');
    expect(crit.cve).toBe('CVE-2021-44228');
    expect(crit.cwe).toBe('CWE-502');
    expect(crit.state).toBe('DETECTED');
    expect(r.summary).toContain('1 high/critical');
  });
});

describe('subfinder parser', () => {
  it('keeps valid hostnames only', () => {
    const r = subfinderAdapter.parse('api.example.com\n  mail.example.com \nnot a host\n', '', 0);
    expect(r.findings.map((f) => f.title)).toEqual(['Subdomain: api.example.com', 'Subdomain: mail.example.com']);
  });
});

describe('semgrep parser', () => {
  const json = JSON.stringify({
    results: [
      { check_id: 'python.lang.security.audit', path: 'app.py', start: { line: 42 }, extra: { message: 'eval use', severity: 'ERROR', metadata: { cwe: ['CWE-95'], owasp: ['A03:2021'] } } },
    ],
  });
  it('maps SAST results with CWE/OWASP', () => {
    const r = semgrepAdapter.parse(json, '', 1);
    expect(r.findings[0]!.severity).toBe('HIGH');
    expect(r.findings[0]!.cwe).toBe('CWE-95');
    expect(r.findings[0]!.owasp).toBe('A03:2021');
  });
});

describe('gitleaks parser', () => {
  const json = JSON.stringify([{ RuleID: 'aws-access-key', File: 'config.env', StartLine: 3 }]);
  it('flags secrets as HIGH with CWE-798', () => {
    const r = gitleaksAdapter.parse(json, '', 1);
    expect(r.findings[0]!.severity).toBe('HIGH');
    expect(r.findings[0]!.cwe).toBe('CWE-798');
  });
});

describe('trivy parser', () => {
  const json = JSON.stringify({
    Results: [{ Vulnerabilities: [{ VulnerabilityID: 'CVE-2023-1234', PkgName: 'openssl', InstalledVersion: '1.1.1', Severity: 'HIGH', Title: 'buffer overflow' }] }],
  });
  it('maps dependency vulns with CVE + severity', () => {
    const r = trivyAdapter.parse(json, '', 0);
    expect(r.findings[0]!.cve).toBe('CVE-2023-1234');
    expect(r.findings[0]!.severity).toBe('HIGH');
  });
});

describe('registry', () => {
  it('resolves adapters and exposes a catalog', () => {
    expect(getAdapter('nuclei')?.name).toBe('nuclei');
    expect(getAdapter('nope')).toBeUndefined();
    const cat = toolCatalog();
    expect(cat.length).toBeGreaterThanOrEqual(7);
    expect(cat.every((c) => typeof c.description === 'string')).toBe(true);
  });
});
