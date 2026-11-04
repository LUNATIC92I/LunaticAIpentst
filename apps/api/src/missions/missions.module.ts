import { Module } from '@nestjs/common';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { AuditService } from '../common/audit.service';

@Module({
  controllers: [MissionsController],
  providers: [MissionsService, AuditService],
})
export class MissionsModule {}
