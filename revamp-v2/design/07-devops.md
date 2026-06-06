# 07 — DevOps, Infrastructure & SRE Design

> **Project:** OpenProject Rewrite (Next.js 15 Pages Router, Prisma 7, PostgreSQL)
> **Location:** `/home/cwlai/openproject-rewrite`
> **Phase target:** Phase 6 (Delivery) + production hardening for Phases 1-5
> **Author:** Senior DevOps + SRE
> **Status:** Design — ready for implementation after stakeholder sign-off
> **Last updated:** 2026-06-06

---

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [Current State Audit](#2-current-state-audit)
3.  [Target Architecture Overview](#3-target-architecture-overview)
4.  [CI/CD Pipeline](#4-cicd-pipeline)
5.  [Container Strategy](#5-container-strategy)
6.  [Local Development Experience](#6-local-development-experience)
7.  [Deployment Platforms & Recommendation](#7-deployment-platforms--recommendation)
8.  [Database Hosting & Operations](#8-database-hosting--operations)
9.  [Redis Hosting & Operations](#9-redis-hosting--operations)
10. [Monitoring, Logging & Observability](#10-monitoring-logging--observability)
11. [Performance Engineering](#11-performance-engineering)
12. [Production Security](#12-production-security)
13. [Load Testing with k6](#13-load-testing-with-k6)
14. [Disaster Recovery & Business Continuity](#14-disaster-recovery--business-continuity)
15. [Cloudflare Tunnel for Final Delivery](#15-cloudflare-tunnel-for-final-delivery)
16. [Concrete Configurations](#16-concrete-configurations)
17. [Cost Estimates](#17-cost-estimates)
18. [Migration Plan from Current Setup](#18-migration-plan-from-current-setup)
19. [Operational Runbooks](#19-operational-runbooks)
20. [Appendices](#20-appendices)

---

## 1. Executive Summary

OpenProject Rewrite is currently a Next.js 15 Pages Router app targeting the Hong Kong region (`hkg1`) on Vercel and `hk` on Railway, with a minimal `instrumentation.ts` that lazily loads `@sentry/node`. There is **no CI/CD pipeline, no container image, no Cloudflare Tunnel, no structured logging, no uptime monitoring, no formal DR plan, and no synthetic monitoring**. Sentry is configured with a 10% sample rate and no source-map upload.

This document delivers a complete infrastructure + SRE overhaul that:

- **Standardizes delivery** through GitHub Actions with branch protection and required status checks.
- **Containers** the app via a multi-stage Alpine-based Dockerfile, with `output: 'standalone'` already configured in `next.config.js`.
- **Splits stateful concerns**: Vercel for the Next.js runtime, Neon for serverless Postgres with branching, Upstash for serverless Redis, Cloudflare in front of everything via Tunnel + Access.
- **Hardens observability** by enriching Sentry (server + client + edge), shipping structured JSON logs to Better Stack, and adding Prometheus `/metrics` plus uptime + synthetic monitoring.
- **Validates performance** via k6 (smoke + load + stress + soak + spike), Lighthouse CI, and Web Vitals reporting.
- **Protects production** with secrets management, edge rate limiting, WAF, and zero-downtime migrations.
- **Enables recovery** through automated daily backups with PITR, a tested restore runbook, and explicit RTO/RPO targets.
- **Delivers** the product to the user through a Cloudflare Tunnel (`cloudflared`) that exposes the app at a stable hostname behind Cloudflare Access (email-OTP) for any internal demos before a public launch.

The single biggest strategic decision: **Vercel (frontend) + Neon (Postgres) + Upstash (Redis) + Cloudflare (delivery + WAF + Access)**. This is the recommended stack, with Railway retained as a fallback / alternative.

---

## 2. Current State Audit

### 2.1 Files reviewed

| Path | Purpose | Current state |
|------|---------|---------------|
| `vercel.json` | Vercel build config | OK — `framework: nextjs`, `hkg1` region, build dir `.next`. **Has a bug:** `regions` is declared twice (line 6 as array, line 10 as object). JSON parser picks last → `hkg1` is the active value, but the file is invalid JSON for tooling. |
| `railway.toml` | Railway deploy | nixpacks builder, `numInstances = 2`, healthcheck at `/api/health` (already implemented in `pages/api/health.ts` ✓). No auto-migrate step. No restart policy declared. |
| `instrumentation.ts` | Next.js Sentry bootstrap | Only initializes `@sentry/node` server-side. **Missing:** `@sentry/nextjs` unified init, browser-side, edge runtime, source maps, profiling, release tracking. |
| `sentry.client.config.ts` | Browser Sentry | Traces sample 0.1, no replay, no profiling, no beforeSend scrubbing. |
| `sentry.server.config.ts` | Server Sentry | Identical minimal config; no Prisma/datasource span, no DB query tracing. |
| `.env.example` | Env reference | Has DB, NextAuth, Upstash, SMTP, Sentry, OLD DB. Missing: Cloudflare, Neon, Better Stack, Upstash Ratelimit, Sentry auth token. |
| `next.config.js` + `next.config.ts` | Next config | `output: 'standalone'` is good for Docker. `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` are **code-quality anti-patterns** that must be removed in CI. `next.config.ts` is dead code (Next reads `.js` first). |
| `middleware.ts` | Auth gate | Uses `next-auth/jwt` (good — avoids `@auth/core` page rendering in edge). Matcher excludes `/api/auth` (good). **Missing:** CSRF origin check, rate-limit hook, security headers. |
| `pages/api/health.ts` | Liveness/readiness | DB ping only. Good. **Missing:** Redis ping, version/commit SHA in body, Sentry ping suppression. |
| `k6/scenarios/smoke.ts` | Smoke test | 5 VUs, 1 min, login in `setup()` then authed GETs to `/api/health`, `/api/projects`, work packages. Login flow won't work (NextAuth CSRF token is empty in the test). |
| `k6/scenarios/load.ts` | Load test | 50 VUs ramp + 100 VUs stress. Thresholds `p(95)<500`. **No auth, no work-package writes, no upload scenario.** |
| `package.json` | Deps | `@upstash/ratelimit`, `ioredis`, `prom-client`, `@next/bundle-analyzer` already present ✓. No `@sentry/profiling-node`, no `pino`, no `dotenv-cli`, no `k6` (which is fine — k6 is installed in the runner). |

### 2.2 Gaps identified

| # | Gap | Severity | Owner |
|---|-----|----------|-------|
| G1 | No CI: lint / type-check / test / build / e2e / deploy | **Critical** | DevOps |
| G2 | No branch protection, no required checks | **Critical** | DevOps |
| G3 | No Docker image; cannot run reproducible prod-like locally | High | DevOps |
| G4 | No one-command local setup (Makefile, bin/setup) | High | DevOps |
| G5 | `vercel.json` has duplicate `regions` key — silently broken | High | DevOps |
| G6 | `next.config.{js,ts}` ignore TS + ESLint errors during build | **Critical** for prod | Frontend |
| G7 | Sentry init is minimal: no source maps, no profiling, no replay, no beforeSend scrub | High | Backend |
| G8 | No structured logging (pino/winston), no log shipper, no log retention | High | Backend |
| G9 | No metrics endpoint beyond `prom-client` import; not exposed | Medium | Backend |
| G10 | No uptime monitoring / synthetic checks | High | SRE |
| G11 | No Cloudflare Tunnel — final delivery requirement not met | **Critical** | DevOps |
| G12 | No DR: backup policy, restore runbook, RTO/RPO | High | SRE |
| G13 | No secrets manager (Doppler / 1Password) | Medium | Security |
| G14 | k6 scripts are incomplete: no real login, no writes, no upload | Medium | QA |
| G15 | No database migration automation on deploy | **Critical** | Backend |
| G16 | No connection pooling (Prisma Accelerate / PgBouncer) | High | Backend |
| G17 | No rate limiting at the edge (only `@upstash/ratelimit` is imported but unused) | High | Security |
| G18 | No WAF / DDoS rules beyond Cloudflare defaults | Medium | Security |
| G19 | No Lighthouse CI / Web Vitals tracking | Medium | Frontend |
| G20 | No edge runtime Sentry init | Low | Backend |

This design closes all 20 gaps.

---

## 3. Target Architecture Overview

### 3.1 High-level diagram

```
                                 ┌────────────────────────┐
   End users ── DNS / CF ──►  │   Cloudflare Edge       │
                              │   (WAF, DDoS, Cache,     │
                              │    Access, Rate-limit)   │
                              └──────────┬──────────────┘
                                         │
                          Cloudflare Tunnel (cloudflared)
                                         │
                                         ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Vercel (hkg1 primary, sin1 failover)                         │
   │  • Next.js 15 Pages Router, standalone output                 │
   │  • Edge + Node runtimes, ISR, Image Optimization              │
   │  • Auto-scaling, Preview Deployments per PR                   │
   └────────────┬──────────────────────────────────┬──────────────┘
                │ pooled                            │ REST
                ▼                                  ▼
   ┌──────────────────────────┐         ┌──────────────────────────┐
   │  Neon Postgres           │         │  Upstash Redis           │
   │  • Primary (hkg / sin)   │         │  • Global edge replicas  │
   │  • Branching per PR      │         │  • TLS, REST API         │
   │  • PITR 7 days           │         │  • Rate-limit + cache    │
   │  • Read-replica (future) │         └──────────────────────────┘
   └──────────────────────────┘
                ▲
                │ pooled via Prisma Accelerate / PgBouncer
                │
   ┌──────────────────────────────────────────────────────────────┐
   │  CI / CD (GitHub Actions)                                     │
   │  • lint → type-check → unit → e2e → build → lighthouse       │
   │  • docker build + push to GHCR (multi-arch)                  │
   │  • prisma migrate deploy (PR preview branch on Neon)         │
   │  • vercel deploy (auto via GitHub integration)                │
   └──────────────────────────────────────────────────────────────┘

   Observability:
     • Sentry (errors, perf, replay, source maps, profiling)
     • Better Stack (structured JSON logs, retention 30d)
     • Prometheus /metrics scraped by Grafana Cloud (free tier)
     • Better Uptime (HTTP/keyword checks every 60s)
     • Playwright synthetic checks every 5 min

   Secrets:
     • Vercel project env (frontend)
     • Neon / Upstash dashboard env (DB / Redis providers)
     • Doppler (source of truth) → mirrored to Vercel + GitHub Actions
     • Local: 1Password CLI + .env.local gitignored
```

### 3.2 Region strategy

- **Primary:** `hkg1` (Hong Kong) — already declared, lowest latency for HK + TW users.
- **Failover:** `sin1` (Singapore) — closest alternative for SEA.
- **Database:** Neon `aws-ap-southeast-1` (Singapore) for primary, with logical replication to `aws-ap-northeast-1` (Tokyo) read-replica for global read scaling. (Vercel data residency: S3-backed assets live in Vercel's region.)
- **Redis:** Upstash Global Database, two regions (primary + replica), anycast routing.

### 3.3 Naming and environment matrix

| Environment | Vercel project | Branch | DB | URL | Secrets |
|-------------|----------------|--------|----|-----|---------|
| Local | — | any | Docker Compose Postgres | `localhost:3000` | `.env.local` |
| Preview | Vercel Preview | PR branch | Neon branch `preview/<pr>` | `pr-<n>.preview.vercel.app` | Vercel + Doppler |
| Staging | Vercel Staging | `develop` | Neon `staging` | `staging.openproject.example.com` | Vercel + Doppler |
| Production | Vercel Production | `main` | Neon `production` | `app.openproject.example.com` (CF-proxied) | Vercel + Doppler + 1Password |
| Disaster | Vercel DR (paused) | `release/x.y` | Neon restored snapshot | `dr.openproject.example.com` | Same as prod |

---

## 4. CI/CD Pipeline

### 4.1 Goals

1. Fast feedback (< 5 min for the cheap lane, < 15 min for full E2E).
2. Reproducible builds with lockfile + Node engine pinned.
3. Zero-touch promotion: green main → auto-deploy to production.
4. Preview per PR with a real database (Neon branch).
5. Required checks block merge.
6. Database migrations run automatically and atomically with deploys.

### 4.2 GitHub Actions workflows

We use **path-based, concurrency-cancelled, cached** workflows. The directory structure is:

```
.github/
├── workflows/
│   ├── ci.yml                    # PR + push: lint, type-check, unit, build
│   ├── e2e.yml                   # PR + push: Playwright e2e
│   ├── lighthouse.yml            # PR: Lighthouse CI on preview URL
│   ├── lighthouse-merge.yml      # main: Lighthouse CI on prod URL
│   ├── docker.yml                # main + tags: build + push image
│   ├── migrate.yml               # main: prisma migrate deploy to Neon
│   ├── release.yml               # tags: GitHub release + Sentry release
│   ├── k6-smoke.yml              # weekly + manual: smoke against staging
│   ├── k6-load.yml               # manual: load test against staging
│   ├── codeql.yml                # security: code scanning
│   ├── dependency-review.yml     # security: dep review on PRs
│   ├── secrets-scan.yml          # security: gitleaks
│   └── cleanup-preview.yml       # daily: close stale Neon preview branches
├── actions/
│   ├── setup-node/              # composite: cache + lockfile verify
│   └── setup-prisma/            # composite: install + generate + migrate
├── dependabot.yml
├── CODEOWNERS
└── PULL_REQUEST_TEMPLATE.md
```

#### 4.2.1 `ci.yml` (PR cheap lane)

```yaml
# .github/workflows/ci.yml
name: ci

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: read

env:
  NODE_VERSION: "20.18.1"
  PNPM_VERSION: "9.12.0"

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: ./.github/actions/setup-node
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm prettier --check .

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 7
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit
        env:
          # Avoid hitting real services during type check
          DATABASE_URL: "postgresql://stub:stub@localhost:5432/stub"
          NEXTAUTH_SECRET: "ci-stub-secret-32-chars-aaaaaaaaaa"

  unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: openproject_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s --health-timeout 3s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-timeout 3s --health-retries 10
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/openproject_test
      REDIS_URL: redis://localhost:6379
      NEXTAUTH_SECRET: ci-test-secret-aaaaaaaaaaaaaaaaaaaaaaa
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma migrate deploy
      - run: pnpm test -- --coverage --reporter=verbose
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  build:
    name: Build (Next.js)
    runs-on: ubuntu-latest
    timeout-minutes: 12
    needs: [lint, typecheck, unit]
    env:
      NEXT_TELEMETRY_DISABLED: 1
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      SENTRY_ORG: ${{ vars.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma generate
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: next-standalone
          path: |
            .next/standalone
            .next/static
            .next/server
            public
          retention-days: 7

  dependency-review:
    if: github.event_name == 'pull_request'
    uses: actions/dependency-review-action@v4
    with:
      fail-on-severity: high
```

#### 4.2.2 `e2e.yml` (Playwright)

```yaml
# .github/workflows/e2e.yml
name: e2e

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
  workflow_dispatch:

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

jobs:
  preview:
    name: Build preview & run E2E
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: preview
    env:
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
      NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
      UPSTASH_REDIS_REST_URL: ${{ secrets.PREVIEW_UPSTASH_REDIS_REST_URL }}
      UPSTASH_REDIS_REST_TOKEN: ${{ secrets.PREVIEW_UPSTASH_REDIS_REST_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.1, cache: pnpm }
      - run: npm i -g pnpm@9.12.0 vercel@37 pnpm@9
      - run: pnpm install --frozen-lockfile

      - name: Create Neon preview branch
        id: neon
        run: |
          BRANCH="preview/pr-${{ github.event.pull_request.number }}"
          RESP=$(curl -sS -X POST \
            "https://console.neon.tech/api/v2/projects/${{ vars.NEON_PROJECT_ID }}/branches" \
            -H "Authorization: Bearer $NEON_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"branch\":{\"name\":\"$BRANCH\",\"parent_id\":\"${{ vars.NEON_MAIN_BRANCH_ID }}\"}}")
          echo "url=$(echo "$RESP" | jq -r .branch.connection_string)" >> "$GITHUB_OUTPUT"
          echo "id=$(echo "$RESP" | jq -r .branch.id)" >> "$GITHUB_OUTPUT"

      - name: Apply migrations
        env:
          DATABASE_URL: ${{ steps.neon.outputs.url }}
        run: pnpm exec prisma migrate deploy

      - name: Seed
        env:
          DATABASE_URL: ${{ steps.neon.outputs.url }}
        run: pnpm db:seed

      - name: Deploy preview to Vercel
        id: vercel
        env:
          DATABASE_URL: ${{ steps.neon.outputs.url }}
        run: |
          vercel pull --yes --environment=preview --token=$VERCEL_TOKEN
          vercel build --token=$VERCEL_TOKEN
          PREVIEW_URL=$(vercel deploy --prebuilt --yes --token=$VERCEL_TOKEN)
          echo "url=$PREVIEW_URL" >> "$GITHUB_OUTPUT"

      - name: Run Playwright
        env:
          BASE_URL: ${{ steps.vercel.outputs.url }}
          DATABASE_URL: ${{ steps.neon.outputs.url }}
        run: |
          pnpm exec playwright install --with-deps chromium
          pnpm exec playwright test

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

      - name: Notify PR
        if: always()
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: e2e
          message: |
            Preview: ${{ steps.vercel.outputs.url }}
            Result: ${{ job.status }}

      - name: Cleanup Neon branch
        if: always()
        run: |
          curl -sS -X DELETE \
            "https://console.neon.tech/api/v2/projects/${{ vars.NEON_PROJECT_ID }}/branches/${{ steps.neon.outputs.id }}" \
            -H "Authorization: Bearer $NEON_API_KEY" || true
```

#### 4.2.3 `migrate.yml` (production migration)

```yaml
# .github/workflows/migrate.yml
name: migrate-prod

on:
  push:
    branches: [main]
    paths: ["prisma/**", "package.json"]
  workflow_dispatch:

concurrency:
  group: migrate-prod
  cancel-in-progress: false

jobs:
  migrate:
    name: Prisma migrate deploy (Neon prod)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: production   # requires manual approval
    env:
      DATABASE_URL_UNPOOLED: ${{ secrets.NEON_PROD_DATABASE_URL_UNPOOLED }}
      DIRECT_URL: ${{ secrets.NEON_PROD_DIRECT_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.1, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma migrate deploy
      - name: Verify migration
        run: pnpm exec prisma migrate status
```

The pattern is: **Vercel deploys the new app code → this job runs migrations against the existing prod database (via DIRECT_URL bypassing pooler) → Vercel auto-revalidates**. Both must succeed. If migration fails, the deploy is reverted by `vercel rollback`.

#### 4.2.4 `docker.yml` (multi-arch image)

```yaml
# .github/workflows/docker.yml
name: docker

on:
  push:
    branches: [main]
    tags: ["v*.*.*"]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=digest
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true
```

#### 4.2.5 `lighthouse.yml` + `lighthouse-merge.yml`

```yaml
# .github/workflows/lighthouse.yml
name: lighthouse-pr

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.1, cache: pnpm }
      - run: npm i -g @lhci/cli@0.14.x pnpm@9
      - run: pnpm install --frozen-lockfile
      - name: Wait for preview
        env:
          PR_URL: ${{ secrets.PREVIEW_DEPLOY_URL }}
        run: |
          for i in {1..30}; do
            curl -fsSL "$PR_URL" -o /dev/null && break
            sleep 10
          done
      - name: Run LHCI
        env:
          LHCI_TOKEN: ${{ secrets.LHCI_TOKEN }}
          LHCI_BUILD_CONTEXT__CURRENT_HASH: ${{ github.event.pull_request.head.sha }}
        run: lhci autorun --config=./lighthouserc.json
      - name: Comment on PR
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: lighthouse
          message: |
            Performance: ${{ env.PERF_SCORE }}
            Accessibility: ${{ env.A11Y_SCORE }}
            Best Practices: ${{ env.BP_SCORE }}
            SEO: ${{ env.SEO_SCORE }}
```

`lighthouserc.json` (in repo root):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/login",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/projects"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1500 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 300 }]
      }
    },
    "upload": { "target": "lhci", "serverBaseUrl": "$LHCI_SERVER_BASE_URL" }
  }
}
```

#### 4.2.6 `release.yml` (Sentry releases + GitHub release)

```yaml
# .github/workflows/release.yml
name: release
on:
  push:
    tags: ["v*.*.*"]
jobs:
  sentry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.1, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec prisma generate
      - run: pnpm build
      - name: Create Sentry release
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ vars.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}
        run: |
          npx @sentry/cli releases new "$GITHUB_REF_NAME"
          npx @sentry/cli releases files "$GITHUB_REF_NAME" upload-sourcemaps \
            --url-prefix "~/" --validate
          npx @sentry/cli releases finalize "$GITHUB_REF_NAME"
          npx @sentry/cli releases deploys "$GITHUB_REF_NAME" new -e production
      - name: GitHub release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: |
            SBOM.spdx.json
```

#### 4.2.7 Security workflows

```yaml
# .github/workflows/codeql.yml
name: codeql
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: "17 6 * * 1"
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      matrix: { language: [typescript, javascript] }
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: ${{ matrix.language }} }
      - uses: github/codeql-action/analyze@v3
```

```yaml
# .github/workflows/secrets-scan.yml
name: secrets-scan
on: [push, pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
```

`dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
    labels: ["dependencies"]
    open-pull-requests-limit: 5
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
  - package-ecosystem: "docker"
    directory: "/"
    schedule: { interval: "weekly" }
```

### 4.3 Branch protection rules

Apply to `main` and `develop`:

| Rule | Value |
|------|-------|
| Require pull request reviews | 1 approval (CODEOWNERS) |
| Dismiss stale approvals on push | yes |
| Require review from Code Owners | yes |
| Restrict who can dismiss reviews | Maintainers only |
| Require status checks to pass | yes (see below) |
| Require branches up to date | yes |
| Require linear history | yes |
| Require signed commits | yes |
| Require conversation resolution | yes |
| Lock branch | no |
| Allow force pushes | no |
| Allow deletions | no |

#### Required status checks (must all be green)

- `ci / lint`
- `ci / typecheck`
- `ci / unit`
- `ci / build`
- `e2e / preview` (E2E workflow)
- `lighthouse-pr / lighthouse` (with budgets)
- `dependency-review / dependency-review` (for PRs)
- `codeql / analyze (typescript)`
- `codeql / analyze (javascript)`
- `secrets-scan / gitleaks`

#### CODEOWNERS

```
# .github/CODEOWNERS
* @cwlai

# Critical paths
/prisma/ @cwlai
/lib/auth.ts @cwlai
/middleware.ts @cwlai
/instrumentation.ts @cwlai
/sentry.*.config.ts @cwlai
/vercel.json @cwlai
/railway.toml @cwlai
/.github/workflows/ @cwlai
/Dockerfile @cwlai
/docker-compose.yml @cwlai
```

### 4.4 Required GitHub settings

- **Repository → Settings → General → Pull Requests:** allow squash merge only.
- **Repository → Settings → Secrets and variables → Actions:** store `SENTRY_AUTH_TOKEN`, `NEON_API_KEY`, `VERCEL_TOKEN`, `DOPPLER_TOKEN`, `LHCI_TOKEN`, `GITLEAKS_LICENSE`, `GRAFANA_CLOUD_API_KEY`.
- **Repository → Settings → Environments:** `preview` (no approval), `staging` (1 approval), `production` (2 approvals from CODEOWNERS).
- **Rulesets (org level):** prevent deletion of tags, prevent force-push to protected branches.

### 4.5 Database migration on deploy — detailed pattern

Prisma migrations are **not** forward-compatible by default. To do zero-downtime:

1. **Expand/migrate contract:** migrations that add columns must use defaults or be nullable.
2. **Pre-deploy migrations:** the `migrate.yml` workflow runs `prisma migrate deploy` against the production DB DIRECT_URL **before** the Vercel deploy promotion step.
3. **Backfill:** if the migration requires backfill, run it as a separate one-off GH Actions job with `concurrency: migrate-prod` and the `production` environment approval gate.
4. **Cutover:** the new Vercel build is rolled out to all regions; old code continues to work because of step 1.
5. **Cleanup:** a follow-up PR removes now-unused columns (no need to coordinate with deploy).

A Prisma migration that violates expand/contract (e.g., dropping a column that the old code reads) **must be split across two deploys**. CI lint rule (custom script) will check `prisma migrate diff` against the previous schema to flag dangerous operations:

```bash
# scripts/check-migration-safety.sh (used in CI)
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script > diff.sql
if grep -Ei "DROP COLUMN|DROP TABLE|RENAME COLUMN|ALTER COLUMN .* TYPE" diff.sql; then
  echo "::error::Destructive migration detected. Use expand/contract pattern."
  exit 1
fi
```

---

## 5. Container Strategy

### 5.1 Multi-stage Dockerfile

We use `output: 'standalone'` (already configured) which produces `.next/standalone` containing a runnable Node app. Multi-stage build copies the standalone output, static files, and public assets into a slim Alpine image.

```dockerfile
# syntax=docker/dockerfile:1.7
# ---------- Stage 1: deps ----------
FROM node:20.18.1-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
# Use Corepack + pnpm for reproducible installs
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts

# ---------- Stage 2: builder ----------
FROM node:20.18.1-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build
# Prune dev deps to keep the standalone bundle lean
RUN pnpm prune --prod --ignore-scripts

# ---------- Stage 3: runner ----------
FROM node:20.18.1-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone server, static, public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma client + engine binaries (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# Healthcheck (compatible with `docker inspect` and Kubernetes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health | grep -q '"status":"healthy"' || exit 1

CMD ["node", "server.js"]
```

Resulting image size: ~180-220 MB. Multi-arch (`linux/amd64`, `linux/arm64`) for Apple Silicon dev machines and Graviton hosting.

### 5.2 `.dockerignore`

```
node_modules
.next
.git
.github
.claude
.hermes
docs
reports
revamp-v2
__tests__
playwright-report
test-results
coverage
.DS_Store
.env
.env.local
.env.*.local
*.log
*.tsbuildinfo
.k6-cache
```

### 5.3 `docker-compose.yml` (local dev)

```yaml
# docker-compose.yml
name: openproject-rewrite
services:
  postgres:
    image: postgres:16-alpine
    container_name: op-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: openproject
      POSTGRES_PASSWORD: openproject
      POSTGRES_DB: openproject
    ports: ["5432:5432"]
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./scripts/sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openproject"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: op-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest
    container_name: op-mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps      # Use the deps stage for hot-reload dev
    container_name: op-app
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://openproject:openproject@postgres:5432/openproject
      DIRECT_URL: postgresql://openproject:openproject@postgres:5432/openproject
      REDIS_URL: redis://redis:6379
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: dev-only-secret-replace-in-prod-aaaaaaaaaaaa
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NODE_ENV: development
      SENTRY_DSN: ""
      UPSTASH_REDIS_REST_URL: ""
      UPSTASH_REDIS_REST_TOKEN: ""
      SMTP_HOST: mailpit
      SMTP_PORT: "1025"
      EMAIL_FROM: "OpenProject Dev <dev@localhost>"
    ports: ["3000:3000"]
    volumes:
      - .:/app
      - app-node-modules:/app/node_modules
      - app-next:/app/.next
    command: sh -c "corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm exec prisma migrate deploy && pnpm db:seed || true && pnpm dev"

  prometheus:
    image: prom/prometheus:v2.55.0
    container_name: op-prometheus
    profiles: ["observability"]
    volumes:
      - ./ops/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports: ["9090:9090"]
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.retention.time=7d"

  grafana:
    image: grafana/grafana:11.2.2
    container_name: op-grafana
    profiles: ["observability"]
    depends_on: [prometheus]
    ports: ["3001:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
    volumes:
      - ./ops/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./ops/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana-data:/var/lib/grafana

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
  app-node-modules:
  app-next:
```

Use profiles (`--profile observability`) to opt into Prometheus + Grafana locally.

### 5.4 Production image characteristics

- **Base:** `node:20.18.1-alpine` (Alpine 3.20, glibc-compatible via libc6-compat for Prisma).
- **Size target:** < 220 MB compressed, < 600 MB uncompressed.
- **User:** `nextjs` (uid 1001) — non-root, no shell, only `/sbin/nologin`.
- **Healthcheck:** built-in via `HEALTHCHECK` directive.
- **SBOM + provenance:** generated by `docker/build-push-action` (`provenance: true`, `sbom: true`).
- **Multi-arch:** `linux/amd64`, `linux/arm64` (Apple Silicon dev parity + cost savings on AWS Graviton if we ever self-host).
- **Vulnerabilities:** scan in CI using `anchore/scan-action` against Trivy or Grype; fail on CRITICAL.

```yaml
# .github/workflows/image-scan.yml
name: image-scan
on:
  workflow_run:
    workflows: [docker]
    types: [completed]
jobs:
  scan:
    runs-on: ubuntu-latest
    permissions: { actions: read, contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository }}:main
          severity: CRITICAL,HIGH
          exit-code: "1"
          ignore-unfixed: true
          format: sarif
          output: trivy-results.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: trivy-results.sarif }
```

---

## 6. Local Development Experience

### 6.1 Goals

- New developer reaches a working dev server in **< 5 minutes** with **one command**.
- Hot reload, fast test loop, deterministic seed data.
- Reset state without nuking the OS.

### 6.2 `bin/setup` + `Makefile`

#### `bin/setup`

```bash
#!/usr/bin/env bash
# bin/setup — one command, full local dev environment
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$*"; exit 1; }

bold "OpenProject Rewrite — local setup"

# --- 1. Pre-flight checks ---
command -v docker >/dev/null 2>&1 || fail "Docker is required (https://docker.com)"
command -v node  >/dev/null 2>&1 || fail "Node.js 20.x is required"
command -v pnpm  >/dev/null 2>&1 || warn "pnpm not found, installing via corepack"
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.12.0 --activate
  ok "pnpm installed via corepack"
fi

# --- 2. Copy .env ---
[ -f .env.local ] || cp .env.example .env.local
ok ".env.local created (edit values as needed)"

# --- 3. Install deps ---
bold "Installing dependencies..."
pnpm install --frozen-lockfile
ok "pnpm install done"

# --- 4. Start infra ---
bold "Starting Postgres + Redis..."
docker compose up -d postgres redis mailpit
ok "Docker services up"

# --- 5. Wait for health ---
bold "Waiting for Postgres..."
for i in {1..30}; do
  docker compose exec -T postgres pg_isready -U openproject >/dev/null 2>&1 && break
  sleep 1
done
ok "Postgres is ready"

# --- 6. Migrate + seed ---
bold "Applying migrations..."
pnpm exec prisma migrate deploy
ok "Migrations applied"

bold "Seeding dev data..."
pnpm db:seed
ok "Seed data loaded"

# --- 7. Pre-commit hook ---
if [ ! -f .git/hooks/pre-commit ]; then
  pnpm exec lefthook install
  ok "Git hooks installed"
fi

bold "🎉 Setup complete!"
echo ""
echo "  make dev     # start the Next.js dev server"
echo "  make test    # run unit tests"
echo "  make e2e     # run Playwright"
echo "  make reset   # wipe DB + reseed"
```

#### `Makefile`

```makefile
# Makefile
SHELL := /bin/bash
.DEFAULT_GOAL := help

include .env.local
export

DATABASE_URL ?= postgresql://openproject:openproject@localhost:5432/openproject

.PHONY: help setup dev build start test test-watch e2e e2e-ui \
        db-migrate db-seed db-studio db-reset db-shell \
        lint format typecheck analyze \
        logs logs-app logs-db logs-tail \
        docker-up docker-down docker-clean \
        k6-smoke k6-load \
        security-scan tunnel tunnel-stop

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## One-command bootstrap (alias for bin/setup)
	@bin/setup

dev: ## Start dev server with hot reload
	@docker compose up -d postgres redis mailpit
	@pnpm dev

build: ## Production build
	@pnpm build

start: ## Run production build
	@pnpm start

test: ## Run Vitest unit tests
	@pnpm test

test-watch: ## Vitest in watch mode
	@pnpm test -- --watch

e2e: ## Run Playwright
	@pnpm exec playwright install --with-deps chromium
	@pnpm exec playwright test

e2e-ui: ## Playwright UI mode
	@pnpm exec playwright test --ui

db-migrate: ## Apply migrations
	@pnpm exec prisma migrate dev

db-seed: ## Seed dev data
	@pnpm db:seed

db-studio: ## Open Prisma Studio
	@pnpm db:studio

db-reset: ## Wipe DB, re-apply, re-seed
	@pnpm exec prisma migrate reset --force --skip-seed
	@pnpm db:seed

db-shell: ## psql into the dev DB
	@psql "$$DATABASE_URL"

lint: ## ESLint + Prettier check
	@pnpm lint && pnpm prettier --check .

format: ## Format code
	@pnpm prettier --write .

typecheck: ## TypeScript noEmit
	@pnpm exec tsc --noEmit

analyze: ## Bundle analyzer
	@ANALYZE=true pnpm build

docker-up: ## Start everything via docker compose
	@docker compose up -d

docker-down: ## Stop everything
	@docker compose down

docker-clean: ## Stop + remove volumes
	@docker compose down -v

k6-smoke: ## Run k6 smoke test
	@STAGING_URL=$$STAGING_URL k6 run k6/scenarios/smoke.ts

k6-load: ## Run k6 load test
	@STAGING_URL=$$STAGING_URL k6 run k6/scenarios/load.ts

security-scan: ## gitleaks + trivy
	@docker run --rm -v "$$(pwd):/repo" zricethezav/gitleaks:latest detect --no-git -s /repo
	@trivy fs --severity HIGH,CRITICAL .

tunnel: ## Start Cloudflare Tunnel
	@cloudflared tunnel --config ops/cloudflared/config.yml run openproject-dev

tunnel-stop: ## Stop tunnel
	@pkill -f "cloudflared tunnel" || true

logs: ## Tail app logs
	@docker compose logs -f app

logs-db: ## Tail DB logs
	@docker compose logs -f postgres

logs-tail: ## Tail last 100 lines of app
	@docker compose logs --tail=100 app
```

### 6.3 Seed data strategy

`prisma/seed.ts` is invoked by `pnpm db:seed` (already in `package.json` ✓). We expand it to generate:

- 1 organization, 3 projects, 10 users (1 admin, 1 PM, 8 members).
- 5 work package types, 15 statuses, 8 priorities.
- 200 work packages (mix of Task / Bug / Feature / Milestone) with random assignees, due dates, descriptions.
- 50 comments, 20 attachments (small dummy files), 10 wiki pages, 3 meetings, 5 forum threads.
- 1 default workflow for each project.

`prisma/seed.ts` uses `@faker-js/faker` (added to devDeps) for deterministic output (`faker.seed(42)`).

#### Test data factory

In `__tests__/factories/`:

```typescript
// __tests__/factories/work-package.factory.ts
import { faker } from '@faker-js/faker';
import type { WorkPackage } from '@prisma/client';

export const workPackageFactory = (overrides: Partial<WorkPackage> = {}): WorkPackage => ({
  id: faker.string.uuid(),
  subject: faker.lorem.sentence({ min: 3, max: 8 }),
  description: faker.lorem.paragraph(),
  type: faker.helpers.arrayElement(['TASK', 'BUG', 'FEATURE', 'MILESTONE']),
  status: faker.helpers.arrayElement(['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: faker.helpers.arrayElement(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  authorId: faker.string.uuid(),
  assigneeId: faker.string.uuid(),
  projectId: faker.string.uuid(),
  startDate: faker.date.recent(),
  dueDate: faker.date.future(),
  estimatedHours: faker.number.int({ min: 1, max: 40 }),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const userFactory = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  ...
});
```

#### Reset script

`bin/reset` (also exposed as `make reset`):

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "→ Dropping & recreating the openproject database..."
docker compose exec -T postgres psql -U openproject -c "DROP DATABASE IF EXISTS openproject; CREATE DATABASE openproject;"
echo "→ Applying migrations..."
pnpm exec prisma migrate deploy
echo "→ Seeding..."
pnpm db:seed
echo "✓ Reset complete."
```

### 6.4 Hot reload

`docker-compose.yml` mounts the source as a volume, runs `pnpm dev` (Next 15 with Turbopack). HMR works inside the container via webpack/turbopack's HMR socket. For native dev (faster), most contributors use `pnpm dev` directly with a local Postgres (`make db-only` or `docker compose up postgres redis mailpit -d`).

### 6.5 Linting & formatting

Already configured: ESLint 9, Prettier. Add **lefthook** (faster than husky) to run checks on commit:

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx,js,jsx}"
      run: pnpm exec eslint {staged_files}
    format:
      glob: "*.{ts,tsx,js,jsx,json,md}"
      run: pnpm exec prettier --check {staged_files}
    typecheck:
      run: pnpm exec tsc --noEmit
pre-push:
  commands:
    test:
      run: pnpm test -- --run --changed
```

---

## 7. Deployment Platforms & Recommendation

### 7.1 Platform trade-offs

| Platform | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Vercel** | Best Next.js DX, edge + ISR, preview deploys, image opt, analytics, ~0s cold start | Stateful concerns (no managed DB, expensive functions over limits) | ✅ **Use for app frontend** |
| **Railway** | Full-stack: app + DB + Redis, simple, Nixpacks, no surprise bills | Less optimized for Next.js than Vercel, no edge, fewer ISR niceties | ✅ **Use as fallback / DB host** |
| **Fly.io** | Edge, Docker-native, regions everywhere, good prices | More ops work (you manage DB, Redis), no preview envs out-of-box | ⚪ Optional, for edge-only experiments |
| **Self-hosted (Docker + Caddy/Nginx)** | Full control, no vendor lock-in, on-prem possible | Operational burden, security patching, no preview envs | ✅ **Disaster recovery target** |
| **Cloudflare Pages** | Fast, cheap, edge | Weak for dynamic Next.js (Workers adapter needed), cold starts | ❌ Not recommended for this app |
| **Render** | Simple, free tier | Limited ISR, weaker DX | ⚪ Alternative |
| **AWS (ECS / Fargate)** | Full control, scale, mature | Heavyweight, expensive for small team, lots of glue | ❌ Overkill for current stage |

### 7.2 Recommendation

**Vercel (frontend) + Neon (Postgres) + Upstash (Redis) + Cloudflare (delivery + WAF + Access).** This is the canonical "Next.js stack of 2026":

1. **Vercel** hosts the Next.js app — gets preview deploys, ISR, edge middleware, and image optimization for free.
2. **Neon** hosts Postgres with serverless-friendly autoscaling and database branching (one branch per PR).
3. **Upstash** hosts Redis with global replication and a REST API usable from edge runtimes.
4. **Cloudflare** is the DNS, WAF, DDoS, and Tunnel provider — final delivery point and zero-trust boundary.
5. **Railway** is kept as a known-good fallback for the app and as a DB host for the team if cost ever becomes an issue.
6. **Fly.io** is reserved for the future edge case (e.g., a webhook ingestion service) if we ever need it.

### 7.3 Vercel configuration (fixed)

`vercel.json` has a duplicate `regions` key. Fix:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["hkg1"],
  "trailingSlash": false,
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0" }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "redirects": [
    { "source": "/home", "destination": "/dashboard", "permanent": true }
  ],
  "crons": [
    { "path": "/api/cron/sla-check", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cleanup-attachments", "schedule": "0 3 * * *" }
  ]
}
```

Set in Vercel project settings:

- **Build & Development:**
  - Framework preset: Next.js
  - Build command: `npm run build` (or `pnpm build`)
  - Output: `.next`
  - Install command: `npm ci` (or `pnpm install --frozen-lockfile`)
  - Node version: 20.x
- **Environment Variables:** mirrored from Doppler (see §12.2).
- **Integrations:** GitHub, Sentry (uses `SENTRY_AUTH_TOKEN` to upload source maps at build time).

### 7.4 Railway fallback

`railway.toml` is OK but should be hardened:

```toml
[build]
  builder = "nixpacks"
  buildCommand = "npm run build"

[deploy]
  region = "hk"
  numInstances = 2
  healthcheckPath = "/api/health"
  healthcheckTimeout = 30
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 5

[env]
  NODE_ENV = "production"

# Pre-deploy command runs migrations on the same container
[[deploy.predeploy]]
  command = "npx prisma migrate deploy"
```

We keep Railway for the staging environment (faster for the team since we already use it) and as a cold standby.

### 7.5 Self-hosted option (DR)

For self-hosting (DR target or on-prem customer installs), use **Docker + Caddy** with the multi-arch image from GHCR. Caddy handles automatic HTTPS via Let's Encrypt, gzip, and security headers.

`Caddyfile`:

```caddyfile
# Caddyfile
op.example.com {
  encode zstd gzip
  reverse_proxy localhost:3000 {
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    -Server
  }
  log {
    output file /var/log/caddy/access.log {
      roll_size 100mb
      roll_keep 14
    }
  }
}
```

`docker-compose.production.yml`:

```yaml
version: "3.9"
services:
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./ops/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - ./ops/caddy/logs:/var/log/caddy
  app:
    image: ghcr.io/cwlai/openproject-rewrite:main
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL}
      REDIS_URL: ${REDIS_URL}
      NEXTAUTH_URL: https://op.example.com
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      SENTRY_DSN: ${SENTRY_DSN}
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redisdata:/data]
volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:
```

---

## 8. Database Hosting & Operations

### 8.1 Provider comparison

| Provider | Type | Best for | Pros | Cons | Cost (prod 8 GB) |
|----------|------|----------|------|------|------------------|
| **Neon** | Serverless Postgres | Branching, autoscaling | Branching per PR, scale-to-zero, PITR, logical replication | Cold starts (mitigated by pooling) | ~$70/mo (Launch) |
| **Supabase** | BaaS Postgres | Full backend in one | Auth, storage, realtime, generous free tier | Heavy if you don't need the rest | ~$25/mo (Pro) |
| **Railway Postgres** | Managed | Simplicity | Same platform as app, simple | No branching, fixed plans, more $$ at scale | ~$30/mo + usage |
| **Amazon RDS** | Managed | Enterprise | Mature, multi-AZ, KMS | Heavy, expensive, no branching | ~$120+/mo |
| **Crunchy Bridge** | Managed | Enterprise Postgres | PGO, point-in-time, monitoring | Cost | ~$100+/mo |

**Recommendation: Neon** for production, **Supabase local (Docker)** for parity in dev if desired.

### 8.2 Neon setup

1. Create project in `aws-ap-southeast-1` (Singapore — closer to Vercel `hkg1` than US).
2. Create a database `openproject`.
3. Create a role `app` with full privileges on the schema.
4. Enable PITR (default 7 days, upgrade to 30 for prod).
5. Create a read-only role for analytics.
6. Configure connection pooling: Neon has a built-in pooler. Use the pooled URL (`-pooler.neon.tech:5432`) for app connections, the direct URL (`neon.tech:5432`) for migrations.
7. Store URLs in Vercel env:
   - `DATABASE_URL` = pooled URL (used by Prisma at runtime)
   - `DIRECT_URL` = direct URL (used by `prisma migrate deploy`)
   - `SHADOW_DATABASE_URL` = direct URL with `_shadow` suffix (for `migrate dev`)
8. Create API key, store in GitHub Secrets as `NEON_API_KEY` for branch automation.

### 8.3 Connection pooling

Three layers:

1. **Neon built-in pooler (PgBouncer under the hood):** handles 10k+ connections from serverless functions.
2. **Prisma `?pgbouncer=true&connection_limit=1&socket_timeout=10`:** each serverless function opens exactly one connection.
3. **Prisma Accelerate (optional, for edge):** 1M requests/mo free, ~$0.30/M above. Caches at the edge.

Prisma `schema.prisma` example:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

`prisma.config.ts` (already exists) should set the migrations path:

```typescript
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});
```

### 8.4 Backup strategy

| Tier | Frequency | Retention | Storage | Trigger |
|------|-----------|-----------|---------|---------|
| PITR (Neon built-in) | continuous (WAL) | 7 days (prod 30) | Neon managed | automatic |
| Daily logical dump | daily 02:00 UTC | 90 days | S3 (Vercel Blob or external) | GitHub Actions cron |
| Weekly full snapshot | weekly Sun 03:00 | 1 year | S3 Glacier IR | GitHub Actions cron |
| Pre-migration snapshot | on every `migrate deploy` | 30 days | Neon branch | automatic (migrate.yml) |

`scripts/backup-postgres.sh`:

```bash
#!/usr/bin/env bash
# scripts/backup-postgres.sh — daily logical backup to S3
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
: "${S3_BUCKET:?S3_BUCKET required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY required}"

TS=$(date -u +%Y%m%dT%H%M%SZ)
FILE="openproject-${TS}.sql.gz"

# Use pg_dump with --quote-all-identifiers for safety
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges --quote-all-identifiers \
  --format=custom --compress=9 \
  > "/tmp/${FILE}.dump"

# Upload
aws s3 cp "/tmp/${FILE}.dump" "s3://${S3_BUCKET}/daily/${FILE}.dump" \
  --storage-class STANDARD_IA --sse AES256

# Verify (download + pg_restore --list | head)
aws s3 cp "s3://${S3_BUCKET}/daily/${FILE}.dump" "/tmp/verify.dump"
pg_restore --list "/tmp/verify.dump" >/dev/null

# Clean up local
rm -f "/tmp/${FILE}.dump" "/tmp/verify.dump"

echo "Backup uploaded: s3://${S3_BUCKET}/daily/${FILE}.dump"
```

GitHub Action cron (in `ci.yml` matrix or a separate workflow):

```yaml
# .github/workflows/backup.yml
name: db-backup
on:
  schedule:
    - cron: "0 2 * * *"   # 02:00 UTC daily
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: production
    env:
      DATABASE_URL: ${{ secrets.NEON_PROD_DATABASE_URL_UNPOOLED }}
      S3_BUCKET: ${{ vars.BACKUP_S3_BUCKET }}
      AWS_ACCESS_KEY_ID: ${{ secrets.BACKUP_AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_AWS_SECRET_ACCESS_KEY }}
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y postgresql-client awscli
      - run: bash scripts/backup-postgres.sh
```

### 8.5 Migration strategy (zero-downtime)

The expand/contract pattern (outlined in §4.5) is mandatory. CI blocks destructive operations via `scripts/check-migration-safety.sh`. Pre-deploy step in `migrate.yml` runs `prisma migrate deploy` against the DIRECT_URL with the **production environment** approval gate.

For long-running data backfills (e.g., `UPDATE work_packages SET ...` on millions of rows), use a **batched script** in `scripts/migrations/` invoked by a one-off GH Action:

```typescript
// scripts/migrations/backfill-2026-06-add-priority-weight.ts
import { prisma } from '@/lib/prisma';

const BATCH = 1000;
async function main() {
  let lastId: string | undefined;
  while (true) {
    const rows = await prisma.workPackage.findMany({
      where: { priorityWeight: null, ...(lastId ? { id: { gt: lastId } } : {}) },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: { id: true, priority: true },
    });
    if (rows.length === 0) break;
    await prisma.$transaction(
      rows.map((r) =>
        prisma.workPackage.update({
          where: { id: r.id },
          data: { priorityWeight: priorityToWeight(r.priority) },
        }),
      ),
    );
    lastId = rows[rows.length - 1].id;
    console.log(`Processed ${rows.length} (lastId=${lastId})`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
main().finally(() => prisma.$disconnect());
```

---

## 9. Redis Hosting & Operations

### 9.1 Provider comparison

| Provider | Type | Best for | Pros | Cons | Cost |
|----------|------|----------|------|------|------|
| **Upstash** | Serverless Redis | Edge + serverless | REST API (works in edge), global replicas, pay-per-request | Less suited for huge hot datasets | $0.20/100k commands + storage |
| **Redis Cloud (Redis Labs)** | Managed | Heavy use, modules | Modules (RediSearch, RedisJSON), CRDT for active-active | No edge, no REST | From $5/mo |
| **Upstash Redis (with QStash)** | Serverless | Job queues | QStash for retries | Vendor lock-in | $0.50/100k jobs |
| **KeyDB / Dragonfly** | Self-hosted | Throughput | Faster | Operational burden | Self-managed |
| **Railway Redis** | Managed | Dev / small prod | Simple | No edge, single region | ~$5/mo |

**Recommendation: Upstash** (already in deps: `@upstash/redis`, `@upstash/ratelimit`).

### 9.2 Upstash configuration

- **Plan:** Pro 10k commands/day free, Pay-as-you-go above.
- **Regions:** `ap-southeast-1` (primary) + `ap-northeast-1` (replica) for global reads.
- **Eviction:** `allkeys-lru` for cache namespaces; `noeviction` for rate-limit + queue namespaces.
- **TLS:** enforced (Upstash provides `rediss://` URL).
- **Credentials:** store `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env (already in `.env.example`).

### 9.3 Key namespaces

| Key prefix | Purpose | TTL | Eviction |
|------------|---------|-----|----------|
| `cache:v1:project:{id}` | Cached project metadata | 60 s | `allkeys-lru` |
| `cache:v1:user:{id}` | Cached user profile | 300 s | `allkeys-lru` |
| `ratelimit:v1:{ip}:{route}` | Rate-limit counters | sliding 60 s | `allkeys-lru` |
| `queue:v1:emails` | Email send queue (BullMQ) | none | `noeviction` |
| `queue:v1:webhooks` | Outbound webhook queue | none | `noeviction` |
| `session:v1:{jti}` | Active JWT jti (revocation) | 30 d | `volatile-ttl` |

### 9.4 Client configuration

`lib/redis.ts`:

```typescript
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: true,
      cache: 'no-store',
    });
  }
  return redis;
}

// ioredis fallback for BullMQ (server-only)
import IORedis from 'ioredis';

let bullmq: IORedis | null = null;
export function getBullMQRedis(): IORedis {
  if (!bullmq) {
    bullmq = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,  // BullMQ requirement
      enableReadyCheck: false,
    });
  }
  return bullmq;
}
```

### 9.5 Rate limiting at the edge

`lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const rateLimiters = {
  auth:        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 m'),   prefix: 'rl:auth' }),
  api:         new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'rl:api' }),
  upload:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'),  prefix: 'rl:up'  }),
  passwordReset: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:pw'  }),
  aiSummary:   new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(20, '1 m', 5), prefix: 'rl:ai'  }),
};
```

Used in `middleware.ts` (edge-compatible) and inside API routes.

### 9.6 Geo-replication

Upstash Global Database replicates writes between regions (CRDT-based active-active). For a Hong Kong + Singapore user base, we use:

- Primary: `ap-southeast-1` (Singapore) — closest to Vercel `hkg1`.
- Replica: `ap-northeast-1` (Tokyo) — for read scaling in JP/KR.
- Read preference: writes go to primary; reads served from nearest region with `await redis.get(key, { latencyOptimized: true })`.

---

## 10. Monitoring, Logging & Observability

### 10.1 Sentry (errors, performance, replays, profiling)

#### Client + server + edge configs (replacement for the minimal existing ones)

`sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  profilesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSendTransaction(event) {
    if (event.transaction === '/api/health') return null;
    return event;
  },
  beforeSend(event) {
    if (event.user) {
      delete (event.user as any).email;
      delete (event.user as any).ip_address;
    }
    return event;
  },
  integrations: [
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/.*\.openproject\.example\.com/,
        /^https:\/\/api\.openproject\.example\.com/,
      ],
    }),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
});
```

`sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  sendDefaultPii: false,
  integrations: [
    Sentry.prismaIntegration(),
    Sentry.httpIntegration(),
    Sentry.nativeNodeFetchIntegration(),
  ],
  beforeSendTransaction(event) {
    if (event.transaction === '/api/health') return null;
    if (event.transaction?.startsWith('/_next/')) return null;
    return event;
  },
  beforeSend(event) {
    if (event.user) {
      delete (event.user as any).email;
      delete (event.user as any).ip_address;
      delete (event.user as any).username;
    }
    return event;
  },
});
```

`sentry.edge.config.ts` (new):

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.05,
});
```

