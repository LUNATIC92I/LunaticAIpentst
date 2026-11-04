import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Append-only audit log for sensitive actions. Never throws into the caller. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          orgId: entry.orgId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          target: entry.target,
          metadata: (entry.metadata ?? undefined) as object | undefined,
          ip: entry.ip,
        },
      });
    } catch (err) {
      // Auditing must never break the request path, but the failure is logged.
      this.logger.error(`Failed to write audit log for ${entry.action}: ${String(err)}`);
    }
  }
}
