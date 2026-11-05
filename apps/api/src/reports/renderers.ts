/**
 * Report renderers (pure): JSON, CSV and a professional, print-ready HTML
 * document. The HTML is also the source for PDF generation (headless Chromium).
 */
import type { ReportModel, ReportFinding } from './report-model';

export function toJson(model: ReportModel): string {
  return JSON.stringify(model, null, 2);
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(model: ReportModel): string {
  const header = ['title', 'severity', 'state', 'cvssScore', 'cwe', 'cve', 'owasp', 'evidenceCount', 'description'];
  const rows = model.findings.map((f) =>
    [f.title, f.severity, f.state, f.cvssScore ?? '', f.cwe ?? '', f.cve ?? '', f.owasp ?? '', f.evidence.length, f.description ?? '']
      .map(csvEscape)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#b91c1c',
  HIGH: '#dc2626',
  MEDIUM: '#d97706',
  LOW: '#2563eb',
  INFO: '#64748b',
};

function findingHtml(f: ReportFinding, index: number): string {
  const color = SEV_COLOR[f.severity] ?? '#64748b';
  const tags = [
    f.cvssScore != null ? `CVSS ${f.cvssScore}` : null,
    f.cwe,
    f.cve,
    f.owasp,
  ].filter(Boolean);
  return `
  <div class="finding">
    <div class="finding-head">
      <span class="sev" style="background:${color}">${esc(f.severity)}</span>
      <h3>${index}. ${esc(f.title)}</h3>
      <span class="state">${esc(f.state)}</span>
    </div>
    ${tags.length ? `<div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    ${f.description ? `<p>${esc(f.description)}</p>` : ''}
    ${f.remediation ? `<div class="remediation"><strong>Remediation.</strong> ${esc(f.remediation)}</div>` : ''}
    <details class="evidence"><summary>Evidence (${f.evidence.length})</summary>
      <ul>${f.evidence.map((e) => `<li><code>${esc(e.kind)}</code> ${esc(e.summary ?? '')} <span class="hash">${esc(e.hash.slice(0, 16))}...</span></li>`).join('')}</ul>
    </details>
  </div>`;
}

export function toHtml(model: ReportModel): string {
  const sev = model.summary.bySeverity;
  const chip = (label: string, n: number, color: string) =>
    `<div class="stat"><span class="dot" style="background:${color}"></span>${label}<b>${n}</b></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(model.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 0; }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 56px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 16px; text-transform: uppercase; letter-spacing: .05em; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 32px 0 14px; }
  h3 { font-size: 15px; margin: 0; flex: 1; }
  .cover { border-left: 5px solid #0ea5e9; padding-left: 16px; margin-bottom: 8px; }
  .muted { color: #64748b; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  th { color: #475569; font-weight: 600; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; }
  .stat { font-size: 13px; background: #f1f5f9; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 6px; }
  .stat b { margin-left: 4px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .finding { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin: 12px 0; page-break-inside: avoid; }
  .finding-head { display: flex; align-items: center; gap: 10px; }
  .sev { color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; }
  .state { font-size: 11px; color: #475569; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .tags span { font-size: 11px; font-family: ui-monospace, monospace; background: #eef2ff; color: #3730a3; padding: 2px 7px; border-radius: 5px; }
  .remediation { background: #ecfdf5; border-left: 3px solid #10b981; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-top: 8px; }
  .evidence { margin-top: 10px; font-size: 13px; }
  .evidence .hash { font-family: ui-monospace, monospace; color: #94a3b8; }
  code { font-family: ui-monospace, monospace; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; }
  .integrity { font-size: 13px; padding: 10px 14px; border-radius: 8px; }
  .ok { background: #ecfdf5; color: #065f46; } .bad { background: #fef2f2; color: #991b1b; }
  ol.method li { margin: 4px 0; font-size: 14px; }
  footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style></head>
<body><div class="page">
  <div class="cover">
    <h1>${esc(model.title)}</h1>
    <div class="muted">${esc(model.organization.name)} - Generated ${esc(model.generatedAt)}</div>
  </div>

  <h2>Mission & authorization</h2>
  <table>
    <tr><th>Mission</th><td>${esc(model.mission.name)}</td></tr>
    <tr><th>Status</th><td>${esc(model.mission.status)} - ${esc(model.mission.mode)} - ${esc(model.mission.permissionMode)}</td></tr>
    <tr><th>Authorized scope</th><td>${model.scope.map((s) => `<code>${esc(s.type)}:${esc(s.value)}</code>`).join(' ') || '<em>none</em>'}</td></tr>
  </table>

  <h2>Executive summary</h2>
  <p>${esc(model.executiveSummary)}</p>
  <div class="stats">
    ${chip('Critical', sev.CRITICAL ?? 0, '#b91c1c')}
    ${chip('High', sev.HIGH ?? 0, '#dc2626')}
    ${chip('Medium', sev.MEDIUM ?? 0, '#d97706')}
    ${chip('Low', sev.LOW ?? 0, '#2563eb')}
    ${chip('Info', sev.INFO ?? 0, '#64748b')}
    ${chip('Confirmed', model.summary.confirmed, '#059669')}
  </div>

  <h2>Methodology</h2>
  <ol class="method">${model.methodology.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>

  <h2>Findings (${model.findings.length})</h2>
  ${model.findings.length ? model.findings.map((f, i) => findingHtml(f, i + 1)).join('') : '<p class="muted">No findings recorded.</p>'}

  <h2>Evidence integrity</h2>
  <div class="integrity ${model.evidenceIntegrity.valid ? 'ok' : 'bad'}">
    ${model.evidenceIntegrity.valid ? 'OK Hash chain intact' : 'X Hash chain broken'} - ${model.evidenceIntegrity.count} record(s).
    Every finding conclusion is traceable to a timestamped, hash-chained evidence record.
  </div>

  <h2>Conclusion</h2>
  <p>${esc(model.conclusion)}</p>

  <footer>Lunatic Pentest AI - authorized security assessment. Confidential.</footer>
</div></body></html>`;
}
