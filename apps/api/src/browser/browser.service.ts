import { existsSync } from 'node:fs';
import { promises as dns } from 'node:dns';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { chromium, type Browser } from 'playwright';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { ScopeGuardService } from '../scope/scope-guard.service';
import { EvidenceService } from '../agent/evidence.service';
import { filterRequest } from './request-filter';
import type { ScopeEntry } from '@lunatic/scope-engine';

const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';

export interface BrowserVisitResult {
  blocked?: boolean;
  decision?: { code: string; reason: string };
  finalUrl?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  redirectChain?: string[];
  blockedRequests?: string[];
  title?: string;
  textExcerpt?: string;
  screenshot?: string; // data URL
}

@Injectable()
export class BrowserService {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private readonly dnsCache = new Map<string, string[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scopeGuard: ScopeGuardService,
    private readonly evidence: EvidenceService,
  ) {}

  async available(): Promise<boolean> {
    try {
      await this.launch();
      return true;
    } catch {
      return false;
    }
  }

  private async launch(): Promise<Browser> {
    if (this.browser) return this.browser;
    const execPath = process.env.PLAYWRIGHT_CHROMIUM || DEFAULT_CHROMIUM;
    this.browser = await chromium.launch({
      headless: true,
      executablePath: existsSync(execPath) ? execPath : undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    return this.browser;
  }

  private async resolve(host: string): Promise<string[]> {
    if (this.dnsCache.has(host)) return this.dnsCache.get(host)!;
    const ips: string[] = [];
    await Promise.all([
      dns.resolve4(host).then((r) => ips.push(...r)).catch(() => undefined),
      dns.resolve6(host).then((r) => ips.push(...r)).catch(() => undefined),
    ]);
    this.dnsCache.set(host, ips);
    return ips;
  }

  private async mustOwn(orgId: string, missionId: string) {
    const m = await this.prisma.task.findFirst({ where: { id: missionId, orgId } });
    if (!m) throw new NotFoundException('Mission not found');
    return m;
  }

  private async scopeEntries(missionId: string): Promise<ScopeEntry[]> {
    const rows = await this.prisma.scopeEntry.findMany({ where: { taskId: missionId } });
    return rows.map((r) => ({ type: r.type as ScopeEntry['type'], value: r.value, note: r.note ?? undefined }));
  }

  /** Navigate to a URL under full scope + SSRF protection; capture recon data. */
  async visit(orgId: string, missionId: string, url: string, actorId?: string): Promise<BrowserVisitResult> {
    const mission = await this.mustOwn(orgId, missionId);
    const entries = await this.scopeEntries(missionId);

    // Top-level target must pass the scope guard.
    const decision = await this.scopeGuard.check({
      target: url,
      entries,
      active: true,
      emergencyStop: mission.emergencyStop,
    });
    if (!decision.allowed) {
      await this.audit.record({ orgId, actorId, action: 'browser.block', target: missionId, metadata: { url, code: decision.code } });
      return { blocked: true, decision: { code: decision.code, reason: decision.reason } };
    }

    const browser = await this.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: false, // dangerous downloads disabled
      userAgent: 'LunaticPentestAI/0.1 (authorized recon)',
    });
    const blockedRequests: string[] = [];

    // Always-on SSRF guard on EVERY request (sub-resources + redirects).
    await context.route('**/*', async (route) => {
      const reqUrl = route.request().url();
      let host = '';
      try {
        host = new URL(reqUrl).hostname.replace(/^\[/, '').replace(/\]$/, '');
      } catch {
        return route.abort();
      }
      const needsDns = host && !/^[\d.]+$/.test(host) && !host.includes(':');
      const ips = needsDns ? await this.resolve(host) : null;
      const verdict = filterRequest(reqUrl, ips);
      if (verdict.block) {
        if (blockedRequests.length < 50) blockedRequests.push(`${reqUrl} (${verdict.reason})`);
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Redirect chain
      const redirectChain: string[] = [];
      let req = response?.request();
      while (req) {
        const from = req.redirectedFrom();
        if (from) {
          redirectChain.unshift(from.url());
          req = from;
        } else break;
      }

      const headers = response ? await response.allHeaders() : {};
      const title = await page.title().catch(() => '');
      const textExcerpt = (
        (await page.evaluate('document.body ? document.body.innerText : ""').catch(() => '')) as string
      ).slice(0, 5000);
      const shot = await page.screenshot({ type: 'jpeg', quality: 55 });
      const screenshot = `data:image/jpeg;base64,${shot.toString('base64')}`;

      // Persist as a browser tool-run + hash-chained evidence.
      const host = new URL(page.url()).hostname;
      const meta = { url, finalUrl: page.url(), status: response?.status(), headers, redirectChain, title };
      const toolRun = await this.prisma.toolExecution.create({
        data: {
          taskId: missionId,
          tool: 'browser',
          command: url,
          target: host,
          status: 'SUCCEEDED',
          scopeApproved: true,
          exitCode: 0,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
      await this.prisma.toolOutput.create({
        data: { toolRunId: toolRun.id, stream: 'result', content: JSON.stringify(meta, null, 2) },
      });
      await this.evidence.append({
        taskId: missionId,
        kind: 'http_response',
        toolRunId: toolRun.id,
        summary: `GET ${url} → ${response?.status()}`,
        content: JSON.stringify(meta),
      });
      await this.evidence.append({
        taskId: missionId,
        kind: 'screenshot',
        toolRunId: toolRun.id,
        summary: `Screenshot of ${page.url()}`,
        content: shot.toString('base64'),
      });
      await this.audit.record({ orgId, actorId, action: 'browser.visit', target: missionId, metadata: { url } });

      return {
        finalUrl: page.url(),
        status: response?.status(),
        statusText: response?.statusText(),
        headers,
        redirectChain,
        blockedRequests,
        title,
        textExcerpt,
        screenshot,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  async history(orgId: string, missionId: string) {
    await this.mustOwn(orgId, missionId);
    return this.prisma.toolExecution.findMany({
      where: { taskId: missionId, tool: 'browser' },
      orderBy: { createdAt: 'desc' },
      include: { outputs: true },
    });
  }

  async onModuleDestroy() {
    await this.browser?.close().catch(() => undefined);
  }
}
