import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Computes dashboard statistics scoped to a single organization (tenant).
 * Every number is a real query against the database — nothing is synthesized.
 * When the platform has no activity yet, counts are genuinely zero.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(orgId: string) {
    const taskWhere = { orgId };

    const [
      missionsTotal,
      missionsRunning,
      missionsCompleted,
      findingsByState,
      commandsExecuted,
      sandboxesByStatus,
      aiTokenAgg,
      recentActivity,
      recentMissions,
    ] = await Promise.all([
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'RUNNING' } }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'COMPLETED' } }),
      this.prisma.finding.groupBy({
        by: ['state'],
        where: { task: { orgId } },
        _count: { _all: true },
      }),
      this.prisma.toolExecution.count({ where: { task: { orgId } } }),
      this.prisma.sandbox.groupBy({
        by: ['status'],
        where: { task: { orgId } },
        _count: { _all: true },
      }),
      this.prisma.usageRecord.aggregate({
        where: { orgId, kind: 'ai_tokens' },
        _sum: { quantity: true },
      }),
      this.prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, target: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, name: true, status: true, mode: true, updatedAt: true },
      }),
    ]);

    const findingCount = (state: string) =>
      findingsByState.find((f) => f.state === state)?._count._all ?? 0;

    return {
      missions: {
        total: missionsTotal,
        running: missionsRunning,
        completed: missionsCompleted,
      },
      vulnerabilities: {
        discovered: findingsByState.reduce((n, f) => n + f._count._all, 0),
        confirmed: findingCount('CONFIRMED'),
        pending: findingCount('DETECTED') + findingCount('REPRODUCED') + findingCount('POTENTIAL'),
        falsePositive: findingCount('FALSE_POSITIVE'),
        bySeverity: findingsByState, // state breakdown (severity view added in Phase 10)
      },
      commandsExecuted,
      aiTokens: aiTokenAgg._sum.quantity ?? 0,
      sandboxes: sandboxesByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      recentActivity,
      recentMissions,
    };
  }
}
