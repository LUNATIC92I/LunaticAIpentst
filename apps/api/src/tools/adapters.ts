import {
  normalizeSeverity,
  parseJsonLines,
  type NewFinding,
  type ParsedToolResult,
  type ToolAdapter,
} from './types';

// --------------------------- Recon / network -------------------------------

/** nmap - service/version scan; parses the XML port table. */
export const nmapAdapter: ToolAdapter = {
  name: 'nmap',
  category: 'network',
  targetKind: 'any',
  active: true,
  description: 'Port and service/version scan.',
  buildCommand: (t) => ['nmap', '-Pn', '-sV', '-T4', '-oX', '-', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    const portRe =
      /<port protocol="(\w+)" portid="(\d+)">\s*<state state="open"[^>]*\/>\s*(?:<service name="([^"]*)"(?:[^>]*product="([^"]*)")?(?:[^>]*version="([^"]*)")?)?/g;
    let m: RegExpExecArray | null;
    while ((m = portRe.exec(stdout))) {
      const [, proto, port, service, product, version] = m;
      findings.push({
        title: `Open port ${port}/${proto}${service ? ` (${service})` : ''}`,
        description: [product, version].filter(Boolean).join(' ') || undefined,
        severity: 'INFO',
        state: 'DETECTED',
      });
    }
    return { summary: `${findings.length} open port(s)`, findings };
  },
};

/** subfinder - passive subdomain enumeration; one host per line. */
export const subfinderAdapter: ToolAdapter = {
  name: 'subfinder',
  category: 'recon',
  targetKind: 'host',
  active: false,
  description: 'Passive subdomain enumeration.',
  buildCommand: (t) => ['subfinder', '-silent', '-d', t],
  parse(stdout): ParsedToolResult {
    const hosts = stdout.split('\n').map((l) => l.trim()).filter((l) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(l));
    const findings: NewFinding[] = hosts.map((h) => ({
      title: `Subdomain: ${h}`,
      severity: 'INFO',
      state: 'DETECTED',
    }));
    return { summary: `${hosts.length} subdomain(s)`, findings };
  },
};

// --------------------------- Web -------------------------------------------

/** httpx - probe + fingerprint; JSONL output. */
export const httpxAdapter: ToolAdapter = {
  name: 'httpx',
  category: 'web',
  targetKind: 'url',
  active: true,
  description: 'HTTP probe, status, title and technology detection.',
  buildCommand: (t) => ['httpx', '-silent', '-json', '-status-code', '-title', '-tech-detect', '-u', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    for (const row of parseJsonLines(stdout) as Record<string, unknown>[]) {
      const url = String(row.url ?? row.input ?? '');
      const status = row.status_code ?? row.status;
      const tech = Array.isArray(row.tech) ? (row.tech as string[]).join(', ') : undefined;
      findings.push({
        title: `${url} -> ${status}${row.title ? ` - ${row.title}` : ''}`,
        description: tech ? `Technologies: ${tech}` : undefined,
        severity: 'INFO',
        state: 'DETECTED',
      });
    }
    return { summary: `${findings.length} endpoint(s) probed`, findings };
  },
};

/** nuclei - template-based vulnerability scanner; JSONL output. */
export const nucleiAdapter: ToolAdapter = {
  name: 'nuclei',
  category: 'web',
  targetKind: 'url',
  active: true,
  description: 'Template-based vulnerability and misconfiguration scanner.',
  buildCommand: (t) => ['nuclei', '-silent', '-jsonl', '-u', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    for (const row of parseJsonLines(stdout) as Record<string, any>[]) {
      const info = row.info ?? {};
      const sev = normalizeSeverity(info.severity);
      const classification = info.classification ?? {};
      const cve = Array.isArray(classification['cve-id']) ? classification['cve-id'][0] : classification['cve-id'];
      const cwe = Array.isArray(classification['cwe-id']) ? classification['cwe-id'][0] : classification['cwe-id'];
      findings.push({
        title: info.name ?? row['template-id'] ?? 'nuclei match',
        description: `${row['matched-at'] ?? row.host ?? ''}${info.description ? ` - ${info.description}` : ''}`.trim() || undefined,
        severity: sev,
        // Tool detection, not yet reproduced by a human/agent.
        state: 'DETECTED',
        cve: cve ? String(cve).toUpperCase() : undefined,
        cwe: cwe ? String(cwe).toUpperCase() : undefined,
      });
    }
    const highs = findings.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;
    return { summary: `${findings.length} match(es), ${highs} high/critical`, findings };
  },
};

