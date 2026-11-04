import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuditService } from '../common/audit.service';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, AuditService],
  exports: [AiService],
})
export class AiModule {}
