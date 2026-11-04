import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';
import { approveSchema, type ApproveDto } from './agent.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('missions/:id/agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Post('plan')
  @Permissions('mission:update')
  plan(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.plan(this.orgOf(user), id, user.userId);
  }

  @Get('plan')
  @Permissions('mission:read')
  getPlan(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.getPlan(this.orgOf(user), id);
  }

  @Get('executions')
  @Permissions('mission:read')
  executions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.executions(this.orgOf(user), id);
  }

  @Post('executions/:execId/approve')
  @Permissions('mission:update')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('execId') execId: string,
    @Body(new ZodValidationPipe(approveSchema)) dto: ApproveDto,
  ) {
    return this.agent.approve(this.orgOf(user), id, execId, user.userId, dto.approved);
  }

  @Post('advance')
  @Permissions('sandbox:execute')
  advance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.advance(this.orgOf(user), id, user.userId);
  }

  @Post('run')
  @Permissions('sandbox:execute')
  run(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.advanceAll(this.orgOf(user), id, user.userId);
  }

  @Get('findings')
  @Permissions('mission:read')
  findings(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.findings(this.orgOf(user), id);
  }

  @Get('evidence/verify')
  @Permissions('mission:read')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agent.verifyEvidence(this.orgOf(user), id);
  }
}
