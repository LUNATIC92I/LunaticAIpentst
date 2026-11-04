import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { BrowserService } from './browser.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';

const visitSchema = z.object({ url: z.string().min(1).max(2048) });
type VisitDto = z.infer<typeof visitSchema>;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('missions/:id/browser')
export class BrowserController {
  constructor(private readonly browser: BrowserService) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get('status')
  @Permissions('mission:read')
  async status() {
    return { available: await this.browser.available() };
  }

  @Post('visit')
  @Permissions('tool:run')
  visit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(visitSchema)) dto: VisitDto,
  ) {
    return this.browser.visit(this.orgOf(user), id, dto.url, user.userId);
  }

  @Get('history')
  @Permissions('mission:read')
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.browser.history(this.orgOf(user), id);
  }
}
