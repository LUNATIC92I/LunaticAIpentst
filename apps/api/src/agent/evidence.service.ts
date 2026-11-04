import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeEvidenceHash, sha256, verifyEvidenceChain } from './evidence-hash';

export interface AppendEvidenceInput {
  taskId: string;
  kind: string; // command_output | http_response | note | screenshot | file
  content: string;
  summary?: string;
  findingId?: string;
  toolRunId?: string;
  objectKey?: string;
}

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append a timestamped, hash-chained evidence record for a mission. */
  async append(input: AppendEvidenceInput) {
    const contentHash = sha256(input.content);
    const last = await this.prisma.evidence.findFirst({
      where: { taskId: input.taskId },
      orderBy: { createdAt: 'desc' },
    });
    const prevHash = last?.hash ?? null;
    const createdAt = new Date();
    const hash = computeEvidenceHash({
      contentHash,
      prevHash,
      createdAtIso: createdAt.toISOString(),
      taskId: input.taskId,
    });

    return this.prisma.evidence.create({
      data: {
        taskId: input.taskId,
        findingId: input.findingId,
        toolRunId: input.toolRunId,
        kind: input.kind,
        summary: input.summary,
        objectKey: input.objectKey,
        contentHash,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  /** Recompute and verify the whole evidence chain for a mission. */
  async verifyChain(taskId: string) {
    const rows = await this.prisma.evidence.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
    const records = rows.map((r) => ({
      contentHash: r.contentHash,
      prevHash: r.prevHash,
      hash: r.hash,
      createdAtIso: r.createdAt.toISOString(),
      taskId: r.taskId,
    }));
    return { count: rows.length, ...verifyEvidenceChain(records) };
  }
}
