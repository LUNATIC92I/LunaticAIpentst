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
