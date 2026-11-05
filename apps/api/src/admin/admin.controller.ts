import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';

const suspendSchema = z.object({ suspend: z.boolean() });
const roleSchema = z.object({ roleId: z.string().min(1) });
const tierSchema = z.object({ tier: z.enum(['FREE', 'PRO', 'PRO_PLUS', 'ULTRA', 'TEAM']) });

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billing: BillingService,
  ) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get('users')
  @Permissions('admin:users')
  users(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.users(this.orgOf(user));
  }

  @Get('roles')
  @Permissions('admin:users')
  roles() {
    return this.admin.roles();
  }

  @Post('users/:id/suspend')
  @Permissions('admin:users')
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(suspendSchema)) dto: { suspend: boolean },
  ) {
    return this.admin.suspendUser(this.orgOf(user), id, dto.suspend, user.userId);
  }

  @Post('users/:id/role')
  @Permissions('admin:users')
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(roleSchema)) dto: { roleId: string },
  ) {
    return this.admin.setRole(this.orgOf(user), id, dto.roleId, user.userId);
  }

  @Get('audit')
  @Permissions('admin:system')
  audit(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.admin.auditLogs(this.orgOf(user), limit ? Number(limit) : 100);
  }

  @Get('stats')
  @Permissions('admin:system')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.systemStats(this.orgOf(user));
  }

  @Post('plan')
  @Permissions('billing:manage')
  setTier(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(tierSchema)) dto: { tier: 'FREE' | 'PRO' | 'PRO_PLUS' | 'ULTRA' | 'TEAM' },
  ) {
    return this.billing.setTier(this.orgOf(user), dto.tier, user.userId);
  }
}
