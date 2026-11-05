import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService, type AccessTokenClaims } from './tokens.service';
import { AuditService } from '../common/audit.service';
import {
  hashPassword,
  verifyPassword,
  sealSecret,
  openSecret,
  generateTotpSecret,
  verifyTotp,
  buildOtpauthUri,
} from '@lunatic/security';
import type { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `org-${Date.now()}`
    );
  }

  /** Resolve a user's claims (org + permissions) for token issuance. */
  private async loadClaims(userId: string): Promise<AccessTokenClaims> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const permissions = membership?.role.rolePermissions.map((rp) => rp.permission.key) ?? [];
    return { sub: userId, orgId: membership?.orgId ?? null, permissions };
  }

  async register(dto: RegisterDto, ctx: { ip?: string; userAgent?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, passwordHash, displayName: dto.displayName },
      });

      // Each new user gets an organization they own (tenant isolation root).
      const baseSlug = this.slugify(dto.organizationName ?? dto.email.split('@')[0]!);
      let slug = baseSlug;
      for (let i = 1; await tx.organization.findUnique({ where: { slug } }); i++) {
        slug = `${baseSlug}-${i}`;
      }
      const org = await tx.organization.create({
        data: { name: dto.organizationName ?? `${dto.displayName ?? 'My'} Organization`, slug },
      });

      const ownerRole = await tx.role.findUnique({ where: { name: 'OWNER' } });
      if (!ownerRole) throw new BadRequestException('System roles not seeded (run db:seed)');

      await tx.membership.create({ data: { userId: user.id, orgId: org.id, roleId: ownerRole.id } });
      await tx.subscription.create({ data: { orgId: org.id } });
      return { user, org };
    });

    await this.audit.record({
      orgId: result.org.id,
      actorId: result.user.id,
      action: 'auth.register',
      ip: ctx.ip,
    });

    const claims = await this.loadClaims(result.user.id);
    return this.tokens.issue(claims, ctx);
  }

  async login(dto: LoginDto, ctx: { ip?: string; userAgent?: string }) {
    const maxAttempts = this.config.getOrThrow<number>('LOGIN_MAX_ATTEMPTS');
    const lockoutSeconds = this.config.getOrThrow<number>('LOGIN_LOCKOUT_SECONDS');

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Record every attempt; use a generic error to avoid user enumeration.
    const fail = async (reason: string) => {
      await this.prisma.loginEvent.create({
        data: { userId: user?.id, email: dto.email, success: false, ip: ctx.ip, userAgent: ctx.userAgent, reason },
      });
    };

    if (!user) {
      await fail('no_such_user');
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await fail('locked');
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }
    if (!user.isActive || user.isSuspended) {
      await fail('inactive');
      throw new ForbiddenException('Account is not active');
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lock = failedLoginCount >= maxAttempts;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failedLoginCount,
          lockedUntil: lock ? new Date(Date.now() + lockoutSeconds * 1000) : user.lockedUntil,
        },
      });
      await fail('bad_password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // MFA
    if (user.mfaEnabled) {
      if (!dto.totp) throw new UnauthorizedException('MFA code required');
      const secret = this.decryptMfa(user.mfaSecret);
      if (!secret || !verifyTotp(dto.totp, secret, Date.now())) {
        await fail('bad_totp');
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.prisma.loginEvent.create({
      data: { userId: user.id, email: dto.email, success: true, ip: ctx.ip, userAgent: ctx.userAgent },
    });
    await this.audit.record({ actorId: user.id, action: 'auth.login', ip: ctx.ip });

    const claims = await this.loadClaims(user.id);
    return this.tokens.issue(claims, ctx);
  }

  async refresh(refreshToken: string, ctx: { ip?: string; userAgent?: string }) {
    const session = await this.tokens.validateRefresh(refreshToken);
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    // Rotate: revoke old, issue new.
    await this.tokens.revokeByRefresh(refreshToken);
    const claims = await this.loadClaims(session.userId);
    return this.tokens.issue(claims, ctx);
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeByRefresh(refreshToken);
    return { ok: true };
  }

  async logoutAll(userId: string) {
    await this.tokens.revokeAllForUser(userId);
    return { ok: true };
  }

  // --- MFA enrollment ---
  private encryptMfa(secret: string) {
    return sealSecret(secret, this.config.getOrThrow<string>('SECRETS_ENCRYPTION_KEY'));
  }
  private decryptMfa(stored: string | null): string | null {
    if (!stored) return null;
    try {
      const sealed = JSON.parse(stored);
      return openSecret(sealed, this.config.getOrThrow<string>('SECRETS_ENCRYPTION_KEY'));
    } catch {
      return null;
    }
  }

  async beginMfaEnrollment(userId: string, email: string) {
    const secret = generateTotpSecret();
    const sealed = this.encryptMfa(secret);
    // Store the (encrypted) secret but keep mfaEnabled=false until verified.
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: JSON.stringify(sealed), mfaEnabled: false },
    });
    const uri = buildOtpauthUri({
      issuer: this.config.getOrThrow<string>('MFA_ISSUER'),
      account: email,
      secretBase32: secret,
    });
    return { otpauthUri: uri };
  }

  async confirmMfaEnrollment(userId: string, totp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = this.decryptMfa(user.mfaSecret);
    if (!secret || !verifyTotp(totp, secret, Date.now())) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.record({ actorId: userId, action: 'auth.mfa.enabled' });
    return { enabled: true };
  }
}
