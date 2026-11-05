# Deployment

## Docker Compose (reference)
The repo ships a `docker-compose.yml` with `postgres`, `redis`, `api` and `web`.
```bash
cp .env.example .env     # fill in secrets
docker compose build
docker compose up -d
docker compose exec api pnpm --filter @lunatic/database db:deploy
docker compose exec api pnpm --filter @lunatic/database db:seed
```
- `api` -> `:4000`, `web` -> `:3000`.
- The API mounts the Docker socket to manage per-mission sandbox containers. In
  production prefer a **dedicated sandbox host/orchestrator or E2B** instead of
  sharing the host socket.

## Production topology
```
Cloudflare / LB -> Nginx (TLS) -> web (Next.js) + api (NestJS)
                                   |
         PostgreSQL - Redis - S3 (evidence/reports) - Sandbox fleet (Docker/E2B)
```
Recommended:
- Terminate TLS at Nginx/Cloudflare; proxy `/api` and the `/terminal` WebSocket
  (socket.io) to the API, everything else to the web app.
- Run the API with the `tsc` build (`pnpm --filter @lunatic/api build` then
  `node apps/api/dist/main.js`). Set `NODE_ENV=production`.
- Use managed PostgreSQL + Redis. Run `db:deploy` (not `migrate dev`) on release.
- Store evidence/report artifacts in S3 (`S3_*`); without it they are written to
  the local `REPORTS_DIR` / evidence directory.

## Required secrets
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SECRETS_ENCRYPTION_KEY`
(32-byte base64). Rotate `JWT_*` with care (invalidates sessions). Keep
`SECRETS_ENCRYPTION_KEY` stable - it decrypts stored provider keys.

## Sandbox execution
Set `SANDBOX_DRIVER=docker` (or `e2b` with `E2B_API_KEY`) and provide a tools
image via `SANDBOX_DEFAULT_IMAGE`. Resource caps: `SANDBOX_CPU_LIMIT`,
`SANDBOX_MEMORY_LIMIT`, `SANDBOX_DISK_LIMIT`, `SANDBOX_WALLCLOCK_LIMIT`,
`SANDBOX_RETENTION_SECONDS`. Sandboxes have **no network by default**; scope-
limited egress should be enforced by a per-mission network + egress proxy.

## CI
`.github/workflows/ci.yml` builds, lints and tests the workspace, and verifies
migrations against a disposable PostgreSQL. Wire your CD to run `db:deploy` then
roll out the `api` and `web` images.

## Observability (recommended)
- `SENTRY_DSN` for error tracking.
- Prometheus metrics / Grafana dashboards and structured logs (hooks in place;
  exporters are environment-specific).

## Hardening checklist
- [ ] TLS everywhere; HSTS at the edge.
- [ ] Separate sandbox host or E2B; never share the prod Docker socket broadly.
- [ ] Network policy allowing sandbox egress only to authorized scope.
- [ ] Secrets in a manager (not `.env`) in production.
- [ ] Backups for PostgreSQL and the evidence/report store.
- [ ] Rate limits at the edge; WAF in front of the web app.
