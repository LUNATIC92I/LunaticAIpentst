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

## Phase 2 — Auth & database ⬜
- [ ] Prisma migrations + seed
- [ ] Register / login / logout / password reset
- [ ] MFA (TOTP), session management & revocation
- [ ] RBAC + tenant isolation guards; login lockout; audit logging

## Phase 3 — UI & dashboard ⬜
- [ ] Design system (dark theme, tokens), shell/nav
- [ ] Dashboard with live stats + charts
- [ ] Auth screens, settings

## Phase 4 — Workspace & conversational engine ⬜
- [ ] Mission CRUD + state machine
- [ ] CHAT mode message pipeline + history
- [ ] File attach in workspace; export results

## Phase 5 — AI model management ⬜
- [ ] Provider-agnostic gateway (Anthropic/OpenAI/Gemini/DeepSeek/OpenRouter)
- [ ] Encrypted key vault; token/cost accounting; STANDARD/PRO/MAX profiles

## Phase 6 — Autonomous agent & orchestration ⬜
- [ ] Planner, tool-selector, executor loop; persistent mission state
- [ ] Permission modes (APPROVAL/SUPERVISED/AUTONOMOUS) gating

## Phase 7 — Terminal & sandbox ⬜
- [ ] Sandbox lifecycle (create/start/stop/destroy) w/ resource caps
- [ ] `xterm.js` terminal wired to sandbox PTY over WS
- [ ] Egress filtering to authorized scope

## Phase 8 — Integrated browser ⬜
- [ ] Isolated headless browser viewer; HTTP response/header inspection
- [ ] SSRF / internal-network protections; history per mission

## Phase 9 — Recon & analysis tools ⬜
- [ ] Adapters (nmap, subfinder, httpx, nuclei, nikto, testssl, semgrep,
      gitleaks, trivy, …) each with error handling + logging
- [ ] All active tools gated by scope guard

## Phase 10 — Evidence & reporting ⬜
- [ ] Hash-chained evidence store
- [ ] Report engine (PDF/HTML/JSON/CSV) with CVSS/CWE/CVE/OWASP

## Phase 11 — Billing & admin ⬜
- [ ] Plans, Stripe, invoices, credits, usage dashboard
- [ ] Admin panel (users/roles/providers/quotas/logs)

## Phase 12 — Tests, optimization & deployment ⬜
- [ ] Unit/integration/API/security/sandbox/load tests
- [ ] Demo data + safe demo environment
- [ ] Deployment guides, hardening, observability

---

### Current status
Phase 1 foundation is implemented in this iteration: monorepo, schema, scope
engine (with tests), and infra scaffolding. Subsequent phases build on it.
