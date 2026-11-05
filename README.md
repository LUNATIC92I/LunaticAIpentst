# LUNATIC PENTEST AI

A professional, AI-assisted penetration-testing platform for **authorized security
operations only**. Operators describe an engagement in natural language; an agent
plans scope-gated steps, runs tooling inside isolated sandboxes, collects
tamper-evident evidence, and produces traceable CVSS-scored reports.

> ⚠️ For authorized testing of systems you own or have explicit written
> permission to assess. Every active action is enforced against a per-mission
> authorized scope and cannot be widened by a prompt, a file, or tool output.

![tests](https://img.shields.io/badge/tests-99%20passing-brightgreen)

---

## Highlights

- **Authorization-first scope guard** — default-deny, SSRF / DNS-rebind
  protection (blocks private/reserved ranges incl. cloud metadata), host/IP/CIDR
  allow-listing, emergency stop. The mandatory choke point for every active op.
- **Autonomous agent** — plan → gate → scope-check → execute → analyze → evidence,
  with permission modes (APPROVAL / SUPERVISED / AUTONOMOUS) gating each step.
- **Isolated execution** — hardened Docker sandboxes (no caps, read-only rootfs,
  no network by default, CPU/mem/PID/disk caps) + an `xterm.js` terminal over WS.
- **Integrated recon browser** — headless Chromium with two-layer SSRF filtering,
  header/redirect inspection and screenshots.
- **Tool adapters** — nmap, subfinder, httpx, nuclei, semgrep, gitleaks, trivy,
  each with a safe command builder + structured parser (severity + CWE/CVE/OWASP).
- **Evidence & reporting** — hash-chained, tamper-evident evidence; CVSS v3.1
  scoring; professional PDF/HTML/JSON/CSV reports where every conclusion traces
  to a verified evidence record.
- **AI gateway** — provider-agnostic (Anthropic/OpenAI/Gemini/DeepSeek/OpenRouter)
  with an encrypted key vault and token/cost accounting.
- **SaaS** — plans/credits/usage, Stripe adapter, org admin (members, roles,
  audit), RBAC + multi-tenant isolation, MFA.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and
[`ROADMAP.md`](./ROADMAP.md) for build status.

## Monorepo layout

```
apps/
  api/           NestJS backend (auth, missions, agent, sandbox, browser, tools,
                 reports, billing, admin)
  web/           Next.js frontend (dashboard, workspace, terminal, browser,
                 reports, billing, admin)
  local-agent/   (planned) installable host agent
packages/
  database/      Prisma schema + migrations + seed
  scope-engine/  pure authorization engine (SSRF/scope) — 28 tests
  security/      scrypt / AES-256-GCM / TOTP — 12 tests
  ai/            provider-agnostic AI gateway — 10 tests
```

## Quickstart

```bash
pnpm install
pnpm --filter @lunatic/database db:generate
pnpm -r build

cp .env.example .env            # set JWT_*, SECRETS_ENCRYPTION_KEY, DATABASE_URL
docker compose up -d postgres redis
pnpm --filter @lunatic/database db:migrate
pnpm --filter @lunatic/database db:seed          # system roles + demo org/user
pnpm --filter @lunatic/database db:seed:demo     # sample missions + evidence

pnpm --filter @lunatic/api dev                   # API  → :4000/api
pnpm --filter @lunatic/web dev                   # Web  → :3000
```

Demo login (local demo environment only): `demo@lunatic.local` /
`demo-password-change-me`.

Full guides: [`docs/INSTALLATION.md`](./docs/INSTALLATION.md),
[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md),
[`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md),
[`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

## Tests

```bash
pnpm -r test     # 99 unit tests across scope-engine, security, ai, api
```

## External dependencies & honest status

The platform runs end-to-end without external keys; features that need them
report an explicit `NOT_CONFIGURED` state rather than failing or faking output:

| Capability | Needs | Without it |
|---|---|---|
| Assistant replies / agent reasoning | an AI provider key | CHAT shows NOT_CONFIGURED |
| Live tool execution & terminal | a Docker daemon (or E2B) | tool steps are AWAITING_SANDBOX |
| Payments / checkout | Stripe keys | billing works; checkout is NOT_CONFIGURED |
| Evidence/report object storage | S3-compatible storage | artifacts are written to local disk |

Verified live in development: auth + MFA, the scope guard (real DNS/SSRF), the
agent loop, the integrated browser (real page fetch + screenshot), the report
engine (real PDF), billing/admin. The sandbox tool runner and AI providers are
implemented and unit-tested; they execute against a real Docker daemon / provider
key in a deployed environment.

## License / use

Intended for professional, authorized security work. Do not use against systems
you are not explicitly authorized to test.
