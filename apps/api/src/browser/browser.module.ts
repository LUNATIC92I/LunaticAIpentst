import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';
import { EvidenceService } from '../agent/evidence.service';
import { AuditService } from '../common/audit.service';

@Module({
  controllers: [BrowserController],
  providers: [BrowserService, EvidenceService, AuditService],
})
export class BrowserModule {}
