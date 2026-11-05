import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { ScopeModule } from './scope/scope.module';
import { AiModule } from './ai/ai.module';
import { MissionsModule } from './missions/missions.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { BrowserModule } from './browser/browser.module';
import { ToolsModule } from './tools/tools.module';
import { ReportsModule } from './reports/reports.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { AgentModule } from './agent/agent.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { PermissionsGuard } from './common/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Global JWT so the APP_GUARD (JwtAuthGuard) can resolve JwtService.
    JwtModule.register({ global: true }),
    PrismaModule,
    ScopeModule,
    AiModule,
    AuthModule,
    PlatformModule,
    SandboxModule,
    BrowserModule,
    ToolsModule,
    ReportsModule,
    BillingModule,
    AdminModule,
    MissionsModule,
    AgentModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guards: authenticate every route (unless @Public), then enforce RBAC.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
