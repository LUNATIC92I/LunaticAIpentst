import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ReportService } from './report.service';
import { FindingsService, updateFindingSchema, type UpdateFindingDto } from './findings.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';

const generateSchema = z.object({ format: z.enum(['pdf', 'html', 'json', 'csv']).default('pdf') });
type GenerateDto = z.infer<typeof generateSchema>;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportService,
    private readonly findings: FindingsService,
  ) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  // --- Findings ---
  @Get('missions/:id/findings')
  @Permissions('mission:read')
  listFindings(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.findings.list(this.orgOf(user), id);
  }

  @Patch('missions/:id/findings/:findingId')
  @Permissions('mission:update')
  updateFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('findingId') findingId: string,
    @Body(new ZodValidationPipe(updateFindingSchema)) dto: UpdateFindingDto,
  ) {
    return this.findings.update(this.orgOf(user), id, findingId, dto, user.userId);
  }

  // --- Reports ---
  @Post('missions/:id/reports')
  @Permissions('report:generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateSchema)) dto: GenerateDto,
  ) {
    return this.reports.generate(this.orgOf(user), id, dto.format, user.userId);
  }

  @Get('missions/:id/reports')
  @Permissions('mission:read')
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reports.list(this.orgOf(user), id);
  }

  @Get('reports/:reportId/download')
  @Permissions('mission:read')
  async download(@CurrentUser() user: AuthenticatedUser, @Param('reportId') reportId: string, @Res() res: Response) {
    const { filename, mime, body } = await this.reports.download(this.orgOf(user), reportId);
    res.setHeader('content-type', mime);
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }
}
