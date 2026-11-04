import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';
import { addModelSchema, addProviderSchema, type AddModelDto, type AddProviderDto } from './ai.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get('providers')
  @Permissions('mission:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.listProviders(this.orgOf(user));
  }

  @Get('status')
  @Permissions('mission:read')
  async status(@CurrentUser() user: AuthenticatedUser) {
    return { configured: await this.ai.isConfigured(this.orgOf(user)) };
  }

  @Post('providers')
  @Permissions('admin:providers')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addProviderSchema)) dto: AddProviderDto,
  ) {
    return this.ai.addProvider(this.orgOf(user), dto, user.userId);
  }

  @Post('providers/:id/models')
  @Permissions('admin:providers')
  addModel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addModelSchema)) dto: AddModelDto,
  ) {
    return this.ai.addModel(this.orgOf(user), id, dto);
  }

  @Post('providers/:id/test')
  @Permissions('admin:providers')
  test(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.testProvider(this.orgOf(user), id);
  }

  @Delete('providers/:id')
  @Permissions('admin:providers')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.removeProvider(this.orgOf(user), id, user.userId);
  }
}
