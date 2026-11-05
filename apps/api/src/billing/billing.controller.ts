import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

const checkoutSchema = z.object({ tier: z.enum(['PRO', 'PRO_PLUS', 'ULTRA', 'TEAM']) });
type CheckoutDto = z.infer<typeof checkoutSchema>;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get('plans')
  @Permissions('mission:read')
  plans() {
    return this.billing.plans();
  }

  @Get('overview')
  @Permissions('mission:read')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.overview(this.orgOf(user));
  }

  @Get('invoices')
  @Permissions('mission:read')
  invoices(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.invoices(this.orgOf(user));
  }

  @Get('usage')
  @Permissions('mission:read')
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.usageRecords(this.orgOf(user));
  }

  @Post('checkout')
  @Permissions('billing:manage')
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutDto,
  ) {
    const orgId = this.orgOf(user);
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { email: true } });
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    return this.billing.checkout(orgId, dto.tier, u.email, appUrl);
  }
}
