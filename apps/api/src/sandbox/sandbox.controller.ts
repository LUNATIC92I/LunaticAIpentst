import { Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { SandboxUnavailableError } from './sandbox.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sandboxes')
export class SandboxController {
  constructor(private readonly sandboxes: SandboxService) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get('status')
  @Permissions('mission:read')
  status() {
    return this.sandboxes.status();
  }

  @Get()
  @Permissions('mission:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('missionId') missionId?: string) {
    return this.sandboxes.list(this.orgOf(user), missionId);
  }

  @Post('mission/:missionId')
  @Permissions('sandbox:execute')
  async create(@CurrentUser() user: AuthenticatedUser, @Param('missionId') missionId: string) {
    try {
      return await this.sandboxes.create(this.orgOf(user), missionId, user.userId);
    } catch (err) {
      if (err instanceof SandboxUnavailableError) {
        return { error: 'SANDBOX_UNAVAILABLE', message: err.message };
      }
      throw err;
    }
  }

  @Post(':id/stop')
  @Permissions('sandbox:execute')
  stop(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sandboxes.stop(this.orgOf(user), id);
  }

  @Delete(':id')
  @Permissions('sandbox:execute')
  destroy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sandboxes.destroy(this.orgOf(user), id);
  }
}
