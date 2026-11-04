import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [PlatformController],
  providers: [DashboardService],
})
export class PlatformModule {}
