import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportService } from './report.service';
import { FindingsService } from './findings.service';
import { EvidenceService } from '../agent/evidence.service';
import { AuditService } from '../common/audit.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportService, FindingsService, EvidenceService, AuditService],
})
export class ReportsModule {}