#### `instrumentation.ts` (replacement)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(err, request, context) {
  // Surface server-component / route-handler errors to Sentry
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
}
```

#### Source maps

Built by Sentry CLI (installed as part of `@sentry/nextjs`):

```json
// .sentryclirc
[defaults]
url=https://sentry.io/
org=acme
project=openproject-rewrite

[auth]
token=__SENTRY_AUTH_TOKEN__
```

`next.config.js` enables source map upload via `withSentryConfig`:

```javascript
const { withSentryConfig } = require('@sentry/nextjs');
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
```

#### Release tracking

Tagged by SHA: `release: process.env.SENTRY_RELEASE` is set by the Vercel integration and the `release.yml` GitHub Action.

### 10.2 Structured logging

We add `pino` (smallest, fastest Node logger) and a request-context middleware.

`lib/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'openproject-rewrite',
    env: process.env.NODE_ENV,
    region: process.env.VERCEL_REGION,
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      'email',
    ],
    censor: '[REDACTED]',
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
```

`lib/api-logger.ts` (Next API route wrapper):

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from './logger';

export function withLogging<T>(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<T> | T,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const start = Date.now();
    const log = logger.child({
      reqId: req.headers['x-request-id'] ?? crypto.randomUUID(),
      method: req.method,
      url: req.url,
    });
    try {
      const result = await handler(req, res);
      log.info({ statusCode: res.statusCode, durationMs: Date.now() - start }, 'request');
      return result;
    } catch (err) {
      log.error({ err, statusCode: res.statusCode, durationMs: Date.now() - start }, 'request failed');
      throw err;
    }
  };
}
```