// --------------------------- Code / secrets --------------------------------

/** semgrep - static analysis; JSON output with results[]. */
export const semgrepAdapter: ToolAdapter = {
  name: 'semgrep',
  category: 'code',
  targetKind: 'path',
  active: false,
  description: 'Static application security testing (SAST).',
  buildCommand: (t) => ['semgrep', '--json', '--quiet', '--config', 'auto', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    try {
      const doc = JSON.parse(stdout || '{}');
      for (const r of doc.results ?? []) {
        const extra = r.extra ?? {};
        const meta = extra.metadata ?? {};
        findings.push({
          title: `${r.check_id ?? 'semgrep'} @ ${r.path ?? ''}:${r.start?.line ?? '?'}`,
          description: extra.message,
          severity: normalizeSeverity(extra.severity),
          state: 'DETECTED',
          cwe: Array.isArray(meta.cwe) ? String(meta.cwe[0]) : meta.cwe,
          owasp: Array.isArray(meta.owasp) ? String(meta.owasp[0]) : meta.owasp,
        });
      }
    } catch {
      /* non-JSON output */
    }
    return { summary: `${findings.length} SAST finding(s)`, findings };
  },
};

/** gitleaks - secret scanning; JSON array report. */
export const gitleaksAdapter: ToolAdapter = {
  name: 'gitleaks',
  category: 'code',
  targetKind: 'path',
  active: false,
  description: 'Detects hardcoded secrets and credentials.',
  buildCommand: (t) => ['gitleaks', 'detect', '--no-git', '--report-format', 'json', '--report-path', '/dev/stdout', '--source', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    try {
      const arr = JSON.parse(stdout || '[]');
      for (const leak of Array.isArray(arr) ? arr : []) {
        findings.push({
          title: `Exposed secret: ${leak.RuleID ?? leak.Description ?? 'secret'}`,
          description: `${leak.File ?? ''}:${leak.StartLine ?? '?'}`,
          severity: 'HIGH',
          state: 'DETECTED',
          cwe: 'CWE-798', // Use of Hard-coded Credentials
        });
      }
    } catch {
      /* ignore */
    }
    return { summary: `${findings.length} secret(s)`, findings };
  },
};

/** trivy - filesystem/dependency vulnerability scan; JSON output. */
export const trivyAdapter: ToolAdapter = {
  name: 'trivy',
  category: 'code',
  targetKind: 'path',
  active: false,
  description: 'Dependency and filesystem vulnerability scanner.',
  buildCommand: (t) => ['trivy', 'fs', '--quiet', '--format', 'json', t],
  parse(stdout): ParsedToolResult {
    const findings: NewFinding[] = [];
    try {
      const doc = JSON.parse(stdout || '{}');
      for (const result of doc.Results ?? []) {
        for (const v of result.Vulnerabilities ?? []) {
          findings.push({
            title: `${v.VulnerabilityID} in ${v.PkgName}${v.InstalledVersion ? `@${v.InstalledVersion}` : ''}`,
            description: v.Title ?? v.Description,
            severity: normalizeSeverity(v.Severity),
            state: 'DETECTED',
            cve: typeof v.VulnerabilityID === 'string' && v.VulnerabilityID.startsWith('CVE') ? v.VulnerabilityID : undefined,
          });
        }
      }
    } catch {
      /* ignore */
    }
    return { summary: `${findings.length} dependency vuln(s)`, findings };
  },
};

export const ALL_ADAPTERS: ToolAdapter[] = [
  nmapAdapter,
  subfinderAdapter,
  httpxAdapter,
  nucleiAdapter,
  semgrepAdapter,
  gitleaksAdapter,
  trivyAdapter,
];
