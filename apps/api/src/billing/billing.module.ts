import { Global, Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { AuditService } from '../common/audit.service';

@Global()
@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeService, AuditService],
  exports: [BillingService],
})
export class BillingModule {}
