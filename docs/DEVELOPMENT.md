# Development guide

## Prerequisites
- Node 22+, pnpm 10+, Docker (for the full compose stack) or a local PostgreSQL 16.

## Install
```bash
pnpm install
pnpm --filter @lunatic/database db:generate   # generate Prisma client
pnpm -r build                                  # build shared packages + api
```

## Database
With Docker:
```bash
cp .env.example .env            # fill in secrets (see below)
docker compose up -d postgres redis
pnpm --filter @lunatic/database db:migrate      # apply migrations
pnpm --filter @lunatic/database db:seed         # roles/permissions + demo org
```

Without Docker (local PostgreSQL), point `DATABASE_URL` at your instance and run
the same migrate/seed commands.

### Required env for the API
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SECRETS_ENCRYPTION_KEY`
(32 bytes base64 — generate with `openssl rand -base64 32`). See `.env.example`
for the full list. Optional integrations (AI providers, Stripe, S3, E2B) may be
blank and surface a `NOT_CONFIGURED` state.

## Run
```bash
# dev (ts-node, emits decorator metadata required by Nest DI)
pnpm --filter @lunatic/api dev
# production
pnpm --filter @lunatic/api build && pnpm --filter @lunatic/api start
```
API serves under `http://localhost:4000/api`.

> Note: use `ts-node` (not `tsx`/esbuild) for the API in dev — NestJS dependency
> injection needs emitted `design:paramtypes` metadata, which esbuild does not
> produce. Production uses the `tsc` build.

## Tests
```bash
pnpm --filter @lunatic/scope-engine test   # 28 tests — authorization/SSRF/rate
pnpm --filter @lunatic/security test        # 12 tests — scrypt/AES-GCM/TOTP
```

## Verified auth flow (Phase 2)
`register → login → refresh → logout/logout-all`, RBAC-guarded routes (401
without token, 403 without permission), login lockout, and MFA
(`mfa/begin → mfa/confirm`, then MFA-gated login). The TOTP secret is stored
AES-256-GCM-encrypted; refresh tokens are stored only as SHA-256 hashes.

## Quick smoke test
```bash
curl -s localhost:4000/api/health
curl -s -X POST localhost:4000/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"op@example.com","password":"super-secret-123","organizationName":"Acme"}'
```
