# LUNATIC PENTEST AI — Architecture

> Plateforme professionnelle de pentesting assisté par agents intelligents, pour
> opérations de sécurité **autorisées** uniquement.

This document describes the components, data flows and dependencies of the
platform. It is the authoritative reference for how the pieces fit together.

---

## 1. Guiding principles

1. **Authorization-first.** No active security action runs against any target
   that has not been explicitly authorized and recorded in a signed scope. The
   scope guard is a mandatory choke point that *cannot* be bypassed by a
   conversational instruction, an imported file, or a tool's output.
2. **Isolation.** Tooling never runs on the application server. All execution
   happens in disposable, resource-limited sandboxes (Docker / E2B).
3. **Evidence integrity.** Every finding is traceable to a command, an output
   and a timestamped, hash-chained evidence record.
4. **Modularity.** Each concern is an independent module/package with a clear
   contract, so it can be built, tested and replaced in isolation.
5. **Honest state.** The system never claims a tool ran when it did not, and
   never marks a vulnerability "confirmed" without sufficient evidence.

---

## 2. High-level topology

```
                         ┌──────────────────────────────────────────┐
                         │                Clients                    │
                         │   Web (Next.js)   ·   Local Agent (CLI)    │
                         └───────────────┬──────────────────────────┘
                                         │ HTTPS / WSS (authenticated)
                         ┌───────────────▼──────────────────────────┐
                         │              Nginx / Cloudflare           │
                         └───────────────┬──────────────────────────┘
                                         │
             ┌───────────────────────────▼───────────────────────────┐
             │                   API (NestJS)                          │
             │                                                         │
             │  Auth · RBAC · Missions · Chat · Agent-Orchestrator ·   │
             │  AI-Gateway · ScopeGuard · Sandboxes · Tools · Files ·  │
             │  Findings · Evidence · Reports · Billing · Admin        │
             └───┬───────────────┬──────────────┬──────────────┬──────┘
                 │               │              │              │
        ┌────────▼───┐   ┌───────▼─────┐  ┌─────▼──────┐  ┌────▼───────┐
        │ PostgreSQL │   │    Redis    │  │  S3 store  │  │ Task queue │
        │  (Prisma)  │   │ cache/pub   │  │ (evidence) │  │ (BullMQ)   │
        └────────────┘   └─────────────┘  └────────────┘  └────┬───────┘
                                                                │
                                                 ┌──────────────▼───────────────┐
                                                 │   Sandbox fleet (Docker/E2B)  │
                                                 │  per-mission isolated runners │
                                                 │  (Kali / Ubuntu tool images)  │
                                                 └───────────────────────────────┘
```

---

## 3. Components

### 3.1 Frontend (`apps/web`)
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.**
- Dark, minimal UI: near-black blue background, graphite/metal greys, turquoise
  and electric-blue accents.
- Key surfaces: Dashboard, Workspace (chat + agent), integrated Terminal
  (`xterm.js`), integrated Browser viewer, Reports, Admin, Billing.
- Realtime via WebSocket (`socket.io`) and SSE fallback, with stream resume.
- Monaco editor for viewing/editing code and configs.

### 3.2 API (`apps/api`)
NestJS, modular. Each module owns its controllers, services, DTOs and tests.

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, MFA (TOTP), sessions, password reset, lockout |
| `rbac` | Roles, permissions, org/tenant isolation guards |
| `missions` | Mission CRUD, state machine, persistence |
| `chat` | Conversational (CHAT mode) message handling |
| `agent` | Agent orchestration (AGENT mode): plan → tool-select → execute → analyze |
| `ai` | Provider-agnostic AI gateway, key vault, token/cost accounting |
| `scope-guard` | **Mandatory** authorization & target validation choke point |
| `sandboxes` | Lifecycle of isolated execution environments |
| `tools` | Adapters for recon/analysis tooling, run via sandboxes |
| `files` | Upload, scan, versioning, extraction, mission association |
| `findings` | Vulnerability lifecycle (potential→…→confirmed / false-positive) |
| `evidence` | Hash-chained, timestamped evidence store |
| `reports` | PDF/HTML/JSON/CSV report generation (CVSS/CWE/CVE/OWASP) |
| `billing` | Plans, Stripe, invoices, credits, usage metering |
| `admin` | User/role/provider/quota management, audit, system logs |
| `notifications` | Security + activity notifications |
| `audit` | Append-only audit log for all sensitive actions |

### 3.3 Database (`packages/database`)
- PostgreSQL + Prisma. See `packages/database/prisma/schema.prisma`.
- Row-level tenant isolation enforced in the service layer + Postgres policies.

### 3.4 Shared packages
- `packages/shared` — DTO/types/zod schemas shared by API and web.
- `packages/scope-engine` — pure, dependency-light authorization engine
  (host/IP/CIDR allow-listing, DNS-rebind & SSRF protection, rate caps). It is
  pure so it can be unit-tested exhaustively and reused by the local agent.

### 3.5 Sandbox runners
- Per-mission Docker containers from hardened Kali/Ubuntu images.
- CPU, memory, disk, wall-clock and network egress limits applied at creation.
- Network egress is filtered to the mission's authorized scope only.
- Auto-destroyed after a retention TTL; evidence persisted to S3 first.

### 3.6 Local agent (`apps/local-agent`)
- Installable CLI (Linux/Windows/macOS) that registers a user-owned test host
  with the backend over an authenticated, encrypted channel (mTLS + token).
- Receives only scope-validated jobs; enforces the same scope engine locally.

---

## 4. The Agent loop (AGENT mode)

```
describe → identify target → VERIFY AUTHORIZATION (scope-guard, hard gate)
        → plan (steps) → select tool → [permission check] → execute in sandbox
        → collect output → analyze → classify finding → attach evidence
        → update mission state → (loop) → generate report
```

- Mission state is persisted after every step so an interrupted run resumes
  without losing collected data.
- Permission mode (APPROVAL / SUPERVISED / AUTONOMOUS) gates each step. Even in
  AUTONOMOUS mode, scope limits, prohibitions and resource caps remain enforced.

## 5. Finding lifecycle

`POTENTIAL → DETECTED → REPRODUCED → CONFIRMED` · plus `FALSE_POSITIVE` and
`INCONCLUSIVE`. A finding may only reach `CONFIRMED` when linked evidence
records satisfy the confirmation policy (reproducible output + artifact).

## 6. Security model

- Secrets (API keys, provider creds) encrypted at rest (AES-256-GCM via a KMS
  or envelope key); never logged, never sent to the browser.
- OWASP ASVS alignment; RBAC + tenant isolation; TLS everywhere.
- The scope guard is invoked **server-side** before any tool dispatch; the agent
  cannot reach a sandbox execution path except through it.

## 7. Observability
- Prometheus metrics, Grafana dashboards, Sentry error tracking, structured logs.

## 8. Dependencies & external integrations
Each external integration (AI providers, Stripe, S3, E2B) has a dedicated
adapter and a documented env var. When not configured, the feature reports an
explicit `NOT_CONFIGURED` state rather than failing silently or faking output.

See `ROADMAP.md` for the phased build plan and `docs/` for per-area guides.
