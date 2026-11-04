import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { Permissions } from '../common/decorators';
import { toolCatalog } from './registry';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tools')
export class ToolsController {
  @Get('catalog')
  @Permissions('mission:read')
  catalog() {
    return toolCatalog();
  }
}
