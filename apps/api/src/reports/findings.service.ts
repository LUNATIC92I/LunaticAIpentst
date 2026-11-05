import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { computeBaseScore } from './cvss';

export const updateFindingSchema = z.object({
  state: z.enum(['POTENTIAL', 'DETECTED', 'REPRODUCED', 'CONFIRMED', 'FALSE_POSITIVE', 'INCONCLUSIVE']).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  cvssVector: z.string().max(100).optional(),
  cwe: z.string().max(40).optional(),
  cve: z.string().max(40).optional(),
  owasp: z.string().max(40).optional(),
  remediation: z.string().max(4000).optional(),
});
export type UpdateFindingDto = z.infer<typeof updateFindingSchema>;

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, missionId: string) {
    const m = await this.prisma.task.findFirst({ where: { id: missionId, orgId } });
    if (!m) throw new NotFoundException('Mission not found');
    return this.prisma.finding.findMany({
      where: { taskId: missionId },
      orderBy: { createdAt: 'desc' },
      include: { evidence: { select: { id: true, kind: true, summary: true, hash: true } } },
    });
  }

  async update(orgId: string, missionId: string, findingId: string, dto: UpdateFindingDto, actorId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, task: { id: missionId, orgId } },
      include: { _count: { select: { evidence: true } } },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    const data: Record<string, unknown> = {};

    // Confirmation policy: a finding may only be CONFIRMED with >=1 evidence record.
    if (dto.state === 'CONFIRMED' && finding._count.evidence === 0) {
      throw new BadRequestException('A finding cannot be CONFIRMED without at least one evidence record.');
    }
    if (dto.state) data.state = dto.state;
    if (dto.severity) data.severity = dto.severity;
    if (dto.cwe !== undefined) data.cwe = dto.cwe;
    if (dto.cve !== undefined) data.cve = dto.cve;
    if (dto.owasp !== undefined) data.owasp = dto.owasp;
    if (dto.remediation !== undefined) data.remediation = dto.remediation;

    if (dto.cvssVector !== undefined) {
      const result = computeBaseScore(dto.cvssVector);
      if (!result) throw new BadRequestException('Invalid CVSS v3.1 vector.');
      data.cvssVector = result.vector;
      data.cvssScore = result.score;
      // Keep severity consistent with the computed CVSS rating unless overridden.
      if (!dto.severity) data.severity = result.severity.toUpperCase();
    }

    const updated = await this.prisma.finding.update({ where: { id: findingId }, data });
    await this.audit.record({ orgId, actorId, action: 'finding.update', target: findingId, metadata: { state: updated.state, severity: updated.severity } });
    return updated;
  }
}