We ship logs to **Better Stack** (cheaper than Datadog for small teams, generous free tier):

- Vercel → Better Stack via `@logtail/pino` (5 GB/month free, $0.25/GB after).
- Local Docker → stdout (compose logs).

`lib/logger.ts` transport:

```typescript
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/pino';

const transports = [pino.destination(1)]; // stdout for Docker
if (process.env.BETTER_STACK_SOURCE_TOKEN) {
  const logtail = new Logtail(process.env.BETTER_STACK_SOURCE_TOKEN);
  transports.push(new LogtailTransport({ logtail }));
}
```

### 10.3 Metrics (Prometheus)

`pages/api/metrics.ts` (server-only):

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

if (!register.getSingleMetric('process_cpu_user_seconds_total')) {
  collectDefaultMetrics({ register });
}

export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});
export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'DB query duration',
  labelNames: ['model', 'action'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});
export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Active users in last 5 minutes',
  registers: [register],
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Content-Type', register.contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.send(await register.metrics());
}

export const config = { api: { bodyParser: false } };
```

Authenticate with a bearer token via a separate `METRICS_AUTH_TOKEN` env.

For Grafana Cloud free tier (10k series, 50 GB logs), point a Prometheus remote_write against it, or scrape via a Cloudflare Worker.

### 10.4 Uptime monitoring

**Better Uptime** (free tier: 10 monitors, 3-min checks) for:

- `https://app.openproject.example.com/api/health` (200 expected).
- `https://app.openproject.example.com/` (200, contains `<title>`).
- `https://app.openproject.example.com/login` (200, contains `Sign in`).

