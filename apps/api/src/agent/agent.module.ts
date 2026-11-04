import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { EvidenceService } from './evidence.service';
import { AuditService } from '../common/audit.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService, EvidenceService, AuditService],
  exports: [AgentService, EvidenceService],
})
export class AgentModule {}
