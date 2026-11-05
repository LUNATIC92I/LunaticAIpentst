import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from '../common/audit.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AuditService],
})
export class AdminModule {}