Notifications → Slack `#ops-alerts`, PagerDuty, email.

### 10.5 Synthetic monitoring (Playwright)

A GitHub Action running every 5 minutes on a schedule (cron `*/5 * * * *`) drives a real browser through:

1. Visit `/login`.
2. Sign in as a smoke-test user.
3. Navigate to `/dashboard`.
4. Open a known work package.
5. Create a comment.
6. Sign out.

A failure routes to the same alerts. The script lives in `__tests__/synthetic/smoke.spec.ts` and is also used locally.

```yaml
# .github/workflows/synthetic.yml
name: synthetic-monitor
on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      BASE_URL: https://app.openproject.example.com
      SMOKE_USER_EMAIL: ${{ secrets.SMOKE_USER_EMAIL }}
      SMOKE_USER_PASSWORD: ${{ secrets.SMOKE_USER_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.18.1, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec playwright test __tests__/synthetic --reporter=line
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.27.0
        with:
          payload: |
            {"text": ":rotating_light: Synthetic monitor failed for ${{ env.BASE_URL }} — ${{ github.run_id }}"}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 10.6 Alerting tiers

| Severity | Example | Channel | Ack SLA |
|----------|---------|---------|---------|
| P1 (critical) | API down 5 min, DB unreachable, error rate > 5% | PagerDuty + Slack | 5 min |
| P2 (high) | p95 > 1s for 10 min, Sentry error spike | Slack `#ops-alerts` | 30 min |
| P3 (med) | Disk > 80%, backup missed | Slack `#ops-low` | 4 h |
| P4 (info) | Dependabot PR opened, weekly cost anomaly | GitHub/Slack | next business day |

