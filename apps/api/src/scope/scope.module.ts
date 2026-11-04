import { Global, Module } from '@nestjs/common';
import { ScopeGuardService } from './scope-guard.service';

@Global()
@Module({
  providers: [ScopeGuardService],
  exports: [ScopeGuardService],
})
export class ScopeModule {}
