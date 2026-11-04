import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PlatformController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Current user + their organization + effective permissions. */
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.userId },
      select: { id: true, email: true, displayName: true, mfaEnabled: true, lastLoginAt: true },
    });
    const org = current.orgId
      ? await this.prisma.organization.findUnique({
          where: { id: current.orgId },
          select: { id: true, name: true, slug: true },
        })
      : null;
    return { user, org, permissions: current.permissions };
  }

  /** Dashboard statistics for the user's organization. */
  @Get('dashboard/stats')
  async dashboardStats(@CurrentUser() current: AuthenticatedUser) {
    if (!current.orgId) throw new ForbiddenException('No organization context');
    return this.dashboard.stats(current.orgId);
  }
}
