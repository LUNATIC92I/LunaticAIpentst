import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { CurrentUser, Permissions, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod.pipe';
import {
  addScopeEntrySchema,
  createMissionSchema,
  postMessageSchema,
  scopeCheckSchema,
  transitionSchema,
  updateMissionSchema,
  type AddScopeEntryDto,
  type CreateMissionDto,
  type PostMessageDto,
  type ScopeCheckDto,
  type TransitionDto,
  type UpdateMissionDto,
} from './missions.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  private orgOf(user: AuthenticatedUser): string {
    if (!user.orgId) throw new ForbiddenException('No organization context');
    return user.orgId;
  }

  @Get()
  @Permissions('mission:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.missions.list(this.orgOf(user));
  }

  @Get(':id')
  @Permissions('mission:read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.missions.get(this.orgOf(user), id);
  }

  @Post()
  @Permissions('mission:create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMissionSchema)) dto: CreateMissionDto,
  ) {
    return this.missions.create(this.orgOf(user), user.userId, dto);
  }

  @Patch(':id')
  @Permissions('mission:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMissionSchema)) dto: UpdateMissionDto,
  ) {
    return this.missions.update(this.orgOf(user), id, dto);
  }

  @Post(':id/transition')
  @Permissions('mission:update')
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transitionSchema)) dto: TransitionDto,
  ) {
    return this.missions.transition(this.orgOf(user), id, dto.to, user.userId);
  }

  @Post(':id/emergency-stop')
  @Permissions('mission:update')
  emergencyStop(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.missions.setEmergencyStop(this.orgOf(user), id, true, user.userId);
  }

  @Delete(':id/emergency-stop')
  @Permissions('mission:update')
  clearEmergencyStop(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.missions.setEmergencyStop(this.orgOf(user), id, false, user.userId);
  }

  // --- Scope ---
  @Post(':id/scope')
  @Permissions('mission:update')
  addScope(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addScopeEntrySchema)) dto: AddScopeEntryDto,
  ) {
    return this.missions.addScopeEntry(this.orgOf(user), id, dto, user.userId);
  }

  @Delete(':id/scope/:entryId')
  @Permissions('mission:update')
  removeScope(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.missions.removeScopeEntry(this.orgOf(user), id, entryId, user.userId);
  }

  @Post(':id/scope/check')
  @Permissions('mission:read')
  scopeCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(scopeCheckSchema)) dto: ScopeCheckDto,
  ) {
    return this.missions.scopeCheck(this.orgOf(user), id, dto, user.userId);
  }

  // --- Chat ---
  @Get(':id/messages')
  @Permissions('mission:read')
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.missions.listMessages(this.orgOf(user), id);
  }

  @Post(':id/messages')
  @Permissions('mission:update')
  postMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(postMessageSchema)) dto: PostMessageDto,
  ) {
    return this.missions.postMessage(this.orgOf(user), id, user.userId, dto);
  }
}
