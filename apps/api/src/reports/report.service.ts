import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { chromium } from 'playwright';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EvidenceService } from '../agent/evidence.service';
import { buildReportModel, type ReportFinding } from './report-model';
import { toCsv, toHtml, toJson } from './renderers';

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const REPORTS_DIR = process.env.REPORTS_DIR || join(tmpdir(), 'lunatic-reports');

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  html: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
};

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evidence: EvidenceService,
  ) {
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  }

  private async mustOwn(orgId: string, missionId: string) {
    const m = await this.prisma.task.findFirst({ where: { id: missionId, orgId } });
    if (!m) throw new NotFoundException('Mission not found');
    return m;
  }

  async generate(orgId: string, missionId: string, format: 'pdf' | 'html' | 'json' | 'csv', actorId?: string) {
    const mission = await this.mustOwn(orgId, missionId);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } });
    const scope = await this.prisma.scopeEntry.findMany({ where: { taskId: missionId } });
    const findingsRaw = await this.prisma.finding.findMany({
      where: { taskId: missionId },
      include: { evidence: { select: { kind: true, summary: true, hash: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const integrity = await this.evidence.verifyChain(missionId);

    const findings: ReportFinding[] = findingsRaw.map((f) => ({
      title: f.title,
      description: f.description,
      severity: f.severity,
      state: f.state,
      cwe: f.cwe,
      cve: f.cve,
      owasp: f.owasp,
      cvssScore: f.cvssScore,
      cvssVector: f.cvssVector,
      remediation: f.remediation,
      evidence: f.evidence,
    }));

    const model = buildReportModel({
      mission: {
        id: mission.id,
        name: mission.name,
        description: mission.description,
        status: mission.status,
        mode: mission.mode,
        permissionMode: mission.permissionMode,
      },
      organization: org,
      scope: scope.map((s) => ({ type: s.type, value: s.value })),
      findings,
      evidenceIntegrity: { count: integrity.count, valid: integrity.valid },
    });

    // Create the record first so we have an id for the filename.
    const report = await this.prisma.report.create({
      data: { orgId, taskId: missionId, title: model.title, format, status: 'generating', content: model as object },
    });

    let bytes: Buffer;
    if (format === 'json') bytes = Buffer.from(toJson(model), 'utf8');
    else if (format === 'csv') bytes = Buffer.from(toCsv(model), 'utf8');
    else if (format === 'html') bytes = Buffer.from(toHtml(model), 'utf8');
    else bytes = await this.renderPdf(toHtml(model));

    const objectKey = join(REPORTS_DIR, `${report.id}.${format}`);
    await writeFile(objectKey, bytes);

    const updated = await this.prisma.report.update({
      where: { id: report.id },
      data: { status: 'ready', objectKey },
    });
    await this.audit.record({ orgId, actorId, action: 'report.generate', target: missionId, metadata: { format, reportId: report.id } });
    return { id: updated.id, format, status: updated.status, bytes: bytes.length, findings: findings.length };
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '18mm', bottom: '18mm', left: '0', right: '0' } });
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  async list(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    return this.prisma.report.findMany({
      where: { taskId: missionId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, format: true, status: true, createdAt: true },
    });
  }

  async download(orgId: string, reportId: string): Promise<{ filename: string; mime: string; body: Buffer }> {
    const report = await this.prisma.report.findFirst({ where: { id: reportId, orgId } });
    if (!report || !report.objectKey) throw new NotFoundException('Report not found');
    const body = await readFile(report.objectKey);
    return { filename: `report-${report.id}.${report.format}`, mime: MIME[report.format] ?? 'application/octet-stream', body };
  }
}
