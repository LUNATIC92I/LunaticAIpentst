import { Global, Module } from '@nestjs/common';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { TerminalGateway } from './terminal.gateway';
import { AuditService } from '../common/audit.service';

@Global()
@Module({
  controllers: [SandboxController],
  providers: [SandboxService, TerminalGateway, AuditService],
  exports: [SandboxService],
})
export class SandboxModule {}
