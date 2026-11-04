/**
 * Seed: system roles/permissions + a demo organization and user.
 * Demo credentials are for the safe local demo environment only.
 */
import { PrismaClient, PlanTier } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

// Minimal local password hash for the seed (the API uses argon2 in production).
function hash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

const PERMISSIONS = [
  'mission:create',
  'mission:read',
  'mission:update',
  'mission:delete',
  'sandbox:execute',
  'tool:run',
  'report:generate',
  'billing:manage',
  'admin:users',
  'admin:providers',
  'admin:system',
];

const ROLES: Record<string, string[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((p) => p !== 'billing:manage'),
  OPERATOR: [
    'mission:create',
    'mission:read',
    'mission:update',
    'sandbox:execute',
    'tool:run',
    'report:generate',
  ],
  VIEWER: ['mission:read'],
};

async function main() {
  // Permissions
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  // Roles + role-permissions
  for (const [name, perms] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
    for (const key of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // Demo org + owner (safe demo environment only)
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Organization', slug: 'demo' },
  });

  await prisma.subscription.create({
    data: { orgId: org.id, tier: PlanTier.PRO },
  }).catch(() => undefined);

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'OWNER' } });
  const user = await prisma.user.upsert({
    where: { email: 'demo@lunatic.local' },
    update: {},
    create: {
      email: 'demo@lunatic.local',
      passwordHash: hash('demo-password-change-me'),
      displayName: 'Demo Operator',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: {},
    create: { userId: user.id, orgId: org.id, roleId: ownerRole.id },
  });

  console.log('Seed complete. Demo org + user created (demo@lunatic.local).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
