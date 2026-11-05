# Installation

## Prerequisites
- **Node 22+** and **pnpm 10+** (`corepack enable`)
- **PostgreSQL 16** (local or via Docker)
- **Docker** (optional, for sandbox tool execution and the terminal)
- A reachable **Chromium** for the integrated browser and PDF reports - bundled
  with Playwright (`pnpm --filter @lunatic/api exec playwright install chromium`)
  or point `PLAYWRIGHT_CHROMIUM` at an existing binary.

## 1. Install dependencies
```bash
pnpm install
pnpm --filter @lunatic/database db:generate   # generate the Prisma client
pnpm -r build                                 # build shared packages + apps
```

## 2. Configure the environment
```bash
cp .env.example .env
```
Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` - >=16 chars (`openssl rand -base64 48`)
- `SECRETS_ENCRYPTION_KEY` - 32 bytes base64 (`openssl rand -base64 32`), used to
  encrypt stored provider API keys and MFA secrets

Optional (surface a `NOT_CONFIGURED` state when blank): `ANTHROPIC_API_KEY` and
other provider keys, `STRIPE_SECRET_KEY`, S3 (`S3_*`), `E2B_API_KEY`, sandbox
tuning (`SANDBOX_*`). See `.env.example` for the full list.

## 3. Database
```bash
# with Docker:
docker compose up -d postgres redis
# apply schema + seed:
pnpm --filter @lunatic/database db:migrate
pnpm --filter @lunatic/database db:seed        # system roles + demo org/user
pnpm --filter @lunatic/database db:seed:demo   # optional: demo missions + evidence
```
Using an existing PostgreSQL? Point `DATABASE_URL` at it and run the same
migrate/seed commands.

## 4. Run
```bash
pnpm --filter @lunatic/api dev     # API at http://localhost:4000/api
pnpm --filter @lunatic/web dev     # Web at http://localhost:3000
```

> Dev note: the API dev runner uses **ts-node** (not esbuild/tsx) because NestJS
> dependency injection needs emitted decorator metadata. Production uses the
> `tsc` build (`pnpm --filter @lunatic/api build && ... start`).

## 5. Verify
```bash
curl -s localhost:4000/api/health          # {"status":"ok","db":"up",...}
pnpm -r test                               # 99 unit tests
```
Sign in at http://localhost:3000 with the demo account
(`demo@lunatic.local` / `demo-password-change-me`) - change this immediately
outside a throwaway demo.

## Sandbox image
Active tool execution runs in a container built from a tools image
(`SANDBOX_DEFAULT_IMAGE`, default `lunatic/kali-tools:latest`). Provide an image
that contains the tools you plan to run (nmap, httpx, nuclei, ...). Without a Docker
daemon, tool steps are reported as `AWAITING_SANDBOX` and nothing is fabricated.
