import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

/**
 * Organization administration (tenant-scoped). Manages the members, roles and
 * operational view of one organization. Every action is audit-logged.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async users(orgId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, email: true, displayName: true, isSuspended: true, mfaEnabled: true, lastLoginAt: true, createdAt: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.user, role: m.role, membershipId: m.id }));
  }

  roles() {
    return this.prisma.role.findMany({ select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } });
  }

  async suspendUser(orgId: string, userId: string, suspend: boolean, actorId: string) {
    // Ensure the target belongs to this org.
    const membership = await this.prisma.membership.findFirst({ where: { orgId, userId } });
    if (!membership) throw new NotFoundException('User is not a member of this organization');
    if (userId === actorId) throw new BadRequestException('You cannot suspend your own account');

    const user = await this.prisma.user.update({ where: { id: userId }, data: { isSuspended: suspend } });
    if (suspend) {
      // Revoke active sessions on suspension.
      await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({ orgId, actorId, action: suspend ? 'admin.user.suspend' : 'admin.user.reinstate', target: userId });
    return { id: user.id, isSuspended: user.isSuspended };
  }

  async setRole(orgId: string, userId: string, roleId: string, actorId: string) {
    const membership = await this.prisma.membership.findFirst({ where: { orgId, userId } });
    if (!membership) throw new NotFoundException('User is not a member of this organization');
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new BadRequestException('Unknown role');
    await this.prisma.membership.update({ where: { id: membership.id }, data: { roleId } });
    await this.audit.record({ orgId, actorId, action: 'admin.user.role', target: userId, metadata: { role: role.name } });
    return { userId, role: role.name };
  }

  auditLogs(orgId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, target: true, actorId: true, metadata: true, createdAt: true },
    });
  }

  async systemStats(orgId: string) {
    const [members, missions, running, findings, confirmed, sandboxes, toolRuns, reports, providers] = await Promise.all([
      this.prisma.membership.count({ where: { orgId } }),
      this.prisma.task.count({ where: { orgId } }),
      this.prisma.task.count({ where: { orgId, status: 'RUNNING' } }),
      this.prisma.finding.count({ where: { task: { orgId } } }),
      this.prisma.finding.count({ where: { task: { orgId }, state: 'CONFIRMED' } }),
      this.prisma.sandbox.count({ where: { task: { orgId } } }),
      this.prisma.toolExecution.count({ where: { task: { orgId } } }),
      this.prisma.report.count({ where: { orgId } }),
      this.prisma.aiProvider.count({ where: { orgId } }),
    ]);
    return { members, missions, running, findings, confirmed, sandboxes, toolRuns, reports, providers };
  }
}