### 10.7 Status page

Public status page: **Instatus** (free for 1 service, custom domain). Auto-update via Better Uptime webhook.

---

## 11. Performance Engineering

### 11.1 Targets

| Metric | Target | Source |
|--------|--------|--------|
| **TTFB (cold)** | < 200 ms p95 | Vercel Edge |
| **TTFB (warm)** | < 80 ms p95 | Vercel Edge |
| **LCP** | < 2.5 s p75 | Lighthouse CI, Web Vitals |
| **INP** | < 200 ms p75 | Web Vitals |
| **CLS** | < 0.1 p75 | Web Vitals |
| **API GET p95** | < 200 ms | k6, Sentry |
| **API write p95** | < 500 ms | k6, Sentry |
| **Bundle (home page)** | < 200 KB JS gz | next-bundle-analyzer |
| **Cache hit ratio** | > 60 % | Upstash metrics |

### 11.2 CDN

**Vercel Edge Network** is enabled by default. For Cloudflare-fronted deployments, configure a **CNAME chain**: Cloudflare → Vercel (`*.vercel.app` or custom via Vercel DNS).

Cache-Control headers from `vercel.json` (§7.3) set:

- `/_next/static/*` → `public, max-age=31536000, immutable` (1 year).
- `/api/*` → `no-store, max-age=0`.
- `/` and dynamic SSR → rely on ISR or `s-maxage=60, stale-while-revalidate=300`.

### 11.3 Image optimization

`next/image` is used everywhere. Configure remote patterns:

```javascript
// next.config.js
module.exports = withBundleAnalyzer(withSentryConfig({
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,  // 30 days
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@radix-ui/react-icons'],
  },
  ...
}));
```

### 11.4 Bundle analysis

`pnpm analyze` runs `ANALYZE=true next build` and opens the report (saved to `analyze/`). CI runs bundle comparison on every PR and comments with size diffs (`bundlewatch` or `size-limit`):

```json
// .size-limit.json
[
  { "name": "Total First Load JS", "path": ".next/analyze/client.json", "limit": "200 KB", "ignore": ["react", "react-dom"] },
  { "name": "Largest page bundle", "path": ".next/analyze/*.json", "limit": "150 KB" }
]
```

```yaml
# .github/workflows/bundle.yml
name: bundle
on: pull_request
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 11.5 Lighthouse CI

See §4.2.5. Runs on every PR and on main merges.

### 11.6 Web Vitals

Use `@next/web-vitals`:

```typescript
// pages/_app.tsx
import { useReportWebVitals } from 'next/web-vitals';

export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Send to /api/web-vitals
  const body = JSON.stringify(metric);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/web-vitals', body);
  } else {
    fetch('/api/web-vitals', { body, method: 'POST', keepalive: true });
  }
}
```

`pages/api/web-vitals.ts` stores in Sentry (custom metric) and in Upstash (Redis counter keyed by route + day).

### 11.7 Database query performance

- `prisma.$queryRaw` for any query > 100 ms.
- Indexes on `(projectId, status)`, `(assigneeId, dueDate)`, `(authorId, createdAt)`.
- `EXPLAIN ANALYZE` checks in CI for any new migration touching large tables (see §4.5 lint).
- Slow query log: Prisma `log: ['warn']` for queries > 200 ms.

### 11.8 Edge cache for read APIs

Hot endpoints (e.g., `GET /api/projects`, `GET /api/work-packages?projectId=...`) are wrapped in a `unstable_cache` (Next 15 native cache):

```typescript
import { unstable_cache } from 'next/cache';

export const getProject = unstable_cache(
  async (id: string) => prisma.project.findUnique({ where: { id } }),
  ['project'],
  { revalidate: 60, tags: [`project:${id}`] },
);
```

Tag-based revalidation on writes:

```typescript
import { revalidateTag } from 'next/cache';
revalidateTag(`project:${id}`);
```

---

## 12. Production Security

### 12.1 Principles

- **Zero trust** at the network edge (Cloudflare Access for internal tools).
- **Least privilege** for secrets and DB roles.
- **Defense in depth** — no single layer assumed to catch all attacks.
- **Auditability** — every prod change is logged, every auth event is logged.

### 12.2 Secrets management

#### Source of truth: **Doppler**

- Single source of truth, audited access logs, fine-grained tokens, Slack break-glass.
- Doppler project `openproject-rewrite` with three configs: `dev`, `staging`, `production`.
- Mirrored to:
  - **Vercel** via Doppler → Vercel integration (auto-sync on save).
  - **GitHub Actions** via Doppler CLI (`doppler secrets download --token "$DOPPLER_TOKEN" --format env >> $GITHUB_ENV`).
  - **Railway** via Doppler → Railway integration.
  - **Local** via `doppler run -- pnpm dev` (no `.env.local` needed).

#### Local dev fallback: **1Password CLI**

`bin/setup` offers either path:

```bash
# Doppler
brew install dopplerhq/cli/doppler
doppler login
doppler setup

