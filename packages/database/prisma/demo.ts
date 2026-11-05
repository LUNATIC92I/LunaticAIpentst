/**
 * Safe demo data for the local demo environment. Populates the demo org with
 * sample missions, findings and a valid hash-chained evidence trail. Targets are
 * documentation-only (example.com and RFC 5737 / TEST-NET ranges) - never real
 * third-party systems. Idempotent: skips if demo missions already exist.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
function chainHash(contentHash: string, prev: string | null, iso: string, taskId: string) {
  return sha256([contentHash, prev ?? 'GENESIS', iso, taskId].join('|'));
}

async function addEvidence(taskId: string, kind: string, content: string, summary: string, prev: string | null, when: Date) {
  const contentHash = sha256(content);
  const iso = when.toISOString();
  const hash = chainHash(contentHash, prev, iso, taskId);
  const ev = await prisma.evidence.create({
    data: { taskId, kind, summary, contentHash, prevHash: prev, hash, createdAt: when },
  });
  return ev.hash;
}

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: 'demo' } });
  const user = await prisma.user.findUnique({ where: { email: 'demo@lunatic.local' } });
  if (!org || !user) {
    console.error('Run the base seed first (pnpm db:seed).');
    process.exit(1);
  }

  const existing = await prisma.task.count({ where: { orgId: org.id, name: { startsWith: '[Demo]' } } });
  if (existing > 0) {
    console.log('Demo data already present - skipping.');
    return;
  }

  // Mission 1: completed external assessment with findings + evidence.
  const m1 = await prisma.task.create({
    data: {
      orgId: org.id, ownerId: user.id, name: '[Demo] External perimeter assessment',
      description: 'Authorized external assessment of the documentation domain.',
      status: 'COMPLETED', mode: 'AGENT', permissionMode: 'SUPERVISED', agentProfile: 'PRO',
    },
  });
  await prisma.scopeEntry.createMany({
    data: [
      { taskId: m1.id, type: 'host', value: 'example.com' },
      { taskId: m1.id, type: 'cidr', value: '192.0.2.0/24', note: 'RFC 5737 TEST-NET-1' },
    ],
  });

  const t0 = new Date(Date.now() - 3600_000);
  let prev = await addEvidence(m1.id, 'note', JSON.stringify({ code: 'ALLOWED' }), 'Authorization verified for example.com', null, t0);
  prev = await addEvidence(m1.id, 'command_output', '93.184.216.34', 'DNS resolution for example.com', prev, new Date(t0.getTime() + 1000));
  prev = await addEvidence(m1.id, 'http_response', JSON.stringify({ status: 200, server: 'ECS' }), 'httpx probe of https://example.com', prev, new Date(t0.getTime() + 2000));

  const ev = await prisma.evidence.findFirst({ where: { taskId: m1.id, kind: 'http_response' } });
  await prisma.finding.create({
    data: {
      taskId: m1.id, title: 'Missing HTTP security headers', state: 'CONFIRMED', severity: 'MEDIUM',
      cwe: 'CWE-693', owasp: 'A05:2021', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N', cvssScore: 3.1,
      description: 'Response is missing Content-Security-Policy and HSTS headers.',
      remediation: 'Add CSP and Strict-Transport-Security headers at the edge.',
      evidence: ev ? { connect: { id: ev.id } } : undefined,
    },
  });
  await prisma.finding.create({
    data: {
      taskId: m1.id, title: 'Hosts resolved for example.com', state: 'POTENTIAL', severity: 'INFO',
      description: 'In-scope target resolves to 93.184.216.34.',
    },
  });

  // Mission 2: running agent mission.
  await prisma.task.create({
    data: {
      orgId: org.id, ownerId: user.id, name: '[Demo] Staging web application review',
      description: 'Authenticated review of the staging environment (lab).',
      status: 'RUNNING', mode: 'AGENT', permissionMode: 'APPROVAL', agentProfile: 'STANDARD',
    },
  });

  // Mission 3: chat-mode draft.
  await prisma.task.create({
    data: {
      orgId: org.id, ownerId: user.id, name: '[Demo] API authentication hardening',
      description: 'Advisory engagement - configuration review.',
      status: 'DRAFT', mode: 'CHAT', permissionMode: 'APPROVAL', agentProfile: 'STANDARD',
    },
  });

  await prisma.usageRecord.create({ data: { orgId: org.id, kind: 'ai_tokens', quantity: 42_800 } });

  console.log('Demo data created: 3 missions, findings + hash-chained evidence.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
