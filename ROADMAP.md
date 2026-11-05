# LUNATIC PENTEST AI — Roadmap

Phased build plan. Each phase ends with tests passing before the next begins.
Status legend: ✅ done · 🚧 in progress · ⬜ not started.

---

## Phase 1 — Architecture & infrastructure 🚧
- [x] `ARCHITECTURE.md`, `ROADMAP.md`
- [x] pnpm monorepo (apps/web, apps/api, apps/local-agent, packages/*)
- [x] `docker-compose.yml` (postgres, redis, api, web, sandbox-runner)
- [x] `.env.example`, `.gitignore`, root tooling (tsconfig, eslint, prettier)
- [x] `packages/database` Prisma schema (all tables)
- [x] `packages/scope-engine` authorization engine + unit tests
- [ ] CI pipeline (lint/test/build)

## Phase 2 — Auth & database 🚧
- [x] Prisma migrations + seed (initial migration committed)
- [x] NestJS API skeleton (config/env validation, Prisma module, health)
- [x] Register / login / logout / refresh (token rotation)
- [x] MFA (TOTP) enroll + confirm; MFA-gated login (verified end-to-end)
- [x] Session management & revocation (logout, logout-all)
- [x] RBAC guards (@Permissions) + JWT auth guard; login lockout; audit logging
- [x] `@lunatic/security` pure package (scrypt, AES-GCM, TOTP) — 12 tests pass
- [ ] Password reset flow (needs email provider + reset-token store)
- [ ] API e2e test harness in CI (verified manually against local Postgres)

## Phase 3 — UI & dashboard 🚧
- [x] Next.js (App Router) + Tailwind dark design system (turquoise/electric-blue)
- [x] App shell (sidebar + topbar), responsive, auth-guarded layout
- [x] Auth screens (login w/ MFA step, register) wired to the API
- [x] Dashboard with live stats + interactive charts (Recharts), fed by a real
      tenant-scoped `/api/dashboard/stats` endpoint
- [x] Settings page (account, MFA status, permissions) from `/api/me`
- [x] API client with token storage + automatic refresh; `next build` passes
- [ ] Missions / Terminal / Browser / Reports screens (later phases; shown as
      "soon" in nav, non-navigable until their backends exist)

## Phase 4 — Workspace & conversational engine 🚧
- [x] Mission CRUD + validated state machine (illegal transitions rejected)
- [x] Authorized-scope management (host/ip/cidr) wired to the scope engine
- [x] Server-side scope check with real DNS resolution + SSRF/rebind blocking
- [x] Emergency stop (denies all scope checks while active)
- [x] CHAT message pipeline + history; honest NOT_CONFIGURED notice until the
      AI gateway (Phase 5) lands — no fabricated assistant replies
- [x] Workspace UI (mission list + create, detail with state controls, Scope tab
      with live target check, chat panel); tenant isolation enforced
- [ ] File attach in workspace; export results (follow-up)

## Phase 5 — AI model management 🚧
- [x] `@lunatic/ai` provider-agnostic gateway with adapters for Anthropic,
      OpenAI, Gemini, DeepSeek, OpenRouter (+ CUSTOM, + dev MOCK); pure
      request/response mappers, 10 unit tests pass
- [x] STANDARD/PRO/MAX profiles = real generation configs (tokens/temp/tool budget)
- [x] Encrypted API-key vault (AES-256-GCM via @lunatic/security); keys never
      logged or returned to the browser (only lastFour)
- [x] AI module: provider/model CRUD, connectivity test, org-scoped resolution
- [x] Token/cost accounting → UsageRecord (flows into dashboard aiTokens)
- [x] CHAT wired to the gateway (real assistant replies; honest NOT_CONFIGURED
      / error notices otherwise). Verified end-to-end via the dev provider.
- [x] Provider management UI in Settings (add/test/remove, admin:providers-gated)
- [ ] Streaming responses (SSE) + per-model cost config (follow-up)

## Phase 6 — Autonomous agent & orchestration 🚧
- [x] Deterministic baseline planner (scope → ordered, scope-gated steps); unit-tested
- [x] Orchestrator loop: plan → gate → scope-check → execute → evidence →
      persist (TaskPlan/TaskExecution/ToolExecution/Evidence/Finding)
- [x] Permission-mode gating (APPROVAL/SUPERVISED/AUTONOMOUS) with per-step
      approve/reject; emergency stop halts the loop
- [x] Real executable steps now: scope_verify + dns_recon (DNS-resolving,
      scope-gated). Tool steps honestly reported AWAITING_SANDBOX — no fake output
- [x] Hash-chained, tamper-evident evidence store + chain verification; unit-tested
- [x] Evidence-backed findings (never auto-marked CONFIRMED)
- [x] Agent UI tab (plan, approvals, step/run, findings, integrity badge)
- [ ] AI-assisted planning + real tool execution land with the sandbox (Phase 7/9)

## Phase 7 — Terminal & sandbox 🚧
- [x] Sandbox driver abstraction + Docker driver (create/start/stop/destroy/exec/PTY)
- [x] Hardened container config: CapDrop ALL, no-new-privileges, read-only rootfs,
      size-limited tmpfs, CPU/mem/PID caps, NO network by default. Unit-tested.
- [x] SandboxService: lifecycle + persistence (Sandbox/SandboxEvent), retention
      TTL + cleanup, resource caps from env, honest UNAVAILABLE when no backend
- [x] `xterm.js` terminal wired to a sandbox PTY over an authenticated WebSocket
      (socket.io, sandbox:execute-gated); commands never run on the app server
- [x] Agent tool steps now execute in the sandbox when available (real exec,
      captured as evidence); AWAITING_SANDBOX only when no backend is reachable
- [ ] Fine-grained egress filtering to authorized scope (scaffolded: no-network
      default + per-mission network hook; full egress proxy is a follow-up)

## Phase 8 — Integrated browser ✅
- [x] Isolated headless-browser viewer (Playwright/Chromium): render + screenshot
- [x] HTTP response/header inspection, status, redirect chain, page text
- [x] Scope-gated top-level navigation + always-on per-request SSRF filter
      (blocks private/reserved ranges incl. metadata, non-http(s), unresolved);
      downloads disabled. Filter unit-tested (8 tests).
- [x] Per-mission history; visits persisted as browser tool-runs + hash-chained
      evidence (http_response + screenshot)
- [x] Browser UI page (URL bar, screenshot, headers, redirects, blocked
      sub-requests, history). Verified LIVE against a public in-scope target.

## Phase 9 — Recon & analysis tools 🚧
- [x] Tool-adapter framework (argv builders + pure parsers + registry/catalog)
- [x] Adapters: nmap, subfinder, httpx, nuclei (recon/network/web) + semgrep,
      gitleaks, trivy (code/secrets/deps). Parsers map output → findings with
      severity + CWE/CVE/OWASP. 9 parser unit tests pass.
- [x] Wired into the agent: tool steps build real commands, run in the sandbox,
      and create DETECTED findings linked to hash-chained evidence
- [x] Active tools (nmap/httpx/nuclei) gated by the scope guard + permission mode
- [x] `/tools/catalog` endpoint + tool-catalog + CWE/CVE badges in the Agent UI
- [ ] More adapters (nikto, testssl, whatweb, bandit, ZAP) — same pattern; and
      live end-to-end runs need the sandbox tool image (Docker/E2B)

## Phase 10 — Evidence & reporting ✅
- [x] Hash-chained, tamper-evident evidence store + verification (Phase 6/8)
- [x] CVSS v3.1 base-score calculator (pure, unit-tested; Log4Shell=10.0)
- [x] Finding lifecycle: triage state + confirmation policy (no CONFIRMED without
      evidence) + CVSS scoring that sets severity
- [x] Report engine: structured model (cover, authorization, exec summary,
      methodology, findings w/ CVSS/CWE/CVE/OWASP + remediation + evidence refs,
      integrity, conclusion) → PDF/HTML/JSON/CSV. PDF via headless Chromium.
- [x] Every conclusion traceable to a hash-verified evidence record
- [x] Reports UI (generate + download) and in-panel finding triage.
      Verified LIVE: all 4 formats generate; PDF is a real %PDF; 44 API tests pass.

## Phase 11 — Billing & admin ✅
- [x] Plan catalog FREE/PRO/PRO_PLUS/ULTRA/TEAM (pure config, unit-tested)
- [x] Billing overview: tier, plan, credits (plan+purchased−consumed), usage by kind
- [x] Stripe adapter (REST, dependency-free) incl. webhook-signature verify;
      honest NOT_CONFIGURED without keys. Invoices + usage endpoints.
- [x] Admin (org-scoped): members list, suspend/reinstate (revokes sessions),
      role change, audit log, system stats, direct plan change
- [x] Billing/Pricing UI + Admin UI (stats, members, audit); Admin nav gated on
      admin:users. Verified LIVE end-to-end. 49 API unit tests pass.
- [ ] Platform-level superadmin (cross-org) + configurable prices in admin UI

## Phase 12 — Tests, optimization & deployment ✅
- [x] 99 unit tests across scope-engine (28), security (12), ai (10), api (49):
      authorization/SSRF, crypto/MFA, provider mappers, agent gating, evidence
      chain, sandbox hardening, browser filter, tool parsers, CVSS, renderers,
      plans. `pnpm -r test` green.
- [x] CI workflow (build/lint/test + migration verification against Postgres)
- [x] Safe demo environment: `db:seed` (roles + demo org/user) and
      `db:seed:demo` (sample missions + valid hash-chained evidence). Seed
      password format aligned with the API verifier.
- [x] docker-compose (postgres/redis/api/web) + Dockerfiles; config validated
- [x] Docs: README, INSTALLATION, DEPLOYMENT, USER_GUIDE, DEVELOPMENT, ARCHITECTURE
- [ ] Integration/load tests + production observability wiring (environment-specific)

---

### Current status
All 12 phases have an implemented, tested baseline. The platform runs end-to-end
in development; capabilities needing external infrastructure (AI provider keys,
a Docker/E2B sandbox backend, Stripe, S3) are implemented with adapters and
surface an explicit NOT_CONFIGURED / AWAITING_SANDBOX state rather than faking
output. 99 unit tests pass. See the README "honest status" table for what is
verified live vs. what activates with external credentials/infra.