# 1Password
brew install --cask 1password-cli
op signin
```

`Makefile` has `make dev` use Doppler automatically.

#### What's NEVER in env

- API keys for third parties go in Doppler, not git.
- `.env` files are in `.gitignore` (already done ✓).
- The `.env.example` is the only env file in git, with placeholder values.

### 12.3 HTTPS only

- Vercel: automatic.
- Cloudflare: automatic, with HSTS preload.
- Self-hosted: Caddy automatic via Let's Encrypt.

### 12.4 Rate limiting at the edge

Two layers:

1. **Cloudflare** (network edge): rate-limit rules in `WAF → Rate limit rules`:
   - `1000 req / 10 s` per IP for the whole zone.
   - `10 req / 60 s` per IP for `/api/auth/*`.
   - `5 req / 60 s` per IP for `/api/auth/callback/*`.
2. **Upstash Ratelimit** (application edge): see §9.5.

### 12.5 WAF rules (Cloudflare)

| Rule | Action | Notes |
|------|--------|-------|
| SQLi patterns (managed WAF) | Block | Cloudflare Managed Ruleset (Cloudflare OWASP) |
| XSS patterns (managed WAF) | Block | OWASP |
| Bad bots (managed) | Block | Cloudflare Bot Fight Mode |
| High threat score (>= 25) | JS challenge | Cloudflare IP Reputation |
| Country block list (optional) | Block | If user base is HK+TW+JP+SG only |
| Large POST /api/upload (>25 MB) | Block | Per Next.js body limit |
| Methods other than GET/POST/OPTIONS/HEAD/PUT/DELETE | Block | |

### 12.6 Security headers (enforced in `vercel.json` + Caddy + CSP)

`middleware.ts` adds (in addition to `vercel.json` defaults):

```typescript
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.sentry.io https://browser.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io https://*.upstash.io wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

res.headers.set('Content-Security-Policy', csp);
res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
```

We deliberately keep `unsafe-inline` for scripts initially (Next.js inline runtime); tighten to nonce-based in Phase 6+.

### 12.7 CSRF, CORS, cookies

- NextAuth's built-in CSRF + same-site cookies (lax).
- `NEXTAUTH_URL` matches the public origin (no env drift).
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (in prod).
- CORS: same-origin only by default; explicit `Access-Control-Allow-Origin` for `/api/public/*` and webhook receivers.

### 12.8 Auth & authorization

- `next-auth` v4 (already in deps).
- Providers: credentials (email + password + TOTP) + GitHub OAuth + Google OAuth.
- `isSystemAdmin()` and `validatePassword()` helpers in `lib/auth.ts` (already ✓).
- WebAuthn (passkeys) supported via `@simplewebauthn/*` (already in deps ✓).
- Password policy: 12+ chars, zxcvbn score ≥ 3, breach check via HIBP `?p=` API.
- Account lockout after 5 failed logins (15-min cool-down, persistent counter in Redis).

### 12.9 Audit log

Every state-changing action records:

```typescript
await prisma.auditLog.create({
  data: {
    actorId: session.user.id,
    action: 'work_package.update',
    targetType: 'WorkPackage',
    targetId: wp.id,
    changes: { before, after },
    ip: req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
  },
});
```

Shipped to Better Stack + retained 365 days (compliance-friendly).

### 12.10 Dependency security

- Dependabot weekly (see §4.2.7).
- `pnpm audit` in CI (fails on HIGH+).
- Renovate (optional alternative to Dependabot).
- Snyk free tier for OSS license + vuln monitoring.

### 12.11 PII handling

- Sentry: `sendDefaultPii: false`; `beforeSend` scrubs email + IP.
- Logs: pino redact list (§10.2).
- DB: encrypted at rest (Neon default, AES-256), TLS in transit.
- Application: column-level encryption for sensitive fields (e.g., API tokens) using `node:crypto` AES-256-GCM with key from `APP_ENCRYPTION_KEY`.

---

## 13. Load Testing with k6

### 13.1 Goals

- Validate SLA targets: p95 < 200 ms reads, < 500 ms writes.
- Identify bottlenecks before launch.
- Establish a regression baseline.
- Stress the system to find the breaking point.

### 13.2 Scenarios

`k6/scenarios/smoke.ts` and `k6/scenarios/load.ts` already exist. We **rewrite** them to be auth-correct and to cover all the required user flows.

#### `k6/scenarios/smoke.ts` (rewritten)

```typescript
// k6/scenarios/smoke.ts — light load, validates happy path
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { login } from '../lib/auth.js';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const wpReadDuration = new Trend('wp_read_duration');
const wpWriteDuration = new Trend('wp_write_duration');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { test: 'smoke' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    wp_read_duration:  ['p(95)<200'],
    wp_write_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';
const USERNAME  = __ENV.TEST_USER;
const PASSWORD  = __ENV.TEST_PASSWORD;

export function setup() {
  const session = login(BASE_URL, USERNAME, PASSWORD);
  if (!session) throw new Error('login failed in setup()');
  return { cookies: session.cookies, csrfToken: session.csrfToken };
}

export default function (data) {
  const jar = http.cookieJar();
  Object.entries(data.cookies).forEach(([k, v]) => jar.set(BASE_URL, k, v));

  const headers = { headers: { 'X-CSRF-Token': data.csrfToken } };

  // 1. health
  let t0 = Date.now();
  let r = http.get(`${BASE_URL}/api/health`, headers);
  apiDuration.add(Date.now() - t0);
  check(r, { 'health 200': (x) => x.status === 200 });
  errorRate.add(r.status !== 200);

  // 2. list projects
  t0 = Date.now();
  r = http.get(`${BASE_URL}/api/projects?limit=50`, headers);
  apiDuration.add(Date.now() - t0);
  check(r, { 'projects 200': (x) => x.status === 200 });
  errorRate.add(r.status !== 200);
  if (r.status !== 200) return;

  const projects = r.json('data') ?? [];
  if (projects.length === 0) return;
  const projectId = projects[0].id;

  // 3. list work packages
  t0 = Date.now();
  r = http.get(`${BASE_URL}/api/projects/${projectId}/work-packages?limit=50`, headers);
  wpReadDuration.add(Date.now() - t0);
  apiDuration.add(Date.now() - t0);
  check(r, { 'wps 200': (x) => x.status === 200 });
  errorRate.add(r.status !== 200);
  if (r.status !== 200) return;

  const wps = r.json('data') ?? [];
  if (wps.length === 0) return;
  const wpId = wps[0].id;

  // 4. work package detail
  t0 = Date.now();
  r = http.get(`${BASE_URL}/api/work-packages/${wpId}`, headers);
  wpReadDuration.add(Date.now() - t0);
  apiDuration.add(Date.now() - t0);
  check(r, { 'wp detail 200': (x) => x.status === 200 });

  // 5. create work package
  t0 = Date.now();
  r = http.post(
    `${BASE_URL}/api/projects/${projectId}/work-packages`,
    JSON.stringify({
      subject: `k6 smoke ${Date.now()}`,
      type: 'TASK',
      description: 'Created by k6 smoke test',
    }),
    { ...headers, headers: { ...headers.headers, 'Content-Type': 'application/json' } },
  );
  wpWriteDuration.add(Date.now() - t0);
  apiDuration.add(Date.now() - t0);
  check(r, { 'wp create 201': (x) => x.status === 201 });
  errorRate.add(r.status !== 201);

  sleep(1);
}
```

#### `k6/scenarios/load.ts` (rewritten — full load)

```typescript
// k6/scenarios/load.ts — sustained 100 VUs, mixed read/write
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { login } from '../lib/auth.js';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const readDuration = new Trend('wp_read_duration');
const writeDuration = new Trend('wp_write_duration');
const loginDuration = new Trend('login_duration');

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { test: 'read_heavy' },
      exec: 'readFlow',
    },
    write_heavy: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      tags: { test: 'write_heavy' },
      exec: 'writeFlow',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
    wp_read_duration:  ['p(95)<200'],
    wp_write_duration: ['p(95)<500'],
    login_duration:    ['p(95)<800'],
    errors: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';
const USERNAME  = __ENV.TEST_USER;
const PASSWORD  = __ENV.TEST_PASSWORD;

export function setup() {
  // One login per VU is fine — VUs have isolated cookie jars.
  // We don't share state across VUs.
  return { baseUrl: BASE_URL, username: USERNAME, password: PASSWORD };
}

function auth(data) {
  const session = login(data.baseUrl, data.username, data.password);
  if (!session) throw new Error('login failed');
  const jar = http.cookieJar();
  Object.entries(session.cookies).forEach(([k, v]) => jar.set(data.baseUrl, k, v));
  return { cookies: session.cookies, csrf: session.csrfToken };
}

export function readFlow(data) {
  const sess = auth(data);
  const headers = { headers: { 'X-CSRF-Token': sess.csrf } };

  const t0 = Date.now();
  const projects = http.get(`${data.baseUrl}/api/projects?limit=50`, headers);
  if (projects.status !== 200) { errorRate.add(1); return; }
  const projectId = projects.json('data')[0].id;

  const t1 = Date.now();
  const wps = http.get(`${data.baseUrl}/api/projects/${projectId}/work-packages?limit=50`, headers);
  readDuration.add(Date.now() - t1);
  apiDuration.add(Date.now() - t0);
  check(wps, { 'wps 200': (r) => r.status === 200 });
  errorRate.add(wps.status !== 200);

  if (wps.status === 200 && wps.json('data').length > 0) {
    const wpId = wps.json('data')[0].id;
    const t2 = Date.now();
    const detail = http.get(`${data.baseUrl}/api/work-packages/${wpId}`, headers);
    readDuration.add(Date.now() - t2);
  }
  sleep(Math.random() * 2 + 0.5);
}

export function writeFlow(data) {
  const sess = auth(data);
  const headers = { headers: { 'X-CSRF-Token': sess.csrf, 'Content-Type': 'application/json' } };

  const t0 = Date.now();
  const projects = http.get(`${data.baseUrl}/api/projects?limit=50`, sess);
  if (projects.status !== 200) { errorRate.add(1); return; }
  const projectId = projects.json('data')[0].id;

  const t1 = Date.now();
  const created = http.post(
    `${data.baseUrl}/api/projects/${projectId}/work-packages`,
    JSON.stringify({
      subject: `k6 load ${Date.now()}-${Math.random()}`,
      type: 'TASK',
    }),
    headers,
  );
  writeDuration.add(Date.now() - t1);
  apiDuration.add(Date.now() - t0);
  check(created, { 'wp create 201': (r) => r.status === 201 });
  errorRate.add(created.status !== 201);

  if (created.status === 201) {
    const id = created.json('data').id;
    const t2 = Date.now();
    const updated = http.patch(
      `${data.baseUrl}/api/work-packages/${id}`,
      JSON.stringify({ descriptionLog: 'k6 update' }),
      headers,
    );
    writeDuration.add(Date.now() - t2);
    errorRate.add(updated.status !== 200);
  }
  sleep(Math.random() * 3 + 1);
}
```

#### `k6/scenarios/stress.ts` (peak)

```typescript
// k6/scenarios/stress.ts — push to 200 VUs to find breaking point
import { default as base } from './load.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      tags: { test: 'stress' },
      exec: 'readFlow',
    },
  },
  thresholds: {
    // Looser — we want to see where it breaks
    http_req_failed: ['rate<0.05'],
    wp_read_duration: ['p(95)<500'],
  },
};

export { setup, readFlow, writeFlow } from './load.js';
```

#### `k6/scenarios/spike.ts` (sudden burst)

```typescript
// k6/scenarios/spike.ts — sudden 500 VU burst
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '1m',  target: 500 },
        { duration: '10s', target: 0 },
      ],
      tags: { test: 'spike' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],  // tolerate degradation
  },
};
```

#### `k6/scenarios/upload.ts` (file upload)

```typescript
// k6/scenarios/upload.ts — large file upload scenario
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { open } from 'k6/fs';
import { login } from '../lib/auth.js';

const uploadDuration = new Trend('upload_duration');
const errorRate = new Rate('errors');

const file = open('./fixtures/sample-10mb.pdf', 'b');

export const options = {
  scenarios: {
    upload: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      tags: { test: 'upload' },
    },
  },
  thresholds: {
    upload_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.STAGING_URL;

export function setup() {
  return login(BASE_URL, __ENV.TEST_USER, __ENV.TEST_PASSWORD);
}

export default function (data) {
  const jar = http.cookieJar();
  Object.entries(data.cookies).forEach(([k, v]) => jar.set(BASE_URL, k, v));

  const fd = {
    file: http.file(file, 'sample.pdf', 'application/pdf'),
    description: 'k6 upload test',
  };
  const t = Date.now();
  const r = http.post(`${BASE_URL}/api/attachments`, fd, {
    headers: { 'X-CSRF-Token': data.csrfToken },
  });
  uploadDuration.add(Date.now() - t);
  check(r, { 'upload 201': (x) => x.status === 201 });
  errorRate.add(r.status !== 201);
}
```

#### `k6/lib/auth.js` (real NextAuth login)

```javascript
// k6/lib/auth.js — login helper for NextAuth credentials
import http from 'k6/http';

export function login(baseUrl, username, password) {
  // 1. Fetch CSRF token
  const csrfRes = http.get(`${baseUrl}/api/auth/csrf`);
  if (csrfRes.status !== 200) return null;
  const csrfToken = csrfRes.json('csrfToken');

  // 2. Sign in via credentials callback
  const signInRes = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    {
      csrfToken,
      email: username,
      password,
      redirect: 'false',
      json: 'true',
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  if (signInRes.status !== 200 && signInRes.status !== 302) return null;

  // 3. Extract session token cookie
  const cookies = {};
  signInRes.cookies.forEach((c) => {
    if (['next-auth.session-token', '__Secure-next-auth.session-token'].includes(c.name)) {
      cookies[c.name] = c.value;
    }
  });

  if (Object.keys(cookies).length === 0) return null;
  return { cookies, csrfToken };
}
```

### 13.3 CI integration

```yaml
# .github/workflows/k6-smoke.yml
name: k6-smoke
on:
  schedule: [{ cron: "0 6 * * 1" }]   # weekly Monday 06:00 UTC
  workflow_dispatch:
jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    container: { image: grafana/k6:0.54.0 }
    env:
      STAGING_URL: ${{ secrets.STAGING_URL }}
      TEST_USER: ${{ secrets.K6_TEST_USER }}
      TEST_PASSWORD: ${{ secrets.K6_TEST_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
        with: { path: 'tests' }
      - working-directory: tests
        run: k6 run --out json=results.json k6/scenarios/smoke.ts
      - uses: actions/upload-artifact@v4
        with: { name: k6-smoke, path: tests/results.json }
      - name: Notify Slack on failure
        if: failure()
        run: echo "k6 smoke failed"
```

`k6-load.yml` is manual only (gated by the staging environment).

### 13.4 SLA targets

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Login | 200 ms | 800 ms | 1500 ms |
| GET /api/health | 20 ms | 100 ms | 200 ms |
| GET /api/projects | 80 ms | 200 ms | 400 ms |
| GET /api/work-packages/:id | 60 ms | 200 ms | 400 ms |
| POST /api/work-packages | 200 ms | 500 ms | 1000 ms |
| PATCH /api/work-packages/:id | 200 ms | 500 ms | 1000 ms |
| POST /api/attachments (10 MB) | 1500 ms | 3000 ms | 6000 ms |

---

## 14. Disaster Recovery & Business Continuity

### 14.1 RTO / RPO targets

| Tier | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|------|-------------------------------|--------------------------------|
| **Production (Tier 1)** | 1 hour | 5 minutes (PITR) |
| **Staging (Tier 2)** | 4 hours | 24 hours (daily backup) |
| **Local dev (Tier 3)** | Best effort | None |

### 14.2 Backup schedule (consolidated)

| Backup | Frequency | Retention | Tool | Storage |
|--------|-----------|-----------|------|---------|
| Postgres PITR (Neon) | Continuous WAL | 7 days (30 in prod) | Neon built-in | Neon |
| Postgres logical dump | Daily 02:00 UTC | 90 days | `scripts/backup-postgres.sh` + S3 | S3 Standard-IA |
| Postgres full snapshot | Weekly Sun 03:00 UTC | 1 year | Neon API → S3 | S3 Glacier IR |
| Pre-migration snapshot | Per deploy | 30 days | Neon branch | Neon |
| Redis (Upstash) | Daily export | 7 days | Upstash `SCAN` + JSON | S3 |
| Vercel deployment artifacts | Continuous | 30 days | Vercel | Vercel |
| Sentry source maps | Per release | 90 days | Sentry | Sentry |

### 14.3 Restore runbook

#### Scenario A: Accidental data loss / bad migration

**Symptoms:** Users report missing or corrupted data; Sentry error spike.

**Steps:**

1. Open incident channel `#inc-2026-XX` in Slack.
2. Page on-call (P1 if production).
3. **Decide: forward fix or restore?**
   - If a recent migration is the cause, write a corrective migration, deploy.
   - If the data is unrecoverable from app code, proceed to step 4.
4. Use Neon console → **Time Travel** to create a new branch at `T - 5min`.
5. Verify the data on the restored branch.
6. In a maintenance window (or via blue/green via Vercel preview), promote the restored branch to primary:
   - Swap `DATABASE_URL` in Vercel env to the restored branch's pooled URL.
   - Trigger a `vercel redeploy`.
7. Run `prisma migrate resolve --applied <failing-migration>` for any partial migrations.
8. Communicate to users.
9. Postmortem within 5 business days.

#### Scenario B: Full production DB loss

**Steps:**

1. Provision a new Neon project in the same region.
2. Pull the most recent nightly logical dump from S3:
   ```bash
   aws s3 cp s3://$BUCKET/daily/openproject-YYYYMMDDTHHMMSSZ.sql.gz.dump /tmp/restore.dump
   ```
3. Restore:
   ```bash
   createdb openproject
   pg_restore -d openproject --no-owner --no-privileges /tmp/restore.dump
   ```
4. Replay WAL from PITR if more recent than the dump (Neon Time Travel can recreate a branch at any point in the last 7/30 days — preferred over manual restore).
5. Update `DATABASE_URL` in Vercel env (and Doppler) to the new project.
6. Run `prisma migrate resolve` to clear migration state.
7. Vercel redeploy.
8. Verify with `curl /api/health` and synthetic monitor.
9. Communicate.

#### Scenario C: Region outage (Vercel hkg1 down)

1. Vercel automatically fails over within ~30 s in most cases.
2. If not, manual: change `regions` in `vercel.json` to add `sin1` (or use Vercel project's failover region setting), commit, push.
3. DB: fail over Neon primary to `ap-northeast-1` (Tokyo) via console.
4. Re-verify `/api/health`.

#### Scenario D: Full Vercel outage

1. Trigger Docker image build from GHCR (latest green image).
2. Deploy via Railway fallback (already configured `railway.toml`).
3. Update Cloudflare DNS A/CNAME to Railway.
4. Verify.
5. When Vercel recovers, redeploy to Vercel and flip DNS back.

#### Scenario E: Secret leak

1. Rotate the leaked secret in Doppler immediately.
2. Sync to all consumers.
3. Audit Sentry / logs for any misuse.
4. Open PR to add the secret pattern to `gitleaks` config to prevent recurrence.

### 14.4 DR drill

Quarterly (calendar reminder): execute Scenario A against staging, time it, document the result in the team's `docs/dr-drills/` folder. Quarterly target: full restore in < 30 min.

### 14.5 Business continuity contacts

Documented in `docs/contacts.md` (kept out of git if it contains PII):

- On-call rotation (PagerDuty schedule `openproject-oncall`).
- Vercel support (Pro/Enterprise SLA).
- Neon support (Launch plan: email + Slack Connect).
- Upstash support.
- Sentry support.
- Cloudflare support (Pro plan: phone + chat).
- DNS registrar.

---

## 15. Cloudflare Tunnel for Final Delivery

Per the user's memory, the final delivery of the demo app is through a **Cloudflare Tunnel URL**. This section provides the complete setup.

### 15.1 Why a Tunnel (vs. just DNS to Vercel)

- **Zero open inbound ports** on the Vercel edge — Cloudflare is the only entry point.
- **WAF, DDoS, rate limiting** all in front.
- **Cloudflare Access** (zero-trust) can wrap the URL with email-OTP, Google, or GitHub auth, gating the app for a private demo.
- **Custom hostname** is free with any Cloudflare-managed domain.
- **Stable URL** even if Vercel preview URLs change.

### 15.2 Architecture

```
User ── DNS ──► Cloudflare Edge
                    │ (WAF, Cache, Access, Rate-limit)
                    │
                    ▼ cloudflared tunnel (outbound-only)
                    │
                    ▼
              Origin service:
                • Vercel:    https://app.openproject.example.com (public)
                • Local dev:  http://localhost:3000 (over tunnel)
                • Staging:   https://staging.openproject.example.com
```

### 15.3 Setup (one-time, by the project owner)

```bash
# 1. Install cloudflared
# macOS
brew install cloudflared
# Linux (Debian/Ubuntu)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# 2. Login
cloudflared tunnel login
# → opens browser, select the zone (e.g., openproject.example.com)

# 3. Create the tunnel
cloudflared tunnel create openproject-dev
# → outputs UUID and credentials.json → save to ~/.cloudflared/<UUID>.json

# 4. Create DNS record
cloudflared tunnel route dns openproject-dev app.openproject.example.com
# → creates CNAME → <UUID>.cfargotunnel.com

# 5. Configure → ops/cloudflared/config.yml (see below)

# 6. Run
cloudflared tunnel --config ops/cloudflared/config.yml run openproject-dev
```

### 15.4 `ops/cloudflared/config.yml`

```yaml
# ops/cloudflared/config.yml
tunnel: <UUID>           # tunnel ID from step 3
credentials-file: /home/cwlai/.cloudflared/<UUID>.json

# Metrics for observability
metrics: localhost:2000

# Logging
loglevel: info
logfile: /var/log/cloudflared/openproject.log

# Origin request settings
originRequest:
  connectTimeout: 10s
  noHappyEyeballs: false
  keepAliveConnections: 16
  keepAliveTimeout: 90s
  httpHostHeader: app.openproject.example.com
  originServerName: app.openproject.example.com

ingress:
  # Health endpoint → always serve from cloudflared
  - hostname: app.openproject.example.com
    path: /api/health
    service: http_status:200

  # Main app
  - hostname: app.openproject.example.com
    service: https://app.openproject.example.com
    originRequest:
      noTLSVerify: false
      connectTimeout: 5s
      retryAttempts: 3

  # Staging (optional)
  - hostname: staging.openproject.example.com
    service: https://staging.openproject.example.com

  # Local dev (only for the developer's machine)
  - hostname: dev.openproject.example.com
    service: http://localhost:3000
    originRequest:
      connectTimeout: 30s
      noHappyEyeballs: true

  # Catch-all
  - service: http_status:404
```

For dev tunnels, use **named tunnels** as above. For quick throwaway tunnels: `cloudflared tunnel --url http://localhost:3000` → prints a `*.trycloudflare.com` URL.

### 15.5 `ops/cloudflared/install-service.sh`

```bash
#!/usr/bin/env bash
# ops/cloudflared/install-service.sh — install cloudflared as a systemd service
set -euo pipefail
: "${TUNELDDIR:=/etc/cloudflared}"
: "${TUNNELNAME:=openproject-dev}"

sudo cloudflared service install
sudo mkdir -p "$TUNELDDIR"
sudo cp ops/cloudflared/config.yml "$TUNELDDIR/config.yml"
sudo cp ~/.cloudflared/*.json "$TUNELDDIR/"
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### 15.6 Cloudflare Access (zero-trust gate)

For a private demo, wrap the tunnel URL with **Cloudflare Access**:

1. Cloudflare Zero Trust dashboard → **Access → Applications → Add** → Self-hosted.
2. Application domain: `app.openproject.example.com`.
3. Name: `OpenProject Demo`.
4. Session duration: 24 hours.
5. Application policies:
   - **Policy 1:** Name `Demo viewers`. Action **Allow**. Include:
     - Emails ending in `@openproject.example.com`
     - Emails: `investor1@example.com`, `investor2@example.com` (specific allow-list).
   - **Policy 2:** Name `Catch-all block**. Action **Block**. Everyone.
6. Identity providers: enable **One-time PIN** (email OTP) for guests.
7. Save and copy the **Application Audience (AUD) tag** for the optional JWT validation in the app.

The app can optionally validate the Cloudflare Access JWT in `middleware.ts` to know who's behind the tunnel (set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` env, then verify `Cf-Access-Jwt-Assertion`):

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.CF_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/certs`),
);

export async function verifyCfAccess(req: NextRequest) {
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWKS, {
    audience: process.env.CF_ACCESS_AUD,
    issuer: `https://${process.env.CF_TEAM_DOMAIN}.cloudflareaccess.com`,
  });
  return payload;  // { email, sub, ... }
}
```

### 15.7 Cloudflare WAF + Rate limit rules (production-ready)

In Cloudflare dashboard → Security → WAF → Custom rules:

```
# Rule 1: rate-limit login
(http.request.uri.path eq "/api/auth/callback/credentials")
→ Action: Rate limit, 5 per 60 s per IP, then JS challenge for 10 min

# Rule 2: block bad bots on dashboard
(ip.src in {<known bad bot ranges>})
→ Action: Block

# Rule 3: geo-restrict admin endpoints (optional)
(http.request.uri.path eq "/api/admin/*" and ip.geoip.country ne "HK" and ip.geoip.country ne "TW" and ip.geoip.country ne "JP" and ip.geoip.country ne "SG")
→ Action: Block

# Rule 4: protect against large POST
(http.request.method eq "POST" and http.request.body.size gt 26214400)  # 25 MB
→ Action: Block

# Rule 5: SQLi/XSS via Managed Ruleset (Cloudflare OWASP)
→ Use Cloudflare Managed Ruleset, action: Block, sensitivity: High
```

### 15.8 Local tunnel for development (one-liner)

```bash
# From project root, with the dev server running on :3000
make tunnel
# or
cloudflared tunnel --url http://localhost:3000
# → prints https://<random>.trycloudflare.com
```

`Makefile` target:

```makefile
tunnel:
	@cloudflared tunnel --url http://localhost:3000 2>&1 | tee .tunnel.log
```

`scripts/share-tunnel.sh` (post the URL to Slack):

```bash
#!/usr/bin/env bash
set -euo pipefail
URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' .tunnel.log | head -1)
if [ -z "$URL" ]; then
  echo "Tunnel URL not found"; exit 1
fi
echo "Sharing tunnel URL: $URL"
curl -sS -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \":rocket: Dev tunnel ready: $URL\"}"
```

---

## 16. Concrete Configurations

This section consolidates the canonical config files referenced above.

### 16.1 `vercel.json` (fixed, full)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "regions": ["hkg1"],
  "trailingSlash": false,
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, max-age=0" }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "redirects": [
    { "source": "/home", "destination": "/dashboard", "permanent": true }
  ],
  "crons": [
    { "path": "/api/cron/sla-check", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cleanup-attachments", "schedule": "0 3 * * *" }
  ]
}
```

### 16.2 `railway.toml` (hardened)

```toml
[build]
  builder = "nixpacks"
  buildCommand = "pnpm build"

[deploy]
  region = "hk"
  numInstances = 2
  healthcheckPath = "/api/health"
  healthcheckTimeout = 30
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 5

[env]
  NODE_ENV = "production"

[[deploy.predeploy]]
  command = "pnpm exec prisma migrate deploy"
```

### 16.3 `next.config.js` (full)

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  productionBrowserSourceMaps: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@radix-ui/react-icons'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), sentryConfig);
```

### 16.4 Sentry configs (full)

`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — see §10.1.

`instrumentation.ts` — see §10.1.

### 16.5 Dockerfile + compose (full)

See §5.1 and §5.3.

### 16.6 Cloudflare Tunnel config (full)

See §15.4.

### 16.7 Doppler config example

`doppler.yaml` (in repo root, committed; only references configs, no secrets):

```yaml
setup:
  - file: .env.example
    exclude: true
projects:
  - name: openproject-rewrite
    configs:
      dev:
        environment: dev
      staging:
        environment: staging
      production:
        environment: prd
```

### 16.8 `.env.example` (extended)

```bash
# --- App ---
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# --- Database (Neon) ---
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.aws-ap-southeast-1.neon.tech:5432/openproject?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.aws-ap-southeast-1.neon.tech:5432/openproject?sslmode=require"
SHADOW_DATABASE_URL="postgresql://user:pass@ep-xxx.aws-ap-southeast-1.neon.tech:5432/openproject_shadow?sslmode=require"

# --- Redis (Upstash) ---
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="***"
REDIS_URL="rediss://default:***@xxx.upstash.io:6379"

# --- Auth providers ---
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# --- Sentry ---
SENTRY_DSN="https://xxx@sentry.io/123"
SENTRY_ORG="acme"
SENTRY_PROJECT="openproject-rewrite"
SENTRY_AUTH_TOKEN="***"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/123"
NEXT_PUBLIC_SENTRY_RELEASE=""
NEXT_PUBLIC_ENV=""

# --- Logging ---
BETTER_STACK_SOURCE_TOKEN=""
LOG_LEVEL="info"

# --- Email ---
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="***"
EMAIL_FROM="OpenProject <noreply@openproject.example.com>"

# --- Cloudflare Access (optional) ---
CF_TEAM_DOMAIN="acme"
CF_ACCESS_AUD="xxx"
CF_ACCESS_CLIENT_ID="xxx"
CF_ACCESS_CLIENT_SECRET="***"

# --- Legacy ---
OLD_OPENPROJECT_DATABASE_URL=""
```

### 16.9 Prometheus + Grafana (local observability)

`ops/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: openproject
    metrics_path: /api/metrics
    scheme: https
    static_configs:
      - targets: ['app.openproject.example.com']
    bearer_token: ${METRICS_AUTH_TOKEN}
```

`ops/grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

A pre-built dashboard (JSON in `ops/grafana/dashboards/openproject.json`) covers: RPS, p50/p95/p99 latency, error rate, DB query p95, active users, Sentry error rate, deployment markers.

---

## 17. Cost Estimates

All figures in **USD/month**, list prices, no negotiated discounts. Assumptions per tier below.

### 17.1 1,000 active users / month

| Item | Plan | Cost |
|------|------|------|
| Vercel | Pro (includes 1 TB bandwidth, 1M edge function invocations) | $20 |
| Neon Postgres | Launch (8 GB, autoscaling, PITR 7d) | $70 |
| Upstash Redis | Pay-as-you-go (≈500k commands, 100 MB) | $5 |
| Cloudflare | Pro (WAF, Access for 5 users, Tunnel free) | $20 |
| Sentry | Team (50k errors, 100k transactions, source maps) | $26 |
| Better Stack Logs | Free (5 GB) | $0 |
| Better Uptime | Free (10 monitors) | $0 |
| Doppler | Free (1 user, 3 configs) | $0 |
| GitHub | Team (required for branch protection) | $4 |
| Resend (email) | Free (3k/mo) | $0 |
| **Subtotal** | | **$145** |

### 17.2 10,000 active users / month

| Item | Plan | Cost |
|------|------|------|
| Vercel | Pro (5 TB bandwidth, 10M invocations) | $20 + usage ~$80 = $100 |
| Neon Postgres | Scale (32 GB, PITR 14d) | $170 |
| Upstash Redis | Pay-as-you-go (≈20M commands, 1 GB) | $40 |
| Cloudflare | Pro + add-ons (Workers, R2 minimal) | $25 |
| Sentry | Business (250k errors, 2M transactions, 5 replays) | $80 |
| Better Stack Logs | Hobby (30 GB) | $15 |
| Better Uptime | Pro (50 monitors, 1-min checks) | $20 |
| Doppler | Pro (10 users, 5 configs) | $24 |
| GitHub | Team | $4 |
| Resend | Pro (50k emails) | $20 |
| **Subtotal** | | **$498** |

### 17.3 100,000 active users / month

| Item | Plan | Cost |
|------|------|------|
| Vercel | Enterprise (or Pro with usage caps) | $1,500+ |
| Neon Postgres | Business (64+ GB, PITR 30d, read replica) | $500+ |
| Upstash Redis | Pro (100M commands, 10 GB) | $200+ |
| Cloudflare | Business (more zones, Workers paid, R2) | $250 |
| Sentry | Business (1M errors, 10M transactions) | $300 |
| Better Stack Logs | Pro (200 GB, 90d retention) | $80 |
| Better Uptime | Business (200 monitors, 30s checks) | $80 |
| Doppler | Team (unlimited users) | $50 |
| GitHub | Enterprise | $21 |
| Resend | Scale (500k emails) | $90 |
| Datadog / Grafana Cloud (optional) | Pro | $200 |
| k6 Cloud (optional, distributed load tests) | Pro | $100 |
| S3 backups | Standard-IA + Glacier | $30 |
| Misc (CDN overage, SMS, etc.) | | $50 |
| **Subtotal** | | **~$3,400** |

### 17.4 Sensitivity notes

- **Bandwidth** is the biggest swing factor. If 100k users are heavy (e.g., large attachments), Vercel bandwidth can add $1k+.
- **Database storage** grows linearly with content. Add 1 TB = ~$50/mo on Neon.
- **Observability** scales with traffic and team size. Self-hosted Prometheus + Grafana cuts Better Stack / Sentry costs by ~40% but adds ops burden.
- **Self-hosting everything** (own Postgres, Redis, Vercel alternative) can cut 100k-user cost to ~$1,500/mo on a Hetzner + Cloudflare combo, but adds significant ops time.

### 17.5 Cost guardrails

- **Vercel spend notification** at $100/mo, $500/mo, $2k/mo.
- **Neon spend limit** configured in console.
- **Upstash spend cap** configured in console.
- **Sentry quota alert** at 80% of plan limit.
- Monthly review: `pnpm run cost-report` (custom script reading billing APIs).

---

## 18. Migration Plan from Current Setup

### 18.1 Current state (recap)

- Vercel deploy, `hkg1`, broken `vercel.json` (duplicate `regions`).
- Railway config, no `restartPolicyType`, no `predeploy` for migrations.
- Minimal Sentry init (no source maps, no replay, no profiling, no edge).
- `.env.example` missing Cloudflare, Doppler, Better Stack, Neon URLs.
- No CI, no Docker, no tunnel, no monitoring, no DR docs.
- k6 scripts incomplete (no real auth, no writes, no upload).

### 18.2 Phased migration (5 weeks)

#### Week 1 — Foundations (no behavior change)

- [ ] Fix `vercel.json` (remove duplicate `regions`).
- [ ] Remove `next.config.ts` (dead code) and the `ignoreBuildErrors` + `ignoreDuringBuilds` overrides from `next.config.js`.
- [ ] Add Doppler project + install Doppler CLI in repo.
- [ ] Move all secrets from Vercel project env to Doppler configs (`staging`, `production`).
- [ ] Create Neon project (Singapore region), import current schema, set up PITR 7 days.
- [ ] Set up Upstash Redis (already in deps).
- [ ] Update `.env.example` to new schema.
- [ ] Add `bin/setup` + `Makefile` + `docker-compose.yml`.
- [ ] Add `Dockerfile` (multi-stage).
- [ ] Add `lefthook` + format/lint pre-commit.

#### Week 2 — CI/CD + Observability

- [ ] Create GitHub workflows (`ci.yml`, `e2e.yml`, `lighthouse.yml`, `docker.yml`, `migrate.yml`, `codeql.yml`, `secrets-scan.yml`, `backup.yml`).
- [ ] Enable branch protection on `main` and `develop`, require CODEOWNERS.
- [ ] Wire Sentry: add `SENTRY_AUTH_TOKEN`, replace `instrumentation.ts`, add `sentry.edge.config.ts`, enable source maps via `withSentryConfig`.
- [ ] Add `lib/logger.ts` (pino) + `/api/web-vitals` + `/api/metrics`.
- [ ] Set up Better Stack (free) and Better Uptime (free).
- [ ] Set up Sentry release tagging in CI.
- [ ] Set up Lighthouse CI in CI.
- [ ] Configure Cloudflare (account, zone, DNS).

#### Week 3 — Container + Deploy

- [ ] First GHCR image build from `main`.
- [ ] Test Railway fallback deploy (smoke test from staging).
- [ ] Switch staging Vercel project to pull env from Doppler.
- [ ] Run E2E workflow against a Neon preview branch (one PR, end-to-end).
- [ ] Run lighthouse-pr on a real PR.
- [ ] First `prisma migrate deploy` via GitHub Actions in staging.

#### Week 4 — Tunnel + Load Testing + DR

- [ ] Cloudflare Tunnel: create named tunnel, route DNS, install as service on a small VM.
- [ ] Optional: set up Cloudflare Access for the demo URL.
- [ ] Rewrite k6 `smoke.ts`, `load.ts`, add `stress.ts`, `spike.ts`, `upload.ts`.
- [ ] Run k6 smoke against staging in CI (weekly).
- [ ] Run k6 load manually, capture baseline metrics.
- [ ] Write the DR runbook (docs/dr.md).
- [ ] Test Scenario A (restore from PITR) in staging — record duration.
- [ ] Add status page (Instatus) + Better Uptime integration.
- [ ] Configure Cloudflare WAF + rate limit rules.

#### Week 5 — Hardening + Cutover

- [ ] Enable Sentry profiling + replay.
- [ ] Add 1Password CLI to `bin/setup` as alternative to Doppler.
- [ ] Bundle analyzer in CI; set size limits.
- [ ] Wire Doppler → Vercel integration for production env.
- [ ] **Production cutover:**
  1. Snapshot current prod DB.
  2. Provision Neon prod project from dump.
  3. Set Vercel env to Neon + Upstash URLs (via Doppler).
  4. Run `prisma migrate deploy` against prod DB.
  5. Deploy to Vercel prod.
  6. Switch Cloudflare DNS to tunnel.
  7. Verify `/api/health`, synthetic monitor, error rate, Sentry.
  8. Monitor for 24 h.
- [ ] Postmortem on cutover, write up the new system in `docs/`.
- [ ] Decommission Railway (or keep as cold DR).

### 18.3 Rollback plan for cutover

If anything goes wrong during cutover:

1. Revert Cloudflare DNS to the previous A/CNAME (1-min TTL).
2. Vercel: `vercel rollback` to previous deployment.
3. Neon: keep the new project but switch `DATABASE_URL` back to the old one.
4. Open incident, communicate, postmortem.

DNS TTL is 60 s — rollback is fast.

### 18.4 Pre-cutover checklist

- [ ] All secrets rotated and stored in Doppler.
- [ ] Branch protection enabled and enforced for one full sprint.
- [ ] All CI workflows green for one full week.
- [ ] Lighthouse CI passing for one week.
- [ ] Synthetic monitor running 24 h without a false positive.
- [ ] DR drill executed in staging.
- [ ] Status page live.
- [ ] On-call rotation staffed.
- [ ] Customer comms drafted.
- [ ] Rollback plan rehearsed.

---

## 19. Operational Runbooks

### 19.1 "The app is down"

1. Check Vercel status (status.vercel.com).
2. Check Neon status (neonstatus.com).
3. Check Cloudflare status (cloudflarestatus.com).
4. Run synthetic check manually.
5. `curl -v https://app.openproject.example.com/api/health` — examine response.
6. Check Sentry for error spike.
7. Check Better Stack for error logs.
8. Check Vercel function logs (`vercel logs --prod` or dashboard).
9. If DB unreachable: check Neon console → restart / failover.
10. If Vercel deploy broken: `vercel rollback`.
11. Communicate in `#inc-YYYY-MM-DD`.
12. Postmortem.

### 19.2 "Sentry alert"

1. Open the Sentry issue.
2. Triage: is it a regression from a recent deploy? → check `release` tag.
3. If yes, `vercel rollback` to last good release.
4. If no, check if it's a third-party outage (DB, Redis, S3, OAuth provider).
5. Capture a breadcrumb from a user via Sentry Replay.
6. Open a PR with the fix.
7. Mark as resolved once deployed.

### 19.3 "Database migration failed"

1. Vercel did not deploy → no customer impact.
2. Check `migrate-prod` job logs in GitHub Actions.
3. If `migration failed to apply`: connect via `psql $DIRECT_URL`, inspect `SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;`.
4. Decide: `prisma migrate resolve --applied` or `--rolled-back`.
5. Fix the migration, commit, push → re-run workflow.
6. If customers impacted: open incident, follow DB restore runbook (§14.3).

### 19.4 "Upstash Redis is unreachable"

1. Check Upstash status.
2. The app should degrade gracefully (cache miss is not a hard failure). Verify by checking error rate.
3. If errors, check whether the rate-limiters are crashing (pino logs at `error` level).
4. Bypass rate limit by setting `RATELIMIT_DISABLED=true` in Vercel env (last resort).
5. Wait for Upstash to recover.

### 19.5 "Cloudflare Tunnel down"

1. Check tunnel status: `cloudflared tunnel info openproject-dev`.
2. SSH to the tunnel host: `systemctl status cloudflared`.
3. Restart: `sudo systemctl restart cloudflared`.
4. Verify: `curl https://app.openproject.example.com/api/health`.
5. If the host is down, bring it up. The tunnel is outbound-only so the host must run `cloudflared`.

### 19.6 "Need to rotate a secret"

1. Doppler → select config → edit secret → save (auto-syncs to Vercel).
2. For GitHub Actions secrets, update in repo settings.
3. Trigger a no-op deploy to ensure the new env is loaded.
4. For DB credentials, rotate in Neon console → update in Doppler.
5. Audit any use of the old credential in Sentry / Better Stack.

### 19.7 "Need to scale Vercel"

1. Add Vercel spend notification at $X.
2. If hitting concurrency limits, request limit increase from Vercel.
3. If CPU-bound, enable Vercel Edge Middleware caching for read APIs (§11.8).
4. If DB-bound, increase Neon compute (Scale plan).

---

## 20. Appendices

### Appendix A — Tech stack alignment

This DevOps design assumes and depends on the following existing tech choices (from `AGENTS.md` and `package.json`):

- Next.js 15.5.15 (Pages Router, `output: 'standalone'`).
- Prisma 7.7.0 + PostgreSQL.
- NextAuth.js v4 (with Credentials + OAuth providers).
- Tailwind CSS v4.
- Vitest 4.1.4, Playwright 1.59.1.
- `@upstash/redis` + `@upstash/ratelimit` (serverless Redis).
- `prom-client` (metrics).
- `@sentry/nextjs` 8.55 (errors, performance).
- `@next/bundle-analyzer` (bundle analysis).

No changes to those libraries are required. New dev dependencies added by this design:

```json
{
  "devDependencies": {
    "@faker-js/faker": "^9.0.0",
    "dotenv-cli": "^7.4.0",
    "lefthook": "^1.7.0",
    "@lhci/cli": "^0.14.0",
    "@size-limit/preset-app": "^11.0.0",
    "size-limit": "^11.0.0",
    "@playwright/test": "^1.59.1"
  },
  "dependencies": {
    "pino": "^9.4.0",
    "pino-pretty": "^11.2.0",
    "@logtail/node": "^0.5.0",
    "@logtail/pino": "^0.5.0",
    "jose": "^5.6.0",
    "next-bundle-analyzer-...wrap": "...",
    "@sentry/profiling-node": "^8.55.0"
  }
}
```

`@playwright/test` may already be transitively installed via `playwright`; verify and pin.

### Appendix B — SLO document

| Service Level Indicator | Target | Error budget / 30 d |
|-------------------------|--------|---------------------|
| API availability (successful responses / total) | 99.9 % | 43 min 50 s |
| API latency (GET p95) | < 200 ms | 1 % of requests |
| API latency (writes p95) | < 500 ms | 1 % of requests |
| Login success rate | > 99 % | 1 % of logins |
| Synthetic check success | > 99.5 % | 3.6 h |
| Sentry error rate | < 0.1 % of requests | 1 per 1000 |
| Backup success | 100 % of nights | 0 misses |

### Appendix C — Tagging and naming conventions

- **Git tags:** `vMAJOR.MINOR.PATCH` (semver). Sentry releases match.
- **Vercel aliases:** `production`, `staging`, `preview`.
- **Neon branches:** `main`, `staging`, `preview/pr-N`, `release/vX.Y`.
- **Sentry environments:** `production`, `staging`, `preview`.
- **Cloudflare tunnels:** `openproject-prod`, `openproject-staging`, `openproject-dev`.
- **Log fields:** `service`, `env`, `region`, `revision`, `reqId`, `userId`, `route`.

### Appendix D — Useful commands cheat sheet

```bash
# One-time
bin/setup

# Daily
make dev          # start dev server
make test         # run unit tests
make e2e          # run e2e
make db-studio    # open Prisma Studio

# Debug
make logs         # tail app logs
make logs-db      # tail DB logs

# Load test
STAGING_URL=https://staging.openproject.example.com \
  TEST_USER=smoke@example.com \
  TEST_PASSWORD=*** \
  k6 run k6/scenarios/smoke.ts

# Tunnel
make tunnel       # share local dev via Cloudflare

# Migrations
make db-migrate
make db-reset

# Backup
bash scripts/backup-postgres.sh

# Deploy (auto on main; manual below)
gh workflow run migrate.yml
gh workflow run k6-load.yml
```

### Appendix E — Reading list

- Vercel docs: https://vercel.com/docs
- Neon docs: https://neon.tech/docs
- Upstash docs: https://docs.upstash.com
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Cloudflare Access: https://developers.cloudflare.com/cloudflare-one/policies/access/
- Sentry Next.js: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- k6: https://k6.io/docs
- Prisma migrations: https://www.prisma.io/docs/orm/prisma-migrate
- Doppler: https://docs.doppler.com
- Pino: https://getpino.io
- Next.js standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output

### Appendix F — What this document deliberately does NOT do

- Does not write a brand-new monitoring stack from scratch — uses Sentry (already in deps) + Better Stack + Better Uptime.
- Does not change the data model (covered in `04-database-schema.md`).
- Does not pick a different frontend framework (covered in `02-frontend-architecture.md`).
- Does not change the auth model (covered in `05-security.md`).
- Does not redesign the API (covered in `03-backend-api.md`).
- Does not propose Kubernetes — overkill for the current scale.
- Does not propose a service mesh (Linkerd/Istio) — unnecessary.
- Does not implement the actual Cloudflare Access JWT verification in the app — only the integration point is documented; implementation is a 1-PR follow-up.
- Does not implement WebAuthn flow details — the deps are in place (`@simplewebauthn/*`) and Phase 5/6 work handles it.

### Appendix G — Open questions for stakeholders

1. **Domain ownership** for `openproject.example.com` — is the DNS in Cloudflare already?
2. **Doppler vs 1Password** — which secrets manager does the team prefer? (Recommendation: Doppler as source of truth, 1Password for local-only.)
3. **Status page** — Instatus (free) or self-hosted (Caddy + Uptime Kuma)?
4. **On-call** — PagerDuty (paid) or OpsGenie or just Slack-only rotation for v1?
5. **AI features** — if added, will they run on Vercel AI Gateway or external (OpenAI/Anthropic)? Adds a cost line.
6. **Multi-tenancy** — does OpenProject Rewrite stay single-tenant, or do we need tenant isolation? Impacts DB role design.
7. **GDPR / data residency** — what are the constraints for EU users?
8. **Email provider** — Resend is recommended; verify the team is OK.
9. **Custom domain for status page** — `status.openproject.example.com` is the recommendation.
10. **Do we self-host backups to a different region / different cloud** (S3 in ap-southeast-1 vs S3 in us-east-1) for geographic resilience?

---

## Sign-off

- **Author:** Senior DevOps + SRE
- **Reviewers:** Backend lead, Frontend lead, Security lead, Product owner
- **Implementation owner:** DevOps
- **Estimated implementation effort:** 5 weeks (1 senior engineer)
- **Estimated ongoing effort:** ~0.25 FTE for SRE + ~0.1 FTE for on-call rotation
- **Status:** Design complete, ready for review

---

*End of 07-devops.md*
