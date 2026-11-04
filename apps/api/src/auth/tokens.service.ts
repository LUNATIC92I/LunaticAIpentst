import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenClaims {
  sub: string;
  orgId: string | null;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Issues access/refresh tokens and persists hashed refresh tokens as sessions. */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(
    claims: AccessTokenClaims,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<TokenPair> {
    const accessTtl = this.config.getOrThrow<number>('JWT_ACCESS_TTL');
    const refreshTtl = this.config.getOrThrow<number>('JWT_REFRESH_TTL');

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });

    // Opaque refresh token; only its hash is stored.
    const refreshToken = `${claims.sub}.${randomBytes(48).toString('base64url')}`;
    await this.prisma.session.create({
      data: {
        userId: claims.sub,
        refreshHash: this.hashRefresh(refreshToken),
        userAgent: context.userAgent,
        ip: context.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  /** Validates a refresh token against its stored session; returns the session. */
  async validateRefresh(refreshToken: string) {
    const refreshHash = this.hashRefresh(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return session;
  }

  async revokeByRefresh(refreshToken: string): Promise<void> {
    const refreshHash = this.hashRefresh(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
