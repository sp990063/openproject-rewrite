# OpenProject Rewrite v2 — Master Specification

**Version:** 2.0
**Status:** Approved for implementation
**Audience:** Engineering, Product, Design, Security, DevOps
**Last updated:** 2026-06-06
**Author:** Lead Architect (synthesized from 10 expert design documents)
**Project location:** `/home/cwlai/openproject-rewrite`

---

## Document Map

This master spec synthesizes the following expert documents. Where a section expands on a topic, you will see a back-link like `→ see [02-frontend-architecture.md §5](#appendix-quick-reference-index)` so engineers can jump to the source for full detail.

| # | Source | Authority |
|---|--------|-----------|
| 01 | `01-uiux-design.md` | UI/UX, design tokens, wireframes (52 pages) |
| 02 | `02-frontend-architecture.md` | React/Next.js patterns, state, routing |
| 03 | `03-backend-api.md` | REST + tRPC, RBAC, validation, errors |
| 04 | `04-database-schema.md` | Prisma 7, RLS, soft delete, audit, FTS |
| 05 | `05-security.md` | Auth, RBAC+ABAC, OWASP, threat model |
| 06 | `06-realtime.md` | SSE + WebSocket hybrid, presence, outbox |
| 07 | `07-devops.md` | CI/CD, Vercel, Neon, Upstash, monitoring |
| 08 | `08-testing.md` | Vitest + RTL + Playwright, mutation, k6 |
| 09 | `09-performance.md` | Core Web Vitals, caching, indexes, k6 |
| 10 | `10-workflow-features.md` | **NOT PRODUCED** — features folded into this spec where they intersect design decisions (see §21 Open Questions) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Principles](#2-vision--principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack — Add / Keep / Remove](#4-tech-stack--add--keep--remove)
5. [Priority Matrix (P0–P3 across 9 docs)](#5-priority-matrix-p0p3-across-9-docs)
6. [Implementation Phases (overview)](#6-implementation-phases-overview)
7. [Phase 0 — Critical Fixes (Week 1)](#7-phase-0--critical-fixes-week-1)
8. [Phase 1 — Foundation (Weeks 2–4)](#8-phase-1--foundation-weeks-24)
9. [Phase 2 — Core Features (Weeks 5–8)](#9-phase-2--core-features-weeks-58)
10. [Phase 3 — Collaboration (Weeks 9–10)](#10-phase-3--collaboration-weeks-910)
11. [Phase 4 — Performance (Weeks 11–12)](#11-phase-4--performance-weeks-1112)
12. [Phase 5 — DevOps & Reliability (Weeks 13–14)](#12-phase-5--devops--reliability-weeks-1314)
13. [Phase 6 — Polish, A11y, Hardening (Weeks 15–16)](#13-phase-6--polish-a11y-hardening-weeks-1516)
14. [Cross-Cutting Concerns](#14-cross-cutting-concerns)
15. [Risk Register (top 20)](#15-risk-register-top-20)
16. [Success Metrics / KPIs](#16-success-metrics--kpis)
17. [Migration Strategy — Zero-Downtime, Feature Flags, Canary](#17-migration-strategy--zero-downtime-feature-flags-canary)
18. [Dependency Graph](#18-dependency-graph)
19. [Team Structure & Parallel Workstreams](#19-team-structure--parallel-workstreams)
20. [Open Questions](#20-open-questions)
21. [Appendix A — Quick Reference Index](#appendix-a-quick-reference-index)
22. [Appendix B — Acceptance Criteria per Phase](#appendix-b--acceptance-criteria-per-phase)

---

## 1. Executive Summary

### 1.1 What we are building

A **production-grade, real-time, density-aware rewrite of OpenProject** in Next.js 15 (Pages Router) on top of Prisma 7 / PostgreSQL 16, with first-class support for:

- **Work packages** at scale (1 000+ rows, 50+ projects per user) with virtualized tables, Gantt, Calendar, and Board views.
- **Realtime collaboration** via a hybrid SSE + WebSocket transport, with presence, typing, and live WP updates.
- **Enterprise security**: NextAuth.js v5 with MFA, RBAC + ABAC, optional SAML/LDAP, OWASP-hardened API surface, and per-route audit logging.
- **A modern design system** (Indigo primary, calm palette, 32-px row density, dark mode, WCAG 2.1 AA).
- **Operational maturity**: Vercel + Neon + Upstash, Sentry, structured logs, Prometheus, k6 load suite, canary deploys.

### 1.2 Why we are doing it

The current `openproject-rewrite` codebase (56 Prisma models, 14+ top-level pages, 11+ top-level API directories) is **functionally broad but operationally fragile**:

- **5 critical security findings** (1-arg `getServerSession` ambiguity, missing API auth wrapper, no security headers, LDAP injection, WebAuthn challenge loss) — see [05-security.md §3](#appendix-a-quick-reference-index).
- **N+1 hot paths** on the work-package list and project member resolver.
- **No materialized views or covering indexes** for the top 3 query patterns.
- **No realtime**, despite a partial `pages/api/sse.ts` stub.
- **Inconsistent design** — ad-hoc colors, no token system, no dark mode.
- **No CI pipeline**, no canary, no SLOs.

The 9 expert documents (and the work-in-progress #10) collectively identify **~220 distinct deliverables**. The job of this master spec is to **sequence, prioritize, and resolve conflicts** so that a 6-engineer team can ship the rewrite in 16 weeks with a clear, week-by-week plan.

### 1.3 Headline metrics (target end-state)

| Metric | Today (baseline) | Target (end of Phase 6) | Source |
|---|---|---|---|
| LCP p75 (work-package list) | ~3.4 s | **< 2.0 s** | [09-performance §2.4](#appendix-a-quick-reference-index) |
| INP p75 | unmeasured | **< 100 ms** | [09-performance §3.1](#appendix-a-quick-reference-index) |
| API p95 (WP list) | ~180 ms | **< 60 ms** | [09 §2.2](#appendix-a-quick-reference-index), [04 §11.3](#appendix-a-quick-reference-index) |
| Lighthouse perf | unmeasured | **≥ 90** | [09 §2.1](#appendix-a-quick-reference-index) |
| Test coverage (line) | < 30 % (gaps) | **≥ 70 %** | [08 §3.2](#appendix-a-quick-reference-index) |
| Critical CVEs open | 5 | **0** | [05 §3](#appendix-a-quick-reference-index) |
| Uptime (90-day rolling) | unmeasured | **≥ 99.9 %** | [07 §10](#appendix-a-quick-reference-index) |
| Build time (CI) | unmeasured | **< 6 min** | [07 §4.2](#appendix-a-quick-reference-index) |
| Bundle per route (gz) | ~unknown, suspected > 400 KB | **< 250 KB** | [09 §3.2](#appendix-a-quick-reference-index) |
| Cost / 1 000 DAU | unknown | **$500–700 / mo** | [09 §19.11](#appendix-a-quick-reference-index) |

### 1.4 What is NOT in scope for v2

- **Mobile native apps** — PWA-only.
- **Gantt PDF export** — deferred to v2.1.
- **AI-assisted scheduling** — deferred to v2.1.
- **Custom field plugin SDK** — closed schema in v2; SDK in v3.
- **Multi-region active/active** — single primary region, Cloudflare edge cache.

---

## 2. Vision & Principles

### 2.1 Product vision (from [01-uiux §1.1](#appendix-a-quick-reference-index))

> OpenProject Rewrite is a **modern, opinionated, density-aware project management tool** that respects the data-heavy reality of PM work (hundreds of work packages, dozens of projects, multi-week Gantt horizons) without feeling like a 2010-era enterprise tool.

### 2.2 The 7 non-negotiables

These are the cross-cutting principles that survive any conflict between expert docs. **If a downstream decision violates one of these, it is the decision that is wrong.**

| # | Non-negotiable | Why |
|---|----------------|-----|
| **N1** | **Security headers on every response** (CSP, HSTS, X-CTO, X-Frame-Options, Referrer-Policy, Permissions-Policy) | OWASP A05. The 9-doc audit lists this as Critical #3. |
| **N2** | **Default-deny authorization** — every API route is wrapped in `withApiAuth(...)` and explicitly opts into public access. | [05 §3 Critical #2](#appendix-a-quick-reference-index). The current code is auth-by-happy-path. |
| **N3** | **Validate every input with Zod** at the API boundary; never trust the client. | [03 §10](#appendix-a-quick-reference-index), [05 §8.1](#appendix-a-quick-reference-index). |
| **N4** | **Density is a feature** — 32-px rows, 48-px toolbars, 240-px sidebar, real data, no fluffy empty states. | [01 §1.2](#appendix-a-quick-reference-index). |
| **N5** | **The page must never blank** — skeletons in < 200 ms, optimistic UI for mutations, SSE for live updates. | [01 §1.2](#appendix-a-quick-reference-index), [06 §1](#appendix-a-quick-reference-index). |
| **N6** | **Logs are structured (JSON), secrets are env-injected, errors are Sentry-captured, and we never log PII or JWTs.** | [05 §7.4](#appendix-a-quick-reference-index), [07 §10.2](#appendix-a-quick-reference-index). |
| **N7** | **Pages Router only** (we are explicitly NOT migrating to App Router in v2). | Per `AGENTS.md` — this is a project-wide convention. |

### 2.3 Anti-patterns we explicitly reject

From [01 §1.3](#appendix-a-quick-reference-index) + additions from the engineering docs:

- Modal-only "drawer-everything" SaaS layouts
- Rainbow status pills (Status: 🟣🟢🟡🔴)
- Pagination when infinite scroll or virtualization fits
- Spinners in place of skeletons for known-shape content
- `any` in TypeScript without a tracked justification (`// @allow-any: ...`)
- `getServerSession(...)` called with a single argument anywhere in `pages/api/`
- Direct `prisma.*` calls in `getServerSideProps` (must go through `services/`)
- Magic numbers in components (must be design tokens)
- Coverage-theater tests that mock the entire unit under test

### 2.4 Conflict resolution rules

When two expert docs disagree, the **decision tree** is:

1. **Security wins over performance** (N1–N3 > N4–N5).
2. **Security wins over UX** (a leaky button is worse than a missing one).
3. **Performance wins over developer ergonomics** (we virtualize, even if the code is less elegant).
4. **Data integrity wins over both** (correctness before speed before beauty).
5. **When still tied**, choose the option that is **smaller in diff size** and **easier to revert**.

The §5 priority matrix applies this rule consistently.

---

## 3. Architecture Overview

### 3.1 Layered architecture (Mermaid)

```mermaid
flowchart TB
  subgraph Client["Client (Browser)"]
    direction TB
    UI["React 18 + Next.js Pages Router<br/>Radix UI + Tailwind v4 + lucide-react"]
    State["Zustand (UI) + TanStack Query (server) + nuqs (URL)"]
    RTClient["SSE EventSource (work-package, notification, presence)<br/>WebSocket (typing, cursor, voice)"]
  end

  subgraph Edge["Edge / Vercel / Cloudflare"]
    CDN["CDN cache (Vercel Edge Network)<br/>stale-while-revalidate"]
    MW["middleware.ts<br/>CSRF · CSP nonce · rate-limit (Upstash) · auth redirect"]
  end

  subgraph App["Next.js App (Node 20, /pages)"]
    direction TB
    Pages["pages/ (getServerSideProps + Client Components)"]
    API["pages/api/v1/... (REST primary)<br/>pages/api/trpc/[trpc].ts (internal tRPC)"]
    Auth["lib/auth.ts (NextAuth v5)<br/>withApiAuth, withAuth, withRole"]
    Svc["services/ (domain logic, transaction boundaries)"]
    Repos["repositories/ (Prisma queries, includes, DataLoader)"]
    Validators["validators/ (Zod schemas)"]
    RBAC["lib/access/ (PDP: RBAC + ABAC)"]
  end

  subgraph RT["Realtime Plane"]
    direction TB
    Bus["lib/realtime/bus.ts (in-process EventEmitter + outbox writer)"]
    SSE["pages/api/v1/sse.ts (SSE handler)"]
    WS["pages/api/v1/ws.ts (WebSocket via ws)"]
    PubSub["Redis Pub/Sub (Upstash)"]
  end

  subgraph Data["Data Plane"]
    direction TB
    PG[("PostgreSQL 16 (Neon)<br/>Prisma 7 · 56 models · RLS · FTS · mat-views")]
    Cache[("Redis (Upstash)<br/>session · rate-limit · presence · pub/sub")]
    S3[("S3-compatible (R2)<br/>attachments · avatars · exports")]
  end

  subgraph Obs["Observability"]
    direction TB
    Sentry["Sentry (errors, perf, replays, profiles)"]
    Prom["Prometheus (custom /metrics)"]
    Log["Structured JSON → Logflare / Loki"]
  end

  UI <-->|HTTPS| MW
  MW <--> Pages
  MW <--> API
  RTClient <-->|EventSource / WS| SSE
  RTClient <-->|WS| WS
  Pages --> State
  API --> Auth
  API --> Validators
  API --> RBAC
  API --> Svc
  Svc --> Repos
  Svc --> Bus
  Repos --> PG
  Bus --> PubSub
  SSE <--> PubSub
  WS <--> PubSub
  PubSub --> Cache
  Auth --> PG
  RBAC --> PG
  API --> Cache
  Pages --> Cache
  S3 --> API
  API --> Sentry
  Bus --> Sentry
  Pages --> Sentry
  App --> Prom
  App --> Log
```

### 3.2 Domain boundaries (DDD-lite)

```
src/
  domains/
    work-packages/        # WP, type, status, priority, journal
    projects/             # Project, member, role, version
    users/                # User, identity, group, session
    notifications/        # Notification + preferences
    collaboration/        # Comments, mentions, attachments
    reporting/            # Materialized views + aggregations
    admin/                # Settings, custom fields, enumerations
  shared/
    rbac/                 # Permission Decision Point
    realtime/             # Event bus, channels, presence
    audit/                # AuditLog writer
    infra/                # Prisma, Redis, S3, Sentry clients
```

This structure coexists with the `pages/` and `services/` directories used in the current repo (per [02-frontend §4.1](#appendix-a-quick-reference-index)); see §8 Phase 1 for the migration plan.

### 3.3 Request lifecycle (canonical)

```
Browser
  │
  ▼
middleware.ts ──► (CSRF, CSP-nonce, rate-limit via Upstash, auth-redirect)
  │
  ▼
pages/api/v1/... (or pages/... for SSR pages)
  │
  ├─► withApiAuth(handler)         ← [05 §3 Critical #2]
  │     │
  │     ├─► Zod parse (request body / query / params)   ← [03 §10]
  │     ├─► PDP check (rbac.can(user, action, resource)) ← [05 §5.5]
  │     ├─► service.*(...) (transactional)              ← [02 §4.3]
  │     │     └─► repository.* (Prisma, with includes + DataLoader)
  │     │     └─► outbox.publish(...)                   ← [06 §8.5]
  │     ├─► res.setHeader(...) security headers          ← [05 §3 Critical #3]
  │     └─► response (envelope v1)                       ← [03 §6]
  │
  └─► Sentry.captureException on throw
       Logflare.info({ route, userId, latencyMs, statusCode })
```

---

## 4. Tech Stack — Add / Keep / Remove

### 4.1 Stays (current `package.json` is broadly correct)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15.5.15** (Pages Router) | Per `AGENTS.md` and 9-doc consensus. |
| ORM | **Prisma 7.7.0** + `@prisma/adapter-pg` | Already adopted; 56 models. |
| DB | **PostgreSQL 16** (Neon) | RLS, FTS, BRIN, generated columns, mat-views. |
| Auth | **NextAuth.js v5 (beta)** + `@auth/prisma-adapter` | Existing investment; community. |
| State | **Zustand 5** + **TanStack Query 5** | Per [02 §6](#appendix-a-quick-reference-index). |
| UI primitives | **Radix UI** + **Tailwind CSS v4** | Per [01 §15](#appendix-a-quick-reference-index). |
| Icons | **lucide-react** | Per [01 §7.1](#appendix-a-quick-reference-index). |
| Tests | **Vitest 4** + **Testing Library** + **Playwright** | Per [08 §4–§7](#appendix-a-quick-reference-index). |
| DnD | **@dnd-kit/core** + sortable + utilities | Already in `package.json`. |
| Observability | **Sentry** (`@sentry/nextjs`) | Already wired (client + server config). |
| Bundle | **`@next/bundle-analyzer`** | Already in deps. |
| Storage | **S3** (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) | Keep. |
| Lint | **ESLint** | Keep. |

### 4.2 Adds (new dependencies)

| Package | Purpose | Source |
|---|---|---|
| `zod` | Request validation (already present) | [03 §10](#appendix-a-quick-reference-index) |
| `react-hook-form` + `@hookform/resolvers` | Form state | [02 §6.5](#appendix-a-quick-reference-index) |
| `nuqs` | URL state (filters, search, pagination) | [02 §6.4](#appendix-a-quick-reference-index) |
| `react-virtual` (or `@tanstack/react-virtual`) | Virtualized table | [09 §3.5 / §9.5](#appendix-a-quick-reference-index) |
| `dataloader` | Batching for N+1 | [09 §4.2](#appendix-a-quick-reference-index) |
| `ws` | WebSocket server (Pages Router) | [06 §4.1](#appendix-a-quick-reference-index) |
| `@upstash/ratelimit` + `@upstash/redis` | Edge rate limit + pub/sub | [05 §6.1](#appendix-a-quick-reference-index), [06 §7](#appendix-a-quick-reference-index) |
| `argon2` (or `bcrypt` if node-only) | Password hashing | [05 §4.2](#appendix-a-quick-reference-index) |
| `@simplewebauthn/server` + `@simplewebauthn/browser` | WebAuthn MFA | [05 §4.3](#appendix-a-quick-reference-index) |
| `dompurify` + `isomorphic-dompurify` | Rich text XSS guard | [05 §8.2](#appendix-a-quick-reference-index) |
| `pino` + `pino-pretty` (dev) | Structured logging | [07 §10.2](#appendix-a-quick-reference-index) |
| `prom-client` | `/metrics` | [07 §10.3](#appendix-a-quick-reference-index) |
| `k6` (binary, not npm) | Load test runner | [09 §13 / 09 App.A.3](#appendix-a-quick-reference-index) |
| `@stryker-mutator/*` | Mutation testing | [08 §3.4](#appendix-a-quick-reference-index) |
| `msw` | Hook-level HTTP mocking | [08 §6.2](#appendix-a-quick-reference-index) |
| `@faker-js/faker` | Test data factories | [08 §8.3](#appendix-a-quick-reference-index) |
| `unleash-client` (or `flagsmith`) | Feature flags | [17 §17.3](#appendix-a-quick-reference-index) — to confirm in Open Q |
| `next-secure` (or hand-rolled `lib/security-headers.ts`) | CSP, HSTS, etc. | [05 §6.3](#appendix-a-quick-reference-index) |

### 4.3 Removes / downgrades

| Package | Reason | Source |
|---|---|---|
| `axios` (if used) | Replace with native `fetch` (Node 20) | [02 §7.3](#appendix-a-quick-reference-index) |
| `moment` (if used) | Use `date-fns` or `Temporal` polyfill | audit not in 9 docs, but recommended |
| `lodash` (full) | Import `lodash-es` or per-method | [09 §3.5](#appendix-a-quick-reference-index) |
| `socket.io` | Not used in current code; SSE+WS hybrid is enough | [06 §4.4](#appendix-a-quick-reference-index) |
| Any App-Router patterns | Pages Router only (N7) | `AGENTS.md` |

### 4.4 Versions pinned (target)

```
next            15.5.15
react           18.3.1
typescript      5.5.x
prisma          7.7.0
@prisma/client  7.7.0
next-auth       5.0.0-beta.25
zod             3.23.x
zustand         5.0.12
@tanstack/react-query 5.99.0
@tanstack/react-virtual 3.x
tailwindcss     4.0.x
```

---

## 5. Priority Matrix (P0–P3 across 9 docs)

**P0 = ship-blocker for v2 launch (must be in Phase 0–1)**
**P1 = v2 launch requirement (Phase 2–4)**
**P2 = v2.1 (deferable but planned)**
**P3 = nice-to-have / future**

This matrix is the **single source of truth** for what goes in which sprint. Items are deduplicated across docs and grouped by theme. Total: **220 items** (matching the spec's stated 200+).

### 5.1 P0 — Must ship for v2 (62 items)

| # | Item | Source doc / § | Owner workstream |
|---|---|---|---|
| **SEC-1** | Replace 1-arg `getServerSession` callsites with `await getServerSession(req, res)` or `auth()` | [05 §3 #1](#appendix-a-quick-reference-index) | Security |
| **SEC-2** | Add global `withApiAuth(handler)` wrapper, apply to all `pages/api/**` | [05 §3 #2](#appendix-a-quick-reference-index) | Security |
| **SEC-3** | Security response headers (CSP, HSTS, X-CTO, X-Frame-Options, Referrer-Policy, Permissions-Policy) on every response | [05 §3 #3](#appendix-a-quick-reference-index) | Security |
| **SEC-4** | Fix LDAP injection in `lib/ldap/client.ts` (escape DN/filter) | [05 §3 #4](#appendix-a-quick-reference-index) | Security |
| **SEC-5** | Persist WebAuthn challenges in Redis with 5-min TTL | [05 §3 #5](#appendix-a-quick-reference-index) | Security |
| **SEC-6** | Default-deny PDP in `lib/access/`; require explicit `allow` for every protected route | [05 §5.5](#appendix-a-quick-reference-index) | Security |
| **SEC-7** | Zod validation on ALL `pages/api/**` body/query/params | [05 §8.1](#appendix-a-quick-reference-index), [03 §10](#appendix-a-quick-reference-index) | Backend |
| **SEC-8** | Rate limit on `/api/auth/*` and `/api/v1/work-packages/*` (Upstash) | [05 §6.1](#appendix-a-quick-reference-index) | Backend |
| **SEC-9** | Strict CORS allowlist (no wildcard) | [05 §6.2](#appendix-a-quick-reference-index) | Backend |
| **SEC-10** | CSRF tokens on all state-changing requests | [05 §8.5](#appendix-a-quick-reference-index) | Security |
| **SEC-11** | DOMPurify for all rich text fields (comments, WP description) | [05 §8.2](#appendix-a-quick-reference-index) | Frontend |
| **SEC-12** | API token storage hashed (argon2id), not plain | [05 §7.3](#appendix-a-quick-reference-index) | Backend |
| **DB-1** | Add `deleted_at` + soft-delete Prisma middleware on 7 hot tables | [04 §5.3](#appendix-a-quick-reference-index) | Backend |
| **DB-2** | Covering index on `work_packages(project_id, status_id, updated_at DESC) INCLUDE (assignee_id, type_id, priority_id)` | [04 §11](#appendix-a-quick-reference-index), [09 App.A.4 #1](#appendix-a-quick-reference-index) | Backend |
| **DB-3** | Partial index `work_packages(assignee_id, status_id) WHERE deleted_at IS NULL AND status_id NOT IN (closed)` | [09 App.A.4 #2](#appendix-a-quick-reference-index) | Backend |
| **DB-4** | RLS policies on `work_packages`, `projects`, `members`, `notifications` | [04 §4.3](#appendix-a-quick-reference-index) | Backend |
| **DB-5** | `AuditLog` table + Prisma middleware that writes a row on every mutation of audited tables | [04 §6.2](#appendix-a-quick-reference-index) | Backend |
| **DB-6** | PostgreSQL enums for `WorkPackageStatus`, `ProjectStatus` (migrate from string) | [04 §9.2](#appendix-a-quick-reference-index) | Backend |
| **DB-7** | GIN trigram index on `work_packages.subject)` for `%foo%` searches | [09 App.A.4 #5](#appendix-a-quick-reference-index) | Backend |
| **API-1** | REST primary, tRPC internal boundary (final decision) | [03 §3.2](#appendix-a-quick-reference-index) | Backend |
| **API-2** | v1 response envelope `{ data, meta?, error? }` for all endpoints | [03 §6.1](#appendix-a-quick-reference-index) | Backend |
| **API-3** | `idempotency-key` header support for POST/PATCH/DELETE | [03 §5.2](#appendix-a-quick-reference-index), [05 §6.5](#appendix-a-quick-reference-index) | Backend |
| **API-4** | `withApiAuth` + `withRole` + `withJson` higher-order functions exported from `lib/api/` | [03 §8](#appendix-a-quick-reference-index) | Backend |
| **API-5** | `If-Match` (ETag) on `pages/api/v1/work-packages/[id].ts` (optimistic concurrency) | [03 §5.4](#appendix-a-quick-reference-index) | Backend |
| **FE-1** | Fix all 1-arg `getServerSession` in `pages/api/**` and convert to `withApiAuth` | [05 §3 #1–2](#appendix-a-quick-reference-index) | Frontend |
| **FE-2** | Move from `pages/` + ad-hoc `services/` to `src/domains/` + co-located components | [02 §4.1](#appendix-a-quick-reference-index) | Frontend |
| **FE-3** | Sliced Zustand stores (`useUiStore`, `useWorkPackageFilterStore`, `usePresenceStore`) | [02 §6.3](#appendix-a-quick-reference-index) | Frontend |
| **FE-4** | `nuqs` for all filter / pagination / sort state in WP list | [02 §6.4](#appendix-a-quick-reference-index) | Frontend |
| **FE-5** | TanStack Query `staleTime: 30s`, `gcTime: 5m` defaults; query keys = `[domain, verb, params]` | [02 §6.2](#appendix-a-quick-reference-index) | Frontend |
| **FE-6** | React Hook Form + Zod resolver for all forms | [02 §6.5](#appendix-a-quick-reference-index) | Frontend |
| **FE-7** | `middleware.ts` auth redirect + CSP nonce + rate-limit pre-check | [05 §3 #3](#appendix-a-quick-reference-index), [02 §8.4](#appendix-a-quick-reference-index) | Frontend |
| **FE-8** | `RoleGate` component for client-side defensive rendering | [02 §8.5](#appendix-a-quick-reference-index) | Frontend |
| **UX-1** | Design tokens (`styles/tokens.css` + Tailwind v4 `@theme inline`) — 88 color + 6 surface + 6 text + 6 border + 7 text + 5 line-height + 9 space + 5 radius + 5 shadow + 4 duration + 8 z-index | [01 §2](#appendix-a-quick-reference-index) | Design |
| **UX-2** | Tailwind v4 migration to `@theme inline` block, no `tailwind.config.ts` colors | [01 §15](#appendix-a-quick-reference-index) | Design |
| **UX-3** | 32-px row height, 48-px toolbar, 240/64-px sidebar enforced via tokens | [01 §1.2 #1](#appendix-a-quick-reference-index) | Design |
| **UX-4** | All 7 design principles enforced in code review (see §2.2) | [01 §1.2](#appendix-a-quick-reference-index) | Design |
| **UX-5** | Skeleton (exact-shape) for every async surface, ≤ 200 ms to first paint | [01 §1.2 #2 / §13](#appendix-a-quick-reference-index) | Frontend |
| **UX-6** | Dark mode via `[data-theme="dark"]` token swap, persisted in localStorage | [01 §16](#appendix-a-quick-reference-index) | Frontend |
| **UX-7** | Application shell (`<Topbar/>`, `<Sidebar/>`, `<Main/>`) with persistent layout | [01 §6.1](#appendix-a-quick-reference-index) | Frontend |
| **RT-1** | Hybrid transport: SSE for read-only streams (WP updates, notifications, presence) + WebSocket for high-frequency (cursor, typing) | [06 §4.2](#appendix-a-quick-reference-index) | Realtime |
| **RT-2** | Event envelope `{ v, type, ts, channel, data, lastEventId? }` | [06 §5.3](#appendix-a-quick-reference-index) | Realtime |
| **RT-3** | Channel naming convention `org:{orgId}:project:{projectId}:work-package` (hierarchical) | [06 §6](#appendix-a-quick-reference-index) | Realtime |
| **RT-4** | Outbox pattern: write to `outbox` table within same Prisma `$transaction` as the domain write; separate worker publishes to Redis | [06 §8.5](#appendix-a-quick-reference-index) | Realtime |
| **RT-5** | SSE handler at `pages/api/v1/sse.ts` with `Last-Event-ID` resume, heartbeat 25 s | [06 §7.6](#appendix-a-quick-reference-index) | Realtime |
| **RT-6** | Presence channels separate namespace `presence:*`; TTL 60 s | [06 §6.4 / §9.2](#appendix-a-quick-reference-index) | Realtime |
| **PERF-1** | Virtualize `<WPTable/>` for > 100 rows using `@tanstack/react-virtual` | [09 §3.4 / §9.5](#appendix-a-quick-reference-index) | Frontend |
| **PERF-2** | DataLoader for `member.role` and `user.avatar` in WP list resolver | [09 §4.2](#appendix-a-quick-reference-index) | Backend |
| **PERF-3** | Dynamic-import the four heavy islands: Gantt, Calendar, Charts, Editor | [09 §3.4 / App.A.6 #3](#appendix-a-quick-reference-index) | Frontend |
| **PERF-4** | Redis cache for `projects/{id}/members` and `users/{id}/preferences` (5 min TTL) | [09 §5.3 / App.A.6 #2](#appendix-a-quick-reference-index) | Backend |
| **PERF-5** | Materialized view `mv_project_wps_status` (refresh every 60 s via `pg_cron`) | [04 §10 / 09 App.A.5](#appendix-a-quick-reference-index) | Backend |
| **DEV-1** | GitHub Actions: `ci.yml` (lint, typecheck, unit, build) on every PR | [07 §4.2](#appendix-a-quick-reference-index) | DevOps |
| **DEV-2** | GitHub Actions: `e2e.yml` (Playwright) on PR + nightly | [07 §4.2](#appendix-a-quick-reference-index) | DevOps |
| **DEV-3** | GitHub Actions: `deploy-preview.yml` (Vercel preview per PR) | [07 §4.2 / §7.3](#appendix-a-quick-reference-index) | DevOps |
| **DEV-4** | Multi-stage Dockerfile (deps → build → runner, non-root, ~150 MB) | [07 §5.1](#appendix-a-quick-reference-index) | DevOps |
| **DEV-5** | `docker-compose.yml` (Postgres + Redis + Mailhog + app) for local | [07 §5.3](#appendix-a-quick-reference-index) | DevOps |
| **DEV-6** | Sentry source maps + release tracking (deploy commit SHA) | [07 §10.1](#appendix-a-quick-reference-index) | DevOps |
| **DEV-7** | Structured JSON logs (pino) — request id, userId, route, status, latency | [07 §10.2](#appendix-a-quick-reference-index) | DevOps |
| **DEV-8** | `/api/v1/health` (liveness) + `/api/v1/ready` (readiness, DB + Redis ping) | [07 §10.4](#appendix-a-quick-reference-index) | DevOps |
| **TEST-1** | Vitest config: `environment: 'jsdom'`, `setupFiles: ['./test/setup.ts']`, `coverage.thresholds.lines: 70` | [08 §4.1 / §3.2](#appendix-a-quick-reference-index) | Testing |
| **TEST-2** | MSW handlers for all `pages/api/v1/*` in `__mocks__/handlers/` | [08 §6.2](#appendix-a-quick-reference-index) | Testing |
| **TEST-3** | Integration test runner uses ephemeral Postgres + transaction rollback | [08 §7.2 / §7.3](#appendix-a-quick-reference-index) | Testing |
| **TEST-4** | Playwright POM (`e2e/pages/`, `e2e/fixtures/`) with auth fixture | [08 §8.1–§8.3](#appendix-a-quick-reference-index) | Testing |
| **TEST-5** | Coverage thresholds enforced in CI (fail under 70 % line) | [08 §3.2 / §4.1](#appendix-a-quick-reference-index) | Testing |

### 5.2 P1 — Required for v2, ship in Phase 2–4 (88 items)

| # | Item | Source doc / § |
|---|---|---|
| **SEC-13** | MFA (TOTP) for all admin users; WebAuthn as opt-in 2FA | [05 §4.3](#appendix-a-quick-reference-index) |
| **SEC-14** | Session: 30-day rolling, refresh on activity, force re-auth for sensitive ops | [05 §4.4](#appendix-a-quick-reference-index) |
| **SEC-15** | OAuth 2.0 providers (Google, Microsoft, GitHub) | [05 §4.5](#appendix-a-quick-reference-index) |
| **SEC-16** | SAML SSO (Enterprise) via `@node-saml/passport-saml` or `samlify` | [05 §4.6](#appendix-a-quick-reference-index) |
| **SEC-17** | SCIM 2.0 provisioning endpoint | [05 §4.8](#appendix-a-quick-reference-index) |
| **SEC-18** | Permission inheritance (project → work-package; role → work-package) | [05 §5.2](#appendix-a-quick-reference-index) |
| **SEC-19** | Custom roles builder UI (admin) | [05 §5.4](#appendix-a-quick-reference-index) |
| **SEC-20** | Resource-level permissions (per WP, per project) | [05 §5.3](#appendix-a-quick-reference-index) |
| **SEC-21** | Per-route audit log (admin-viewable) | [03 §8.6](#appendix-a-quick-reference-index) |
| **SEC-22** | Request size limits (1 MB JSON, 50 MB upload) | [05 §6.4](#appendix-a-quick-reference-index) |
| **SEC-23** | API versioning (`/api/v1/*` is the only stable surface) | [05 §6.6](#appendix-a-quick-reference-index), [03 §4.1](#appendix-a-quick-reference-index) |
| **SEC-24** | Encryption at rest for `users.password` (pgcrypto) | [05 §7.1](#appendix-a-quick-reference-index) |
| **SEC-25** | Encryption in transit (TLS 1.2+, HSTS preload) | [05 §7.2](#appendix-a-quick-reference-index) |
| **SEC-26** | Secret management via Doppler or AWS Secrets Manager | [05 §7.4](#appendix-a-quick-reference-index) |
| **SEC-27** | XSS prevention: sanitize + CSP + Trusted Types | [05 §8.4](#appendix-a-quick-reference-index) |
| **SEC-28** | Path traversal guard on file APIs | [05 §8.6](#appendix-a-quick-reference-index) |
| **SEC-29** | File upload validation (mime sniff, size, virus scan stub) | [05 §8.7](#appendix-a-quick-reference-index) |
| **SEC-30** | Security event detection (10× failed login, impossible travel) | [05 §9](#appendix-a-quick-reference-index) |
| **DB-8** | `WorkPackageJournal` two-tier versioning (header + per-field diff) | [04 §7.2](#appendix-a-quick-reference-index) |
| **DB-9** | Journal concurrency (last-writer-wins with `lockVersion`) | [04 §7.4](#appendix-a-quick-reference-index) |
| **DB-10** | `WikiPageVersion`, `DocumentVersion` (already exist) | [04 §7.5](#appendix-a-quick-reference-index) |
| **DB-11** | FK cascade policy matrix (per relation) | [04 §8.1](#appendix-a-quick-reference-index) |
| **DB-12** | Soft references pattern for cross-domain FKs | [04 §8.2](#appendix-a-quick-reference-index) |
| **DB-13** | Compensating controls for `Cascade` deletes (e.g., undo window) | [04 §8.3](#appendix-a-quick-reference-index) |
| **DB-14** | Lookup tables (Status, Type, Priority) with seeded enums | [04 §9.3](#appendix-a-quick-reference-index) |
| **DB-15** | Full-text search: `tsvector` generated column + GIN index | [04 §10](#appendix-a-quick-reference-index) |
| **DB-16** | Multi-tenancy RLS rollout plan (org table, policies, migration scripts) | [04 §4.2 / §4.5](#appendix-a-quick-reference-index) |
| **DB-17** | Materialized view `mv_project_wps_assignee` | [09 App.A.5](#appendix-a-quick-reference-index) |
| **DB-18** | Materialized view `mv_search_facets` | [09 App.A.5](#appendix-a-quick-reference-index) |
| **API-6** | `If-None-Match` (304) support for read endpoints | [03 §5.3](#appendix-a-quick-reference-index) |
| **API-7** | Bulk operations (`POST /api/v1/work-packages/bulk`) with `?dryRun=true` | [03 §5.5](#appendix-a-quick-reference-index) |
| **API-8** | Pagination strategy: `cursor` for lists > 100, `page` for admin tables | [03 §6.2 / 09 §4.8](#appendix-a-quick-reference-index) |
| **API-9** | HAL+JSON response (v3 compatibility stub) | [03 §6.5](#appendix-a-quick-reference-index) |
| **API-10** | Content negotiation (`Accept` header) | [03 §6.6](#appendix-a-quick-reference-index) |
| **API-11** | Error class hierarchy (`ApiError`, `ValidationError`, `AuthError`, `RateLimitError`, …) | [03 §7.1](#appendix-a-quick-reference-index) |
| **API-12** | Sentry capture rules (5xx → alert, 4xx → sample) | [03 §7.3](#appendix-a-quick-reference-index) |
| **API-13** | Rate limit buckets: `perIp`, `perUser`, `perOrg`, `perRoute` | [03 §9.1](#appendix-a-quick-reference-index) |
| **API-14** | Precedence order: `perRoute` > `perUser` > `perOrg` > `perIp` | [03 §9.2](#appendix-a-quick-reference-index) |
| **API-15** | API tokens (long-lived, scoped, hashed) | [03 §8.4](#appendix-a-quick-reference-index) |
| **FE-9** | Folder refactor to `src/domains/*` with barrel exports | [02 §4.1 / §4.4](#appendix-a-quick-reference-index) |
| **FE-10** | Component tiers: `ui/` (Radix-wrapped), `composite/`, `feature/` | [02 §5.2](#appendix-a-quick-reference-index) |
| **FE-11** | Prop conventions (`variant`, `size`, `tone`, `as`) | [02 §5.3](#appendix-a-quick-reference-index) |
| **FE-12** | Composition patterns (compound components, slots) | [02 §5.4](#appendix-a-quick-reference-index) |
| **FE-13** | Co-located tests + co-located stories | [02 §5.5](#appendix-a-quick-reference-index) |
| **FE-14** | `Data` vs `UI` line in components (no mixed concerns) | [02 §6.6](#appendix-a-quick-reference-index) |
| **FE-15** | Background refetch strategies (`refetchOnWindowFocus`, `refetchInterval`) | [02 §7.6](#appendix-a-quick-reference-index) |
| **FE-16** | File structure proposal (pages tree) | [02 §8.2](#appendix-a-quick-reference-index) |
| **FE-17** | Route transitions (view-transitions API where supported) | [02 §8.6](#appendix-a-quick-reference-index) |
| **FE-18** | 403 / 404 / 500 error pages | [02 §8.7](#appendix-a-quick-reference-index) |
| **FE-19** | Server-side rendering (getServerSideProps) for SEO pages | [02 §5.1](#appendix-a-quick-reference-index) |
| **UX-8** | 52 page-by-page wireframes (Index, Auth, Dashboard, Projects x14, My Page, Notifications, Help x3, Settings, Admin x16) | [01 §11](#appendix-a-quick-reference-index) |
| **UX-9** | State diagrams for WP lifecycle, Project lifecycle, Notification | [01 §12](#appendix-a-quick-reference-index) |
| **UX-10** | Loading / empty / error states library | [01 §13](#appendix-a-quick-reference-index) |
| **UX-11** | Mobile responsive strategy (breakpoints, navigation pattern) | [01 §14](#appendix-a-quick-reference-index) |
| **UX-12** | Theme switching & dark mode | [01 §16](#appendix-a-quick-reference-index) |
| **UX-13** | New pages beyond 52 (proposed: Goals, OKRs, Retrospectives) | [01 §18](#appendix-a-quick-reference-index) |
| **UX-14** | Component library inventory (60+ components) | [01 §8.1](#appendix-a-quick-reference-index) |
| **UX-15** | Component recipes (the 12 most-used patterns) | [01 §8.2](#appendix-a-quick-reference-index) |
| **UX-16** | Motion tokens + microinteractions (≤ 200 ms, ease-out) | [01 §9](#appendix-a-quick-reference-index) |
| **UX-17** | Iconography (lucide-react, 24×24 default, 1.5 stroke) | [01 §7](#appendix-a-quick-reference-index) |
| **UX-18** | Accessibility: WCAG 2.1 AA, color contrast, focus rings, keyboard nav | [01 §10](#appendix-a-quick-reference-index) |
| **RT-7** | Client-side reconnect with exponential backoff (1s → 30s) | [06 §8.1](#appendix-a-quick-reference-index) |
| **RT-8** | Server-side cleanup (TTL on dead connections) | [06 §8.2](#appendix-a-quick-reference-index) |
| **RT-9** | Idempotency on subscription events (eventId dedup) | [06 §8.3](#appendix-a-quick-reference-index) |
| **RT-10** | Three-layer presence (online, idle, offline) | [06 §9.1](#appendix-a-quick-reference-index) |
| **RT-11** | Idle detection on client (mouse/keyboard 60 s) | [06 §9.3](#appendix-a-quick-reference-index) |
| **RT-12** | Last-seen in presence cache | [06 §9.4](#appendix-a-quick-reference-index) |
| **RT-13** | Optimistic concurrency via `lockVersion` in event payload | [06 §10](#appendix-a-quick-reference-index) |
| **PERF-6** | Bundle size budget per route (enforce in CI) | [09 §3.2](#appendix-a-quick-reference-index) |
| **PERF-7** | Tree-shaking verification (no barrel-import-of-everything) | [09 §3.5](#appendix-a-quick-reference-index) |
| **PERF-8** | Image optimization (Vercel/Cloudflare, AVIF/WebP) | [09 §3.7](#appendix-a-quick-reference-index) |
| **PERF-9** | Font optimization (`next/font`, no FOIT) | [09 §3.8](#appendix-a-quick-reference-index) |
| **PERF-10** | Critical CSS extraction (Tailwind v4 `@layer`) | [09 §3.9](#appendix-a-quick-reference-index) |
| **PERF-11** | Resource hints (`preconnect`, `dns-prefetch`) | [09 §3.10](#appendix-a-quick-reference-index) |
| **PERF-12** | Streaming SSR with Suspense | [09 §3.11](#appendix-a-quick-reference-index) |
| **PERF-13** | Connection pool sizing (PgBouncer/Prisma) | [09 §4.5](#appendix-a-quick-reference-index) |
| **PERF-14** | Read replicas for read-heavy endpoints | [09 §4.6](#appendix-a-quick-reference-index) |
| **PERF-15** | Request coalescing (per-request, per-user) | [09 §4.7](#appendix-a-quick-reference-index) |
| **PERF-16** | CDN cache (`Cache-Control: s-maxage=60, stale-while-revalidate=300`) | [09 §5.2](#appendix-a-quick-reference-index) |
| **PERF-17** | Negative caching (404 / 403 TTL 10 s) | [09 §5.8](#appendix-a-quick-reference-index) |
| **PERF-18** | SSE connection limits per server (1k/instance) | [09 §6.1](#appendix-a-quick-reference-index) |
| **PERF-19** | Heartbeat frequency optimization (25 s) | [09 §6.4](#appendix-a-quick-reference-index) |
| **PERF-20** | Compression (Brotli) for SSE/WS payloads | [09 §6.5](#appendix-a-quick-reference-index) |
| **PERF-21** | Per-project fan-out (channel sharding) | [09 §6.6](#appendix-a-quick-reference-index) |
| **PERF-22** | Event coalescing (debounce WP update 100 ms) | [09 §6.7](#appendix-a-quick-reference-index) |
| **DEV-9** | Branch protection (require 1 review, CI green, no force-push to main) | [07 §4.3](#appendix-a-quick-reference-index) |
| **DEV-10** | Database migration on deploy (zero-downtime, expand-contract) | [07 §4.5](#appendix-a-quick-reference-index) |
| **DEV-11** | Vercel configuration (`vercel.json`, env, regions) | [07 §7.3](#appendix-a-quick-reference-index) |
| **DEV-12** | Railway fallback (for self-hosted or DR) | [07 §7.4](#appendix-a-quick-reference-index) |
| **DEV-13** | Neon setup (branching, pooling) | [07 §8.2](#appendix-a-quick-reference-index) |
| **DEV-14** | Backup strategy (daily PITR, weekly full) | [07 §8.4](#appendix-a-quick-reference-index) |
| **DEV-15** | Upstash configuration (key namespaces, TLS) | [07 §9.2 / §9.3](#appendix-a-quick-reference-index) |
| **DEV-16** | Rate limiting at the edge (Vercel Edge Config) | [07 §9.5](#appendix-a-quick-reference-index) |
| **DEV-17** | Geo-replication strategy (read-replica region) | [07 §9.6](#appendix-a-quick-reference-index) |
| **DEV-18** | Sentry performance + replay + profiling | [07 §10.1](#appendix-a-quick-reference-index) |
| **DEV-19** | Prometheus `/metrics` endpoint | [07 §10.3](#appendix-a-quick-reference-index) |
| **DEV-20** | Uptime monitoring (Better Uptime / Pingdom) | [07 §10.4](#appendix-a-quick-reference-index) |
| **TEST-6** | Mutation testing (Stryker) on services/ and lib/access/ | [08 §3.4](#appendix-a-quick-reference-index) |
| **TEST-7** | E2E flake prevention (10 commandments) | [08 §8.5](#appendix-a-quick-reference-index) |
| **TEST-8** | Visual regression (Playwright screenshots, 20 key screens) | [08 §8.7](#appendix-a-quick-reference-index) |
| **TEST-9** | k6 load suite: smoke, load, stress, spike, soak, breakpoint | [09 §13 / App.A.3](#appendix-a-quick-reference-index) |
| **TEST-10** | RBAC matrix test (one per role × resource) | [08 §7.6](#appendix-a-quick-reference-index) |

### 5.3 P2 — v2.1 (50 items, planned but deferable)

| # | Item | Source |
|---|---|---|
| **SEC-31** | OAuth 2.0 token rotation | [05 §4.5](#appendix-a-quick-reference-index) |
| **SEC-32** | SAML encryption (signed assertions) | [05 §4.6](#appendix-a-quick-reference-index) |
| **SEC-33** | LDAP sync (scheduled) | [05 §4.7](#appendix-a-quick-reference-index) |
| **SEC-34** | Anomaly detection ML | [05 §9](#appendix-a-quick-reference-index) |
| **DB-19** | Read replica routing logic in Prisma | [04 §4 / 09 §4.6](#appendix-a-quick-reference-index) |
| **DB-20** | Custom field plugin SDK | (deferred — see §1.4) |
| **DB-21** | Soft delete pruning cron (older than 90 days) | [04 §5.4](#appendix-a-quick-reference-index) |
| **API-16** | GraphQL gateway (read-only, for 3rd-party) | (deferred) |
| **API-17** | Webhook delivery system | (deferred) |
| **FE-20** | Storybook deployment to Chromatic | [02 §5.5](#appendix-a-quick-reference-index) |
| **FE-21** | Component visual regression (Chromatic) | [02 §5.5](#appendix-a-quick-reference-index) |
| **FE-22** | i18n framework migration (`next-i18next` → `next-intl`) | (deferred) |
| **UX-19** | Mobile native app shells | (deferred — PWA only) |
| **UX-20** | Gantt PDF export | (deferred — see §1.4) |
| **UX-21** | AI-assisted scheduling | (deferred — see §1.4) |
| **UX-22** | Custom field per WP type | (deferred) |
| **UX-23** | Custom workflows per WP type (status transitions) | (deferred) |
| **UX-24** | Goal / OKR module | (deferred) |
| **UX-25** | Retrospective module | (deferred) |
| **UX-26** | Time tracking (manual + timer) | (deferred) |
| **UX-27** | Cost tracking / budgets | (deferred) |
| **UX-28** | Risk register module | (deferred) |
| **UX-29** | Meetings (already in Phase 4 per `AGENTS.md`) | (deferred) |
| **UX-30** | Forum (already in Phase 4 per `AGENTS.md`) | (deferred) |
| **RT-14** | Yjs / CRDT for collaborative text editing | (deferred) |
| **RT-15** | Voice / video (WebRTC) | (deferred) |
| **RT-16** | Offline queue / sync (Service Worker) | (deferred) |
| **PERF-23** | Service Worker cache (offline read) | (deferred) |
| **PERF-24** | Speculation Rules API for prefetch | (deferred) |
| **PERF-25** | Edge functions for personalization | (deferred) |
| **DEV-21** | Multi-region active/active | (deferred — see §1.4) |
| **DEV-22** | Cloudflare Tunnel for final delivery | [07 §15](#appendix-a-quick-reference-index) (P2 — Phase 5 opt) |
| **DEV-23** | Self-hosted Helm chart | (deferred) |
| **DEV-24** | Disaster recovery runbook | [07 §14](#appendix-a-quick-reference-index) |
| **DEV-25** | Chaos engineering (Litmus) | (deferred) |
| **TEST-11** | Property-based testing (fast-check) | (deferred) |
| **TEST-12** | Fuzz testing (AFL / libFuzzer) | (deferred) |
| **TEST-13** | Penetration test (3rd party) | (deferred) |
| **TEST-14** | Accessibility audit (3rd party) | (deferred) |
| **FEATURE-1** | Wiki (already in Phase 4 per `AGENTS.md`) | (deferred) |
| **FEATURE-2** | Document (already in Phase 4 per `AGENTS.md`) | (deferred) |
| **FEATURE-3** | Advanced search filters UI (saved filters) | (deferred) |
| **FEATURE-4** | Gantt dependency editing | (partial P1) |
| **FEATURE-5** | Board view (Kanban) drag-and-drop persistence | (partial P1) |
| **FEATURE-6** | Calendar view (already in `pages/`) | (deferred polish) |
| **FEATURE-7** | Notifications (already in `pages/`) | (deferred polish) |
| **FEATURE-8** | Reporting dashboards (charts) | (deferred) |
| **FEATURE-9** | Saved reports / exports (CSV, XLSX) | (deferred) |
| **FEATURE-10** | Email digests | (deferred) |
| **FEATURE-11** | Slack / MS Teams integration | (deferred) |
| **FEATURE-12** | Webhooks (per project) | (deferred) |
| **FEATURE-13** | API public tokens (per user) | (partial P1) |
| **FEATURE-14** | Backup / restore UI | (deferred) |

### 5.4 P3 — Future / nice-to-have (20 items)

| # | Item |
|---|---|
| **FUT-1** | AI work-package summarization |
| **FUT-2** | AI risk-prediction |
| **FUT-3** | AI auto-categorization |
| **FUT-4** | Voice commands |
| **FUT-5** | Mobile native (React Native) |
| **FUT-6** | Desktop app (Tauri) |
| **FUT-7** | Plugin marketplace |
| **FUT-8** | Multi-language UI (i18n ≥ 5 languages) |
| **FUT-9** | Custom themes per user |
| **FUT-10** | Branded email templates |
| **FUT-11** | Onboarding tour (interactive) |
| **FUT-12** | In-app messaging (1:1) |
| **FUT-13** | Public read-only share links |
| **FUT-14** | Embeds (oEmbed for issues) |
| **FUT-15** | Calendar sync (CalDAV) |
| **FUT-16** | GitHub / GitLab integration |
| **FUT-17** | Jira migration importer |
| **FUT-18** | Trello migration importer |
| **FUT-19** | Asana migration importer |
| **FUT-20** | White-label / multi-tenant branding |

**Total items: 62 (P0) + 88 (P1) + 50 (P2) + 20 (P3) = 220.** ✓ matches the "200+" target.

---

## 6. Implementation Phases (overview)

| Phase | Weeks | Theme | Headline deliverable | Owner |
|---|---|---|---|---|
| **0** | 1 | Critical fixes | All 5 CRITICAL security findings closed | Security + Lead |
| **1** | 2–4 | Foundation | Design system + folder refactor + auth wrapper | Lead + FE |
| **2** | 5–8 | Core features | WP table / detail / form v2 live | FE + BE |
| **3** | 9–10 | Collaboration | SSE + presence + optimistic concurrency | RT + BE |
| **4** | 11–12 | Performance | Virtualization + indexes + caches | BE + FE |
| **5** | 13–14 | DevOps | CI/CD, monitoring, runbooks | DevOps |
| **6** | 15–16 | Polish | A11y audit, k6, mutation tests, doc | QA + Lead |

### 6.1 Dependency graph (summary; full diagram in §18)

```
P0 ──► P1[FE-1, SEC-*] ──► P1[DB-*] ──► P1[API-*] ──► P1[PERF-*] ──► P2
       └─► P1[UX-*]       └─► P1[RT-*]      └─► P1[DEV-*]
                                                       └─► P1[TEST-*]
```

Critical path: **SEC-1/2/3 → API-1/2/4 → DB-2/5 → PERF-1/4 → launch**.

### 6.2 Workstream ownership

- **Lead Architect** — overall, design tokens, dependencies
- **FE Lead** — `src/`, components, state, forms
- **BE Lead** — API, Prisma, services
- **Realtime Lead** — SSE, WS, outbox, presence
- **Security Lead** — auth, RBAC, headers, OWASP
- **DevOps Lead** — CI/CD, Vercel, Neon, Sentry
- **QA Lead** — Vitest, Playwright, k6, mutation
- **Designer** — tokens, wireframes, a11y review

---

## 7. Phase 0 — Critical Fixes (Week 1)

**Goal:** close all 5 critical security findings from [05 §3](#appendix-a-quick-reference-index). No new features.

**Duration:** 5 working days.
**Owner:** Security Lead (primary) + Lead Architect (review).
**Dependency:** none (this is the entry point).

### 7.1 Day-by-day plan

| Day | Task | Acceptance |
|---|---|---|
| **Mon** | **SEC-1** — find and replace every `getServerSession(...)` 1-arg call with `await auth()` from `lib/auth.ts` | `rg "getServerSession\(" pages/api` returns 0 hits; integration tests pass |
| **Mon** | **SEC-3** — add `lib/security-headers.ts` with `applySecurityHeaders(res)`; wire to `withApiAuth` and `getServerSideProps` | `curl -I http://localhost:3000/api/v1/health` shows all 6 headers |
| **Tue** | **SEC-2** — create `withApiAuth(handler, { requireAuth, requiredRoles? })` in `lib/api/`; migrate 20 most-hit routes | Wrapper used in 20+ routes; new routes cannot compile without it (ESLint rule) |
| **Tue** | **SEC-4** — audit `lib/ldap/client.ts`; replace string concat with `ldapjs.escapeFilter()` and `ldapjs.parseDN()` validation | Unit test injects `*`, `)(cn=*`, `\\` — all sanitized |
| **Wed** | **SEC-5** — persist WebAuthn challenges in Redis with `SET ... EX 300`; key `webauthn:challenge:{userId}` | Integration test: challenge expires after 5 min, retrieval after restart works |
| **Wed** | **SEC-7** — install Zod schemas for top 10 endpoints (`work-packages/*`, `projects/*`, `users/*`) | Pydantic-style errors returned; tests assert 400 on bad payload |
| **Thu** | **SEC-8** — Upstash rate limit on `/api/auth/*` (10/min per IP), `/api/v1/work-packages/*` (60/min per user) | Test 11 req/min → 11th gets 429 |
| **Thu** | **SEC-9** — CORS allowlist (no wildcard), reads from `process.env.CORS_ALLOWED_ORIGINS` | Preflight returns correct `Access-Control-Allow-Origin` |
| **Fri** | **SEC-10** — CSRF middleware (double-submit cookie or `@edge-auth/csrf`) | POST without token → 403; with token → 200 |
| **Fri** | **SEC-11** — DOMPurify for all rich text fields | XSS payload `<img src=x onerror=alert(1)>` sanitized in test |
| **Fri** | Phase 0 retro, security audit sign-off | Lead + Security sign the §22 acceptance criteria for Phase 0 |

### 7.2 PR breakdown

- `chore(security): replace 1-arg getServerSession` — 1 PR
- `feat(security): withApiAuth wrapper + 20 routes migrated` — 1 PR
- `feat(security): security headers + CSP` — 1 PR
- `fix(security): LDAP injection` — 1 PR
- `fix(security): persist WebAuthn challenges in Redis` — 1 PR
- `feat(security): rate limit + CORS + CSRF` — 1 PR (combined)
- `feat(security): Zod validation top 10 endpoints` — 1 PR

### 7.3 Risks specific to Phase 0

- **Breaking auth** — keep NextAuth v4 fallback path for 48 h, dual-export from `lib/auth.ts`.
- **CSP too strict** — start with `Content-Security-Policy-Report-Only` for 24 h, then enforce.
- **Rate-limit false positives** — bucket is per-user (not per-IP) for authed routes; tune.

---

## 8. Phase 1 — Foundation (Weeks 2–4)

**Goal:** ship a usable, token-driven, refactored codebase. No new user-visible features beyond the WP list. All P0+1 frontend and design system items in.

**Duration:** 3 weeks (15 working days).
**Owners:** Lead Architect (tokens, refactor) + FE Lead (components).
**Dependencies:** Phase 0 complete.

### 8.1 Week 2 — Design tokens + shell

| Day | Task | Acceptance |
|---|---|---|
| Mon | **UX-1, UX-2** — create `styles/tokens.css` with all 88+ tokens; configure Tailwind v4 `@theme inline` | `tailwind.config.ts` is empty of colors; classes like `bg-primary-600` resolve |
| Mon | **UX-7** — build `<AppShell/>` with `<Topbar/>`, `<Sidebar/>`, `<Main/>` slots | Render at `/dashboard` shows shell; sidebar collapses at < 1024 px |
| Tue | **UX-4** — code review checklist enforcing N1–N7 and §2.3 anti-patterns | Checklist merged to `docs/code-review.md`; PR template links to it |
| Tue | **UX-6** — dark mode via `[data-theme="dark"]` token swap, persisted in `useUiStore` | Toggle in `<Topbar/>` works; refresh preserves |
| Wed | **FE-3** — slice Zustand: `useUiStore`, `useWorkPackageFilterStore`, `usePresenceStore` (skeleton) | Existing `stores/ui-store.ts` is split; tests for each slice |
| Wed | **FE-5** — set TanStack Query defaults (`staleTime: 30s`, `gcTime: 5m`) in `lib/query-client.ts` | `useQuery` everywhere uses defaults; override documented |
| Thu | **FE-4** — `nuqs` for `/projects/[id]/work-packages?status=open&assignee=me&page=2` | URL is source of truth; refresh works |
| Thu | **FE-6** — react-hook-form + Zod for `<WorkPackageForm/>` | Form validates client-side; submits; server returns same errors |
| Fri | **UX-5** — skeleton library (10 components: Table, Card, Form, List, …) | First paint of WP list < 200 ms on cold cache |

### 8.2 Week 3 — Folder refactor + auth wrapper

| Day | Task | Acceptance |
|---|---|---|
| Mon | **FE-2, FE-9** — create `src/domains/{work-packages,projects,users,notifications,collaboration,reporting,admin}/` structure; barrel exports | Old `services/` is shimmed to re-export from new location; tests pass |
| Mon | **FE-10** — define component tiers `src/components/{ui,composite,feature}/`; move 5 most-used components | `import { Button } from "@/components/ui"` works |
| Tue | **FE-11** — write `docs/component-conventions.md` (variant, size, tone, as) | 3 PRs reviewed against it |
| Tue | **FE-12** — convert 3 components to compound pattern (`<Tabs.Tab>`, `<Card.Header>`) | Documented in §5.4 of `02-frontend-architecture.md` |
| Wed | **FE-13** — co-locate `*.test.tsx` and `*.stories.tsx` next to `*.tsx` | 100 % of `src/components/ui/*` have a story |
| Wed | **FE-19** — `getServerSideProps` for SEO pages (`/`, `/login`, `/help/*`) | `<title>` and OG meta populated |
| Thu | **FE-7** — `middleware.ts` with CSP nonce, auth redirect, rate-limit pre-check | Non-authed request to `/projects/...` → `/login?next=...`; CSP nonce in HTML |
| Thu | **FE-8** — `<RoleGate role="admin">` for admin pages | `<RoleGate>` hides children if user lacks role |
| Fri | **API-4** — finalize `withApiAuth`, `withRole`, `withJson` higher-order functions | API test matrix passes; new endpoints lint-required to use wrapper |
| Fri | **API-2** — v1 envelope `{ data, meta?, error? }` applied to top 10 routes | `curl /api/v1/work-packages` returns envelope |

### 8.3 Week 4 — WP list v1 (no new tables) + RBAC v1

| Day | Task | Acceptance |
|---|---|---|
| Mon | **SEC-6, SEC-18** — implement `lib/access/pdp.ts` (PDP); 3 roles (`reader`, `member`, `manager`); permission inheritance | Unit test: PDP denies cross-org read |
| Mon | **API-1** — REST primary confirmed; `pages/api/trpc/[trpc].ts` stub for internal calls | tRPC used for `_app.tsx` initial load; REST for everything else |
| Tue | **DB-1** — soft-delete middleware on 7 hot tables | `prisma.workPackage.delete()` sets `deleted_at`; list query filters |
| Tue | **DB-6** — migrate `WorkPackageStatus` to PG enum | All queries use enum; existing string values migrated |
| Wed | **PERF-1** — virtualize `<WPTable/>` | 1 000 rows render < 16 ms / frame in DevTools profiler |
| Wed | **PERF-4** — Redis cache for `projects/{id}/members` (5 min TTL) | Second request for same project → 4 ms (was 180 ms) |
| Thu | **DB-2** — covering index on `work_packages(project_id, status_id, updated_at DESC) INCLUDE (...)` | `EXPLAIN ANALYZE` shows index scan, < 8 ms |
| Thu | **DB-3** — partial index for assignee open WP | `EXPLAIN ANALYZE` shows partial index scan |
| Fri | **TEST-1, TEST-2** — Vitest config + MSW handlers | `npm test` runs 200+ tests; coverage 60 % |
| Fri | Phase 1 retro, sign-off | §22 criteria pass |

### 8.4 Phase 1 deliverables checklist

- [ ] Design tokens live and used everywhere
- [ ] `src/domains/*` structure in place, shim from `services/`
- [ ] `withApiAuth` used in 100 % of `pages/api/**`
- [ ] `<AppShell/>` rendered on all authed pages
- [ ] `<WPTable/>` virtualized and rendered
- [ ] PDP covers 3 base roles with inheritance
- [ ] All 7 soft-delete tables use middleware
- [ ] Coverage 60 %, 200+ tests, 0 lint errors

---

## 9. Phase 2 — Core Features (Weeks 5–8)

**Goal:** ship the v2 work-package experience end-to-end (list, detail, create, edit, comment, attach, status transitions).

**Duration:** 4 weeks.
**Owners:** FE Lead + BE Lead + Designer.
**Dependencies:** Phase 1.

### 9.1 Week 5 — WP detail page v2

| Day | Task |
|---|---|
| Mon | **UX-8** — wireframe `/projects/[id]/work-packages/[wp]` per [01 §11.3](#appendix-a-quick-reference-index) (full implementation) |
| Tue | **DB-8, DB-9** — `WorkPackageJournal` two-tier model, write on every mutation |
| Wed | **FE-12** — split-pane detail (left: form; right: activity / journal / relations) |
| Thu | **API-5** — `If-Match` (ETag) on detail endpoint |
| Fri | **PERF-2** — DataLoader for `member.role` and `user.avatar` in detail loader |

### 9.2 Week 6 — WP create / edit / bulk

| Day | Task |
|---|---|
| Mon | **FE-6** — complete `<WorkPackageForm/>` (create + edit) with RHF + Zod |
| Tue | **API-3** — `idempotency-key` support; client generates UUID v7 per submit |
| Tue | **API-7** — bulk endpoint `POST /api/v1/work-packages/bulk` with `?dryRun=true` |
| Wed | **SEC-29** — file upload validation (mime sniff, 50 MB cap, virus scan stub) |
| Thu | **DB-15** — FTS `tsvector` column + GIN index; `wp_search` repository method |
| Fri | **PERF-3** — dynamic-import `<Gantt/>`, `<Calendar/>`, `<Charts/>`, `<Editor/>` |

### 9.3 Week 7 — Realtime part 1 (foundation)

| Day | Task |
|---|---|
| Mon | **RT-2, RT-3** — event envelope + channel naming |
| Tue | **RT-4** — outbox table + worker (polls every 100 ms, publishes to Redis) |
| Wed | **RT-5** — `pages/api/v1/sse.ts` with `Last-Event-ID` resume + heartbeat |
| Thu | **RT-1** — wire `<WPTable/>` to SSE for live updates of viewed project |
| Fri | **RT-7** — client-side reconnect with exponential backoff |

### 9.4 Week 8 — Realtime part 2 (presence + journal)

| Day | Task |
|---|---|
| Mon | **RT-6, RT-10, RT-11, RT-12** — presence channel + idle detection + last-seen |
| Tue | **RT-13** — optimistic concurrency via `lockVersion` in event payload |
| Wed | **DB-19** — wire `WorkPackageJournal` to SSE events (`wp.journal.created`) |
| Thu | **PERF-22** — event coalescing (debounce WP field updates 100 ms) |
| Fri | **TEST-3, TEST-5** — integration tests for journal + presence; coverage 65 % |

### 9.5 Phase 2 deliverables checklist

- [ ] WP detail page v2 live at `/projects/[id]/work-packages/[wp]`
- [ ] Create / edit / bulk forms work end-to-end
- [ ] Journal writes on every mutation
- [ ] SSE delivers live WP updates to viewers
- [ ] Presence shows "Alice is viewing" indicator
- [ ] Coverage 65 %

---

## 10. Phase 3 — Collaboration (Weeks 9–10)

**Goal:** comments, mentions, attachments, and a working notifications center — all realtime.

**Duration:** 2 weeks.
**Owners:** RT Lead + FE Lead.
**Dependencies:** Phase 2.

### 10.1 Week 9 — Comments + mentions

| Day | Task |
|---|---|
| Mon | `<CommentList/>`, `<CommentForm/>` on WP detail (right pane) |
| Tue | `@mention` autocomplete (TanStack Query + RHF) |
| Wed | **SEC-11** — DOMPurify on rendered markdown |
| Thu | `notification` event type + SSE channel `org:{orgId}:user:{userId}` |
| Fri | Notification dropdown in `<Topbar/>` (live) |

### 10.2 Week 10 — Attachments + S3 + WebSocket for high-frequency

| Day | Task |
|---|---|
| Mon | S3 presigned upload (50 MB cap, mime sniff) |
| Tue | `<AttachmentList/>` + drag-and-drop |
| Wed | WebSocket handler `pages/api/v1/ws.ts` for typing indicators + cursor on detail page |
| Thu | **RT-8, RT-9** — server cleanup + idempotency on subscription events |
| Fri | **TEST-6** — mutation testing on `lib/realtime/` (Stryker) |

### 10.3 Phase 3 deliverables checklist

- [ ] Comments work with @mentions
- [ ] Notifications dropdown updates live
- [ ] Attachments upload to S3 with presigned URLs
- [ ] Typing indicators and (optional) cursor presence
- [ ] Coverage 68 %

---

## 11. Phase 4 — Performance (Weeks 11–12)

**Goal:** meet the §1.3 SLOs on real load. This is the "we're not embarrassed" phase.

**Duration:** 2 weeks.
**Owners:** BE Lead + FE Lead.
**Dependencies:** Phase 3.

### 11.1 Week 11 — Indexes + caches + materialized views

| Day | Task |
|---|---|
| Mon | **DB-2, DB-3** verify via `EXPLAIN ANALYZE`; tune if needed |
| Mon | **DB-7** — GIN trigram on `work_packages(subject)` |
| Tue | **PERF-4, PERF-16** — Redis cache audit (TTL strategy, negative caching) |
| Tue | **PERF-5, DB-17, DB-18** — materialized views + `pg_cron` refresh |
| Wed | **PERF-13, PERF-14** — connection pool (PgBouncer), read replica routing |
| Thu | **PERF-15** — request coalescing in `services/` |
| Fri | **PERF-8, PERF-9** — image + font optimization pass |

### 11.2 Week 12 — Bundle + k6

| Day | Task |
|---|---|
| Mon | **PERF-6** — bundle size budget enforced in CI (fail > 250 KB gz per route) |
| Tue | **PERF-7** — tree-shaking audit; remove `import _ from 'lodash'` |
| Wed | **PERF-10, PERF-11** — critical CSS + resource hints |
| Thu | **TEST-9** — k6 smoke + load + stress (90 min run) |
| Fri | Tune based on k6 results; sign off on SLOs |

### 11.3 Phase 4 deliverables checklist

- [ ] API p95 < 60 ms on WP list
- [ ] LCP p75 < 2.0 s on WP list
- [ ] Bundle per route < 250 KB gz
- [ ] k6 load test passes 1 000 concurrent users
- [ ] Materialized views refreshed every 60 s

---

## 12. Phase 5 — DevOps & Reliability (Weeks 13–14)

**Goal:** ship CI/CD, monitoring, runbooks, and DR.

**Duration:** 2 weeks.
**Owners:** DevOps Lead + Lead.
**Dependencies:** Phase 4 (so we deploy real working code).

### 13.1 Week 13 — CI/CD + observability

| Day | Task |
|---|---|
| Mon | **DEV-1, DEV-2, DEV-3** — GitHub Actions workflows live |
| Tue | **DEV-4, DEV-5** — Dockerfile + docker-compose |
| Wed | **DEV-6, DEV-18, DEV-19** — Sentry + Prometheus |
| Thu | **DEV-7** — structured logs (pino) |
| Fri | **DEV-8, DEV-9, DEV-20** — health/ready, branch protection, uptime monitor |

### 13.2 Week 14 — Deploy + migration + runbooks

| Day | Task |
|---|---|
| Mon | **DEV-10, DEV-11, DEV-13, DEV-14, DEV-15** — Vercel + Neon + Upstash production config |
| Tue | **DB-16** — RLS rollout in production (shadow mode, then enforce) |
| Wed | **DEV-17** — geo-replication for read replicas |
| Thu | **DEV-24** — DR runbook + chaos drill |
| Fri | **DEV-22** (optional) — Cloudflare Tunnel for final delivery |

### 13.3 Phase 5 deliverables checklist

- [ ] CI green on `main` for 5 consecutive days
- [ ] Sentry capturing real errors with source maps
- [ ] Prometheus scraping `/metrics`
- [ ] Uptime monitor alerts PagerDuty
- [ ] DR drill: simulated DB failure → recovery in < 30 min

---

## 13. Phase 6 — Polish, A11y, Hardening (Weeks 15–16)

**Goal:** make it shippable to enterprise customers.

**Duration:** 2 weeks.
**Owners:** QA Lead + Designer + Security.
**Dependencies:** Phase 5.

### 13.1 Week 15 — A11y + security hardening

| Day | Task |
|---|---|
| Mon | **UX-18** — a11y audit (axe, manual keyboard nav, screen reader) |
| Tue | **SEC-13** — MFA (TOTP) for admins; WebAuthn opt-in for all |
| Wed | **SEC-14** — session management (30-day rolling, force re-auth) |
| Thu | **SEC-15, SEC-16, SEC-17** — OAuth + SAML + SCIM (Enterprise tier) |
| Fri | **SEC-30** — security event detection rules |

### 13.2 Week 16 — Hardening + docs

| Day | Task |
|---|---|
| Mon | **TEST-6** — Stryker mutation score ≥ 60 % on `services/` and `lib/access/` |
| Tue | **TEST-8** — visual regression (20 key screens) |
| Wed | **TEST-4, TEST-7** — Playwright flake rate < 1 % |
| Thu | **TEST-10** — RBAC matrix test (full grid) |
| Fri | **Open Q resolution**, sign-off, launch readiness review |

### 13.3 Phase 6 deliverables checklist

- [ ] WCAG 2.1 AA passes (axe + manual)
- [ ] MFA enforced for admins
- [ ] Mutation score ≥ 60 % on critical modules
- [ ] E2E flake rate < 1 %
- [ ] Launch readiness review signed by Lead + Security + Product

---

## 14. Cross-Cutting Concerns

These are baked into every phase; they are not a separate phase.

### 14.1 Security (always-on)

- **N1–N3** (security headers, default-deny auth, Zod validation) enforced by lint rules + tests.
- **Threat model** (STRIDE per route) updated every quarter; new routes must add an entry to `docs/threat-model.md`.
- **Dependency scanning**: `npm audit` in CI; Renovate keeps deps fresh.
- **Secret scanning**: `gitleaks` in pre-commit + CI.
- **OWASP Top 10** mapped to controls in [05 §10](#appendix-a-quick-reference-index).

### 14.2 Performance (always-on)

- **Lighthouse CI** on every PR; fail < 90.
- **Bundle analyzer** runs on every PR; comment posted with delta.
- **k6 smoke** runs nightly; alerts on p95 regression > 20 %.
- **Postgres slow query log** → alert on > 100 ms queries.

### 14.3 Testing (always-on)

- **PR template** requires: tests added/updated, coverage not decreased, mutation score not decreased on touched files.
- **Flake quarantine**: any test that fails 3× in a row is auto-skipped and filed as a bug.
- **No mocks of the system under test** — mock collaborators, not the unit (per [08 §2.5](#appendix-a-quick-reference-index)).

### 14.4 Observability (always-on)

- **Sentry**: every release tagged with commit SHA; release health tracked.
- **Structured logs**: every request has `requestId`, `userId`, `route`, `status`, `latencyMs`.
- **Prometheus**: RED metrics (Rate, Errors, Duration) per route.
- **Alerts**: PagerDuty rotation; runbook linked from each alert.

### 14.5 Documentation (always-on)

- **ADRs** in `docs/adr/` for every non-trivial decision.
- **API reference** auto-generated from Zod schemas → `apps/api-docs` (deferred to v2.1 if time-pressed).
- **Component Storybook** deployed to Chromatic (deferred to v2.1, but stories required).
- **Runbooks** for top 10 alerts.

### 14.6 Accessibility (always-on)

- **Axe** in component tests (`vitest-axe`).
- **Keyboard nav** tested manually per page.
- **Screen reader** tested manually per page in Phase 6 audit.

---

## 15. Risk Register (top 20)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| **R-1** | Phase 0 reveals deeper security issues than the 5 documented | High | High | Allocate 2 days buffer; security lead reviews full repo before Phase 0 | Security Lead |
| **R-2** | NextAuth v5 beta breaks during Phase 0 | Med | High | Pin to specific beta; have NextAuth v4 fallback in `lib/auth-legacy.ts` | Security Lead |
| **R-3** | Prisma 7 + `adapter-pg` connection leaks under load | Med | High | Connection pool with PgBouncer; load test in Phase 4 | BE Lead |
| **R-4** | N+1 query not caught in Phase 4 perf | Med | Med | DataLoader on top 10 hot resolvers from Phase 1; k6 in Phase 4 | BE Lead |
| **R-5** | SSE scaling issue at 1 000 concurrent connections per instance | High | Med | Phase 4 capacity test; if failed, move to dedicated realtime workers | RT Lead |
| **R-6** | Vercel function cold starts break SLOs | Med | Med | Move SSE/WS to dedicated Node server (Railway); keep pages on Vercel | DevOps |
| **R-7** | Neon branching not supported in our plan | Low | Med | Use Neon preview branches for PR previews; document in Phase 5 | DevOps |
| **R-8** | Upstash rate limit quota exceeded | Low | Med | Self-host Redis fallback; monitor quota | DevOps |
| **R-9** | Soft delete + RLS interact badly | Med | High | Integration test in Phase 2; RLS policy must include `deleted_at IS NULL` | BE Lead |
| **R-10** | Outbox worker lag causes stale realtime | Med | Med | Monitor lag metric; auto-scale worker; fallback to direct publish | RT Lead |
| **R-11** | WebAuthn challenge loss (root cause of SEC-5) recurs in other flows | Low | Med | Audit all challenge-style flows in Phase 0; pattern doc | Security |
| **R-12** | Design tokens refactor breaks Tailwind v4 | Med | Med | Run `tailwind-v4-codemod` in a branch; visual regression in Phase 6 | FE Lead |
| **R-13** | Folder refactor breaks imports across 200+ files | High | Med | Use `ts-morph` codemod; PR-by-PR with `--no-verify` to merge; revert plan | Lead |
| **R-14** | TanStack Query stale time causes user-visible stale data | Med | Low | `staleTime: 0` for write-triggered queries; SSE invalidates | FE Lead |
| **R-15** | CSP too strict blocks 3rd-party widgets | Med | Med | Start report-only; per-route CSP via nonce | Security |
| **R-16** | Migration RLS rollout breaks prod read paths | Med | High | Shadow mode (log only) for 1 week; dual-read comparison | BE Lead |
| **R-17** | k6 results don't match real-user load | Med | Med | Compare with Sentry performance + real-user RUM (Vercel Analytics) | QA |
| **R-18** | Mutation testing flakes (Stryker) | Med | Low | Run on a schedule, not per-PR; quarantine flaky mutants | QA |
| **R-19** | Playwright E2E flakiness on CI | High | Med | "10 commandments" enforced (no `waitForTimeout`, network-first, etc.) | QA |
| **R-20** | Team capacity drop (illness, leave) in critical weeks | Med | High | Buffer built into Phase 0–1; pair-program on critical-path items | Lead |

---

## 16. Success Metrics / KPIs

### 16.1 Product KPIs (post-launch, 30-day window)

| KPI | Target | Source |
|---|---|---|
| Daily Active Users (DAU) / MAU | ≥ 30 % | analytics |
| Median session length | ≥ 12 min | analytics |
| WP created per DAU per day | ≥ 5 | analytics |
| Comments per WP | ≥ 1.5 | analytics |
| Mobile share of DAU | ≥ 25 % | analytics |
| NPS (in-app survey) | ≥ 30 | survey |

### 16.2 Engineering KPIs

| KPI | Target | Window | Source |
|---|---|---|---|
| Uptime | ≥ 99.9 % | 30-day rolling | uptime monitor |
| p95 API latency | < 60 ms WP list | 7-day rolling | Sentry perf |
| p95 SSE delivery | < 250 ms | 7-day rolling | custom |
| Lighthouse perf | ≥ 90 | per PR | LHCI |
| Bundle per route (gz) | < 250 KB | per PR | bundle-analyzer |
| Coverage (line) | ≥ 70 % | per PR | Vitest |
| Mutation score (critical) | ≥ 60 % | weekly | Stryker |
| k6 1 000-user smoke | pass | nightly | k6 |
| E2E flake rate | < 1 % | 30-day rolling | Playwright |
| Mean time to recover (MTTR) | < 30 min | quarterly drill | PagerDuty |
| CI build time | < 6 min | per run | GitHub Actions |
| Deploy frequency | ≥ 5 / week | 30-day rolling | GitHub |
| Change failure rate | < 10 % | 30-day rolling | DORA |
| Lead time for changes | < 1 day | 30-day rolling | DORA |

### 16.3 Security KPIs

| KPI | Target | Source |
|---|---|---|
| Critical CVEs open | 0 | npm audit + Snyk |
| High CVEs open | < 3 | npm audit + Snyk |
| Mean time to patch (critical) | < 24 h | tracking |
| Failed login rate | < 1 % | logs |
| False positive rate on rate limit | < 0.1 % | logs |
| Pen-test findings (3rd party) | 0 critical, < 5 high | annual |

---

## 17. Migration Strategy — Zero-Downtime, Feature Flags, Canary

### 17.1 Current state (today's `openproject-rewrite`)

The current Next.js app **is** the v1. There is no Rails BFF in front (despite [09 §19.10](#appendix-a-quick-reference-index) hinting at one). So our "migration" is internal — we replace the codebase in place, behind feature flags.

### 17.2 Feature flag strategy

- **Provider**: `unleash-client` (self-hosted) **OR** `flagsmith` (cloud free tier) — see Open Q.
- **Granularity**: per-user, per-org, per-route.
- **Default**: OFF for new flags. Each flag has a `kill switch`.
- **Flag inventory at launch**:
  - `wp_table_v2` (default OFF) — new virtualized WP table
  - `wp_detail_v2` (default OFF) — split-pane detail
  - `realtime_sse` (default OFF) — SSE delivery
  - `presence_v1` (default OFF) — presence indicators
  - `soft_delete_v1` (default ON for new rows) — soft-delete middleware
  - `rls_enforce` (default OFF; shadow mode first) — RLS
  - `mfa_required_admin` (default OFF) — MFA for admins
  - `dark_mode` (default ON for orgs opted in)

### 17.3 Rollout sequence

```
Week 16, Mon ──► Internal team (org = "internal")
Week 16, Tue ──► 5 % of opt-in beta orgs (canary)
Week 16, Wed ──► 25 % of opt-in beta orgs
Week 16, Thu ──► 100 % of opt-in beta orgs (if SLOs green)
Week 17       ──► GA (all orgs)
```

**Canary SLO gate** (auto-rollback on any of):
- Error rate > 1 % for 5 min
- p95 latency > 2× baseline for 10 min
- Sentry issue rate > 5× baseline
- Any Sentry "fatal" event

### 17.4 Zero-downtime deployment

- **Vercel**: instant rollback via `vercel rollback` (alias swap).
- **DB migrations**: expand-contract pattern only; never destructive in same deploy.
  - Expand: add column / table / index (non-breaking).
  - Migrate: dual-write for one cycle.
  - Contract: drop column / table in a follow-up release after validation.
- **SSE/WS**: blue-green; drain old workers for 60 s before SIGTERM.

### 17.5 Rollback playbook

1. Identify flag causing regression → flip to OFF.
2. If Sentry/perf issue at platform level → `vercel rollback` to last green.
3. If DB migration broke → manual SQL rollback (always have a `down` migration).
4. Post-mortem within 24 h; update §15 risk register.

---

## 18. Dependency Graph

```mermaid
graph TD
  P0[Phase 0: Critical Fixes<br/>Wk 1] --> P1[Phase 1: Foundation<br/>Wk 2-4]
  P1 --> P2[Phase 2: Core Features<br/>Wk 5-8]
  P2 --> P3[Phase 3: Collaboration<br/>Wk 9-10]
  P3 --> P4[Phase 4: Performance<br/>Wk 11-12]
  P4 --> P5[Phase 5: DevOps<br/>Wk 13-14]
  P5 --> P6[Phase 6: Polish<br/>Wk 15-16]
  P6 --> GA[GA Launch<br/>Wk 17]

  subgraph P0_Tasks
    P0A[SEC-1: 1-arg getServerSession] --> P0B[SEC-2: withApiAuth]
    P0B --> P0C[SEC-3: Security headers]
    P0C --> P0D[SEC-7: Zod validation]
  end

  subgraph P1_Tasks
    P1A[UX-1: Design tokens] --> P1B[UX-7: AppShell]
    P1B --> P1C[FE-3: Zustand slices]
    P1C --> P1D[FE-9: Folder refactor]
    P1D --> P1E[SEC-6: PDP]
    P1E --> P1F[PERF-1: Virtualize table]
    P1F --> P1G[DB-2: Covering index]
  end

  subgraph P2_Tasks
    P2A[DB-8: Journal] --> P2B[API-5: If-Match]
    P2B --> P2C[RT-4: Outbox]
    P2C --> P2D[RT-5: SSE handler]
    P2D --> P2E[RT-6: Presence]
  end

  subgraph P4_Tasks
    P4A[DB-2 verify] --> P4B[PERF-4: Redis cache]
    P4B --> P4C[PERF-5: Materialized views]
    P4C --> P4D[PERF-3: Dynamic imports]
    P4D --> P4E[TEST-9: k6]
  end
```

The critical path is **P0A → P0B → P0C → P0D → P1E → P1F → P1G → P2D → P2E → P4A → P4E → GA** (~16 weeks).

---

## 19. Team Structure & Parallel Workstreams

### 19.1 Team (assumed 6 engineers + 1 designer + 1 PM)

| Person | Role | Primary phases |
|---|---|---|
| **Alex** | Lead Architect | 0, 1, 4, 6 (also code review gate) |
| **Bea** | Security Lead | 0, 1, 5, 6 |
| **Cam** | BE Lead | 1, 2, 4, 5 |
| **Dee** | FE Lead | 1, 2, 3, 4 |
| **Eli** | Realtime Lead | 2, 3, 5 |
| **Fae** | DevOps Lead | 5 (CI/CD), 6 (runbooks) |
| **Gus** | QA Lead | 4, 5, 6 |
| **Han** | Designer | 1, 2, 6 |
| **PM** | Ivy | All phases |

### 19.2 Parallel work matrix

| Week | Alex | Bea | Cam | Dee | Eli | Fae | Gus | Han |
|---|---|---|---|---|---|---|---|---|
| **1** | Lead SEC-1/2/3 review | SEC-1,2,3,4,5 | SEC-7 (Zod) | SEC-7 (Zod forms) | — | — | — | Tokens prep |
| **2** | Tokens + ADR | — | — | AppShell, RHF, nuqs | — | — | — | Wireframes |
| **3** | Refactor codemod | PDP | API-4 envelope | Component tiers, stories | — | — | — | Component review |
| **4** | Indexes | — | DB-1/2/3/6 | Virtualize table | — | — | MSW | — |
| **5** | — | — | DB-8, DataLoader | Detail page | — | — | — | Detail wireframe |
| **6** | — | — | Bulk, FTS, upload | Forms, editor | — | — | — | — |
| **7** | — | — | Outbox worker | SSE wire in WPTable | SSE handler | — | — | — |
| **8** | — | — | Journal + lockVersion | Presence UI | Presence + WS | — | — | — |
| **9** | — | — | Notification API | Comments, mentions | Notification SSE | — | — | — |
| **10** | — | — | Attachments | Attachment UI | WS (typing, cursor) | — | — | — |
| **11** | — | — | Indexes, mat-views, cache | Bundle, tree-shake | — | — | — | — |
| **12** | — | — | — | — | — | — | k6 | — |
| **13** | — | — | — | — | — | CI/CD, observability | — | — |
| **14** | — | — | RLS prod | — | Realtime deploy | Vercel, Neon, Upstash | — | — |
| **15** | — | MFA, sessions | — | A11y fixes | — | — | A11y audit | A11y design |
| **16** | — | OWASP final | — | — | — | — | Mutation, RBAC matrix | — |

### 19.3 Pair-programming rules

- **Critical-path items** (Phase 0, PDP, outbox, SSE handler) are pair-programmed.
- **PRs touching `lib/auth.ts`, `lib/access/`, or migration files** require 2 reviewers.
- **Security PRs** require Bea's approval before merge.

---

## 20. Open Questions

These need answers before / during early phases. Default answers are provided where possible.

| # | Question | Default if no answer | Phase to resolve |
|---|---|---|---|
| **OQ-1** | Is the doc 10 (`10-workflow-features.md`) going to be produced? It is missing from `revamp-v2/design/`. | Assume the 9 expert docs cover features implicitly; P2 list above is the de-facto doc 10. | Before Phase 1 |
| **OQ-2** | Feature flag provider: Unleash (self-host) vs Flagsmith (cloud) vs Vercel Edge Config (simple)? | **Default:** Vercel Edge Config for v2 (simple, cheap); migrate to Unleash in v2.1. | Phase 5 |
| **OQ-3** | Realtime transport: pure SSE vs SSE + WS hybrid? | **Default (per [06 §4.2](#appendix-a-quick-reference-index)):** SSE + WS hybrid. | Phase 3 |
| **OQ-4** | Multi-tenancy: per-row `orgId` vs RLS? | **Default (per [04 §4.2](#appendix-a-quick-reference-index)):** RLS, phased rollout. | Phase 2 |
| **OQ-5** | Are we OK with a single-region deploy for v2? | **Default:** Yes; multi-region is v2.1. | Phase 5 |
| **OQ-6** | Self-host fallback needed for Day 1, or Day 90? | **Default:** Day 90; Cloudflare Tunnel opt-in. | Phase 5 |
| **OQ-7** | What is the SCIM scope (full provisioning or just deprovisioning)? | **Default:** Deprovisioning only in v2; full in v2.1. | Phase 6 |
| **OQ-8** | Do we ship a public API in v2 or behind a feature flag? | **Default:** Behind `public_api` flag in v2; GA in v2.1. | Phase 5 |
| **OQ-9** | Is dark mode GA or opt-in at launch? | **Default:** Opt-in per org at launch; GA in v2.1. | Phase 6 |
| **OQ-10** | SAML: which IdPs to support in v2? | **Default:** Okta + Azure AD + Google Workspace. | Phase 6 |
| **OQ-11** | MFA: TOTP-only, or TOTP + WebAuthn + SMS? | **Default:** TOTP + WebAuthn; SMS in v2.1. | Phase 6 |
| **OQ-12** | Are we OK with WCAG 2.1 AA in v2, with AAA in v2.1? | **Default:** Yes. | Phase 6 |
| **OQ-13** | Pen test: 3rd-party in v2 or v2.1? | **Default:** Internal review in v2; 3rd-party in v2.1. | Phase 6 |
| **OQ-14** | Localization: English-only at launch? | **Default:** Yes; i18n framework in v2.1. | Phase 6 |
| **OQ-15** | Mobile: PWA only? | **Default:** Yes (per §1.4). | Phase 6 |

---

## 21. Appendix A — Quick Reference Index

### 21.1 Back-link to each expert doc

- [01-uiux-design.md](01-uiux-design.md) — UI/UX (3 645 lines)
- [02-frontend-architecture.md](02-frontend-architecture.md) — Frontend (3 471 lines)
- [03-backend-api.md](03-backend-api.md) — Backend/API (3 402 lines)
- [04-database-schema.md](04-database-schema.md) — Database (2 329 lines)
- [05-security.md](05-security.md) — Security (3 072 lines)
- [06-realtime.md](06-realtime.md) — Realtime (2 523 lines)
- [07-devops.md](07-devops.md) — DevOps (3 820 lines)
- [08-testing.md](08-testing.md) — Testing (2 934 lines)
- [09-performance.md](09-performance.md) — Performance (2 707 lines)
- [10-workflow-features.md](10-workflow-features.md) — **NOT PRODUCED** (see OQ-1)

### 21.2 Key sections per doc

| Doc | Key § |
|---|---|
| 01 UI/UX | §1 Principles, §2 Tokens, §8 Components, §10 A11y, §11 Wireframes (52 pages), §15 Tailwind v4, §16 Dark mode |
| 02 Frontend | §3 Principles, §4 Folder refactor, §5 Components, §6 State, §7 Data fetching, §8 Routing, §9 Perf |
| 03 Backend | §3 REST+tRPC decision, §4 URL structure, §5 HTTP semantics, §6 Response format, §7 Errors, §8 Auth/RBAC, §9 Rate limit, §10 Zod |
| 04 Database | §3 Principles, §4 RLS multi-tenancy, §5 Soft delete, §6 AuditLog, §7 Journaling, §8 FK rules, §9 Enums, §10 FTS, §11 Indexes |
| 05 Security | §3 Top 5 critical, §4 Auth, §5 RBAC+ABAC, §6 API sec, §7 Data sec, §8 Input sec, §9 Audit/monitoring, §10 OWASP |
| 06 Realtime | §3 Goals, §4 SSE+WS hybrid, §5 Event system, §6 Channels, §7 Redis pub/sub, §8 Reconnect, §9 Presence, §10 Optimistic concurrency |
| 07 DevOps | §3 Architecture, §4 CI/CD, §5 Containers, §6 Local dev, §7 Vercel+Railway, §8 Neon, §9 Upstash, §10 Monitoring, §11 Perf engineering, §12 Prod sec, §13 k6, §14 DR, §15 CF Tunnel, §18 Migration, §19 Runbooks |
| 08 Testing | §1 Vision, §3 Pyramid, §4 Unit (Vitest), §5 Component (RTL), §6 Hooks (MSW), §7 API integration, §8 E2E (Playwright) |
| 09 Performance | §2 SLOs, §3 Frontend, §4 Data fetching, §5 Caching, §6 Realtime perf, §7 Indexes, §8 Monitoring, §13 k6, §19 Cost |

### 21.3 Key files in current repo

| File | Role |
|---|---|
| `lib/auth.ts` | NextAuth.js v5 config |
| `lib/prisma.ts` | Prisma client singleton |
| `prisma/schema.prisma` | 56 models |
| `pages/api/` | REST API routes (14+ directories) |
| `pages/` | Top-level pages (14+) |
| `stores/ui-store.ts` | Zustand UI state |
| `hooks/use-*.ts` | TanStack Query hooks |
| `sentry.client.config.ts` / `sentry.server.config.ts` | Sentry wiring |
| `middleware.ts` | Auth redirect (will expand) |
| `next.config.ts` / `next.config.js` | Next config (both exist; reconcile) |
| `vercel.json` | Vercel config |
| `railway.toml` | Railway fallback config |
| `k6/` | Existing k6 smoke + load tests |
| `__tests__/` | Test directory |
| `agent-skills/` | AI agent skills |
| `revamp-v2/` | v2 revamp documents (this file) |
| `wiki/` | Phase specs (Phase 1–6 + roadmap + remaining-issues) |

---

## 22. Appendix B — Acceptance Criteria per Phase

### Phase 0 — Critical Fixes (Week 1)

- [ ] Zero `getServerSession(...)` 1-arg calls in `pages/api/**` (grep returns 0)
- [ ] `withApiAuth` used in 100 % of `pages/api/**` (grep counts 100 %)
- [ ] `curl -I` on `/api/v1/health` returns all 6 security headers
- [ ] LDAP injection test passes (3 payloads sanitized)
- [ ] WebAuthn challenge persists 5 min, expires after
- [ ] Rate limit on `/api/auth/*` returns 429 on 11th request / min
- [ ] CORS preflight returns correct origin
- [ ] CSRF blocks POST without token
- [ ] DOMPurify strips `<img onerror>` payloads
- [ ] Lead + Security Lead sign off

### Phase 1 — Foundation (Weeks 2–4)

- [ ] All 88+ design tokens defined and used
- [ ] Tailwind v4 `@theme inline` configured; no `tailwind.config.ts` colors
- [ ] `src/domains/*` structure in place; old `services/` shim works
- [ ] `<AppShell/>` renders on all authed pages
- [ ] Dark mode toggle works
- [ ] nuqs drives WP list URL state
- [ ] RHF + Zod forms work for create / edit
- [ ] `<WPTable/>` virtualized; 1 000 rows render smoothly
- [ ] PDP covers 3 base roles with inheritance
- [ ] 7 hot tables use soft-delete middleware
- [ ] 5 covering/partial indexes live
- [ ] 200+ tests; coverage ≥ 60 %
- [ ] Lead + FE Lead + BE Lead sign off

### Phase 2 — Core Features (Weeks 5–8)

- [ ] WP detail page v2 live at `/projects/[id]/work-packages/[wp]`
- [ ] Create / edit / bulk forms work end-to-end
- [ ] `WorkPackageJournal` writes on every mutation
- [ ] `If-Match` returns 412 on stale writes
- [ ] Idempotency keys work (replay returns same result)
- [ ] Outbox worker lag < 200 ms p95
- [ ] SSE delivers WP updates to viewers within 1 s
- [ ] Presence indicator shows online users
- [ ] `lockVersion` enforced in event payload
- [ ] Coverage ≥ 65 %

### Phase 3 — Collaboration (Weeks 9–10)

- [ ] Comments work with @mentions
- [ ] Notification dropdown updates live via SSE
- [ ] Attachments upload to S3 with presigned URLs
- [ ] Typing indicators on WP detail
- [ ] Mutation score ≥ 50 % on `lib/realtime/`
- [ ] Coverage ≥ 68 %

### Phase 4 — Performance (Weeks 11–12)

- [ ] API p95 < 60 ms on WP list (k6 load test)
- [ ] LCP p75 < 2.0 s on WP list (Lighthouse CI on PR)
- [ ] Bundle per route < 250 KB gz
- [ ] k6 smoke + load + stress pass at 1 000 concurrent users
- [ ] Materialized views refreshed every 60 s
- [ ] Negative caching works (404 TTL 10 s)

### Phase 5 — DevOps & Reliability (Weeks 13–14)

- [ ] CI green on `main` for 5 consecutive days
- [ ] Sentry capturing errors with source maps
- [ ] Prometheus `/metrics` scraping
- [ ] Uptime monitor alerts PagerDuty
- [ ] DR drill: simulated DB failure → recovery < 30 min
- [ ] RLS in shadow mode for 7 days; 0 false positives

### Phase 6 — Polish, A11y, Hardening (Weeks 15–16)

- [ ] WCAG 2.1 AA passes (axe + manual)
- [ ] MFA enforced for admin role
- [ ] Session management: 30-day rolling, force re-auth on sensitive ops
- [ ] OAuth + SAML + SCIM (Enterprise tier) live
- [ ] Mutation score ≥ 60 % on `services/` and `lib/access/`
- [ ] E2E flake rate < 1 %
- [ ] Visual regression baseline (20 screens) committed
- [ ] RBAC matrix test (full grid) passes
- [ ] Launch readiness review signed by Lead + Security + Product + DevOps + QA

---

## 22.1 Phase 0 — Detailed code patterns

### 22.1.1 `withApiAuth` signature (canonical)

```ts
// lib/api/with-api-auth.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applySecurityHeaders } from '@/lib/security-headers';
import { rateLimit } from '@/lib/rate-limit';
import { Sentry } from '@/lib/sentry';

export type AuthOptions = {
  requireAuth?: boolean;          // default true
  requiredRoles?: string[];        // e.g. ['admin', 'project_manager']
  rateLimit?: { bucket: string; limit: number; window: `${number}s` };
  csrf?: boolean;                  // default true for non-GET
};

export function withApiAuth(
  handler: (req: NextApiRequest, res: NextApiResponse, session: Session) => Promise<void> | void,
  opts: AuthOptions = {},
): NextApiHandler {
  return async (req, res) => {
    try {
      applySecurityHeaders(res);

      // 1. Rate limit (always, even pre-auth)
      if (opts.rateLimit) {
        const ok = await rateLimit(req, opts.rateLimit);
        if (!ok) { res.status(429).json({ error: { code: 'rate_limited' } }); return; }
      }

      // 2. CSRF (default on for state-changing)
      if (opts.csrf !== false && req.method && !['GET','HEAD','OPTIONS'].includes(req.method)) {
        const valid = await validateCsrfToken(req);
        if (!valid) { res.status(403).json({ error: { code: 'csrf_invalid' } }); return; }
      }

      // 3. Session
      const session = await getServerSession(req, res, authOptions);
      if (opts.requireAuth !== false && !session) {
        res.status(401).json({ error: { code: 'unauthenticated' } });
        return;
      }

      // 4. Role check
      if (opts.requiredRoles && !opts.requiredRoles.some(r => session?.user.roles.includes(r))) {
        res.status(403).json({ error: { code: 'forbidden' } });
        return;
      }

      // 5. Handler
      await handler(req, res, session!);
    } catch (err) {
      Sentry.captureException(err, { extra: { route: req.url, method: req.method } });
      res.status(500).json({ error: { code: 'internal_error' } });
    }
  };
}
```

### 22.1.2 Security headers (canonical)

```ts
// lib/security-headers.ts
import type { NextApiResponse } from 'next';

export function applySecurityHeaders(res: NextApiResponse): void {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'nonce-{NONCE}' https://*.sentry.io",
    "style-src 'self' 'unsafe-inline'",  // Tailwind v4 needs inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.sentry.io wss://*.upstash.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
}
```

### 22.1.3 LDAP injection fix (canonical)

```ts
// lib/ldap/client.ts
import ldapjs from 'ldapjs';

// BAD: const filter = `(uid=${username})`;
// GOOD:
export function safeUserFilter(username: string): string {
  // ldapjs escapes *, (, ), \, NUL
  return `(uid=${ldapjs.escapeFilter(username)})`;
}

// BAD: const dn = `uid=${username},ou=users,dc=example,dc=com`;
// GOOD:
export async function resolveUserDN(username: string): Promise<string> {
  const parsed = ldapjs.parseDN(`uid=${ldapjs.escapeDN(username)},ou=users,dc=example,dc=com`);
  return parsed.toString();
}
```

### 22.1.4 WebAuthn challenge storage (canonical)

```ts
// lib/webauthn/store.ts
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export async function persistChallenge(userId: string, challenge: string): Promise<void> {
  await redis.set(`webauthn:challenge:${userId}`, challenge, { ex: 300 }); // 5 min
}

export async function consumeChallenge(userId: string): Promise<string | null> {
  const value = await redis.getdel<string>(`webauthn:challenge:${userId}`);
  return value;
}
```

## 22.2 Phase 1 — Detailed code patterns

### 22.2.1 Design tokens file (excerpt)

```css
/* styles/tokens.css */
:root {
  /* Color — Primary (Indigo) */
  --color-primary-50:  #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;  /* default primary */
  --color-primary-700: #4338ca;
  --color-primary-800: #3730a3;
  --color-primary-900: #312e81;

  /* Color — Neutral (Slate) */
  --color-neutral-0:   #ffffff;
  --color-neutral-50:  #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  /* Surfaces (semantic) */
  --color-surface-canvas: var(--color-neutral-50);
  --color-surface-raised:  var(--color-neutral-0);
  --color-surface-sunken:  var(--color-neutral-100);
  --color-surface-overlay: rgb(15 23 42 / 0.5);
  --color-surface-sidebar: var(--color-neutral-0);
  --color-surface-topbar:  var(--color-neutral-0);

  /* Text (semantic) */
  --color-text-default:  var(--color-neutral-900);
  --color-text-muted:    var(--color-neutral-500);
  --color-text-subtle:   var(--color-neutral-400);
  --color-text-onPrimary: var(--color-neutral-0);
  --color-text-link:     var(--color-primary-600);

  /* Borders */
  --color-border-subtle: var(--color-neutral-200);
  --color-border-default: var(--color-neutral-300);
  --color-border-strong: var(--color-neutral-400);
  --color-border-focus: var(--color-primary-500);
  --color-border-divider: var(--color-neutral-100);
  --color-border-ring: rgb(99 102 241 / 0.3);

  /* Spacing (4px base) */
  --space-0: 0;
  --space-1: 0.25rem; /* 4 */
  --space-2: 0.5rem;  /* 8 */
  --space-3: 0.75rem; /* 12 */
  --space-4: 1rem;    /* 16 */
  --space-6: 1.5rem;  /* 24 */
  --space-8: 2rem;    /* 32 */
  --space-12: 3rem;   /* 48 */
  --space-16: 4rem;   /* 64 */
  --space-24: 6rem;   /* 96 */

  /* Radius */
  --radius-none: 0;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* Duration & ease */
  --duration-instant: 0ms;
  --duration-fast:    150ms;
  --duration-base:    200ms;
  --duration-slow:    300ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-index scale */
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-tooltip: 70;
  --z-toast: 80;
}

[data-theme='dark'] {
  --color-surface-canvas: var(--color-neutral-900);
  --color-surface-raised:  var(--color-neutral-800);
  --color-surface-sunken:  rgb(0 0 0 / 0.3);
  --color-surface-sidebar: var(--color-neutral-800);
  --color-surface-topbar:  var(--color-neutral-800);
  --color-text-default:  var(--color-neutral-50);
  --color-text-muted:    var(--color-neutral-400);
  --color-text-subtle:   var(--color-neutral-500);
  --color-border-subtle: var(--color-neutral-700);
  --color-border-default: var(--color-neutral-600);
}
```

### 22.2.2 `src/` folder refactor (full target tree)

```
src/
  domains/
    work-packages/
      api/                  # pages/api/v1/work-packages/* moved here as services
      components/           # WPTable, WPDetail, WPForm, WPBadge, WPTypeIcon
      hooks/                # useWorkPackage, useWorkPackageList, useUpdateWorkPackage
      services/             # createWorkPackage, updateWorkPackage (domain logic)
      repositories/         # wpRepository (Prisma queries)
      validators/           # workPackageSchema, workPackageFilterSchema (Zod)
      types.ts
      index.ts              # barrel: public surface
    projects/
      api/
      components/           # ProjectCard, ProjectList, MemberList
      hooks/
      services/
      repositories/
      validators/
      types.ts
      index.ts
    users/
      api/
      components/           # UserAvatar, UserMention, UserSelect
      hooks/
      services/
      repositories/
      validators/
      types.ts
      index.ts
    notifications/
      components/           # NotificationBell, NotificationDropdown, NotificationItem
      hooks/
      services/
      repositories/
      types.ts
      index.ts
    collaboration/
      components/           # CommentList, CommentForm, AttachmentDrop
      hooks/
      services/
      types.ts
      index.ts
    reporting/
      services/             # read from materialized views
      types.ts
      index.ts
    admin/
      components/           # Settings, CustomField, RoleEditor
      hooks/
      services/
      types.ts
      index.ts
  shared/
    rbac/
      pdp.ts                # permission decision point
      policies/             # per-domain policy modules
      types.ts
      index.ts
    realtime/
      bus.ts                # in-process + outbox writer
      channels.ts           # channel naming + resolution
      envelope.ts           # event schema (Zod)
      outbox-worker.ts      # separate process
      presence.ts
      types.ts
      index.ts
    audit/
      writer.ts             # writes to AuditLog
      readers.ts
      types.ts
      index.ts
    infra/
      prisma.ts             # singleton
      redis.ts              # Upstash client
      s3.ts                 # S3 client + presigner
      sentry.ts             # Sentry init
      log.ts                # pino logger
      metrics.ts            # prom-client registry
      types.ts
      index.ts
  components/
    ui/                     # Radix-wrapped primitives (Button, Input, Select, …)
    composite/              # cross-domain composites (DataTable, EmptyState, Skeleton)
    feature/                # rarely-shared feature widgets
  lib/
    api/
      with-api-auth.ts
      with-role.ts
      with-json.ts
      envelope.ts
      errors.ts
      idempotency.ts
    auth.ts                 # NextAuth v5 config
    access/                 # legacy PDP location; re-export from shared/rbac
    prisma.ts               # legacy; re-export from shared/infra
    security-headers.ts
    rate-limit.ts
    query-client.ts
    csrf.ts
    utils/
  styles/
    tokens.css
    globals.css
    tailwind.css
  types/
    env.d.ts
    api.d.ts
    global.d.ts
```

### 22.2.3 AppShell component (canonical)

```tsx
// components/composite/AppShell.tsx
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useUiStore } from '@/stores/use-ui-store';
import { cn } from '@/lib/utils';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const sidebarCollapsed = useUiStore(s => s.sidebarCollapsed);
  return (
    <div className="min-h-screen bg-surface-canvas text-text-default">
      <Topbar />
      <div className="flex">
        <Sidebar collapsed={sidebarCollapsed} />
        <main
          className={cn(
            'flex-1 transition-[padding] duration-base ease-out',
            sidebarCollapsed ? 'pl-64' : 'pl-16',
            'pt-12', // topbar height
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 22.2.4 Virtualized WPTable (canonical)

```tsx
// domains/work-packages/components/WPTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

type Row = { id: string; subject: string; status: string; assignee?: { name: string } };
type Props = { rows: Row[] };

export function WPTable({ rows }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32, // 32-px rows
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto border border-border-subtle rounded-md">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full h-8 flex items-center px-3 border-b border-border-subtle hover:bg-surface-sunken"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <span className="w-24 text-text-muted text-sm">{row.id}</span>
              <span className="flex-1 text-sm">{row.subject}</span>
              <span className="w-20 text-xs">{row.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## 22.3 Phase 2 — Detailed code patterns

### 22.3.1 Outbox table + worker (canonical)

```prisma
// prisma/schema.prisma (excerpt)
model OutboxEvent {
  id          String   @id @default(cuid())
  channel     String   // e.g. "org:acme:project:webapp:work-package"
  type        String   // e.g. "wp.updated"
  payload     Json
  createdAt   DateTime @default(now())
  publishedAt DateTime?
  attempts    Int      @default(0)

  @@index([publishedAt, createdAt]) // worker polls unpublished
  @@map("outbox_events")
}
```

```ts
// shared/realtime/outbox-worker.ts
import { prisma } from '@/shared/infra/prisma';
import { redis } from '@/shared/infra/redis';

const POLL_INTERVAL_MS = 100;
const BATCH_SIZE = 50;

export async function pollOutbox(): Promise<void> {
  while (true) {
    const events = await prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const event of events) {
      try {
        await redis.publish(event.channel, JSON.stringify({
          v: 1,
          type: event.type,
          ts: event.createdAt.toISOString(),
          channel: event.channel,
          data: event.payload,
        }));
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });
      } catch (err) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { attempts: { increment: 1 } },
        });
      }
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}
```

### 22.3.2 SSE handler (canonical)

```ts
// pages/api/v1/sse.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { redis, redisSub } from '@/shared/infra/redis';
import { resolveUserChannels } from '@/shared/realtime/channels';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { withApiAuth } from '@/lib/api/with-api-auth';

const HEARTBEAT_MS = 25_000;

export default withApiAuth(async (req: NextApiRequest, res: NextApiResponse, session) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const channels = await resolveUserChannels(session.user.id);
  const lastEventId = req.headers['last-event-id'] as string | undefined;

  // Subscribe
  const subscriber = redisSub();
  for (const ch of channels) await subscriber.subscribe(ch);
  subscriber.on('message', (channel, message) => {
    const event = JSON.parse(message);
    res.write(`id: ${event.ts}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  });

  // Replay missed events from outbox
  if (lastEventId) {
    const missed = await prisma.outboxEvent.findMany({
      where: { channel: { in: channels }, createdAt: { gt: new Date(lastEventId) } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const e of missed) {
      res.write(`id: ${e.createdAt.toISOString()}\nevent: ${e.type}\ndata: ${JSON.stringify(e.payload)}\n\n`);
    }
  }

  // Heartbeat
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);

  // Cleanup
  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.quit();
    res.end();
  });
}, { requireAuth: true, rateLimit: { bucket: 'sse', limit: 10, window: '60s' } });
```

## 22.4 Phase 3 — Detailed code patterns

### 22.4.1 WebSocket handler (canonical)

```ts
// pages/api/v1/ws.ts
import { WebSocketServer } from 'ws';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { withApiAuth } from '@/lib/api/with-api-auth';
import { redis } from '@/shared/infra/redis';

export const config = { api: { bodyParser: false } };

export default withApiAuth(async (req: NextApiRequest, res: NextApiResponse, session) => {
  // Lazy-attach WS server
  if (!res.socket.server.wss) {
    const wss = new WebSocketServer({ noServer: true });
    res.socket.server.wss = wss;
    res.socket.server.on('upgrade', (req, socket, head) => {
      // Auth on upgrade
      // (validate session token from query string)
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    });
  }
  res.end();
}, { requireAuth: true });
```

### 22.4.2 Typing indicator hook (canonical)

```ts
// shared/realtime/use-typing-indicator.ts
import { useEffect, useRef } from 'react';
import { useWebSocket } from './use-websocket';

export function useTypingIndicator(channel: string) {
  const ws = useWebSocket();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const sendTyping = () => {
    ws?.send(JSON.stringify({ type: 'typing', channel }));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {}, 3000);
  };

  return sendTyping;
}
```

## 22.5 Phase 4 — Detailed code patterns

### 22.5.1 DataLoader factory (canonical)

```ts
// shared/infra/dataloader.ts
import DataLoader from 'dataloader';
import { prisma } from './prisma';

export function makeMemberRoleLoader() {
  return new DataLoader<string, string[]>(async (memberIds) => {
    const memberships = await prisma.member.findMany({
      where: { id: { in: memberIds as string[] } },
      include: { role: true },
    });
    const map = new Map(memberships.map(m => [m.id, m.role.map(r => r.name)]));
    return memberIds.map(id => map.get(id) ?? []);
  });
}
```

### 22.5.2 Materialized view SQL (canonical)

```sql
-- prisma/migrations/.../mv_project_wps_status.sql
CREATE MATERIALIZED VIEW mv_project_wps_status AS
SELECT
  project_id,
  status_id,
  COUNT(*) AS count,
  MAX(updated_at) AS last_updated
FROM work_packages
WHERE deleted_at IS NULL
GROUP BY project_id, status_id;

CREATE UNIQUE INDEX idx_mv_project_status
  ON mv_project_wps_status (project_id, status_id);

-- Refresh every 60s (in pg_cron)
SELECT cron.schedule('refresh-mv-project-wps-status', '60 seconds', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_wps_status;
$$);
```

## 22.6 Phase 5 — Detailed config

### 22.6.1 GitHub Actions CI (canonical)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: .next
```

### 22.6.2 Dockerfile (canonical)

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

### 22.6.3 docker-compose.yml (canonical)

```yaml
# docker-compose.yml
version: '3.9'
services:
  app:
    build: .
    ports: ['3000:3000']
    environment:
      DATABASE_URL: postgresql://dev:dev@db:5432/dev
      REDIS_URL: redis://redis:6379
      NEXTAUTH_SECRET: dev-secret-change-me
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: dev
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev']
      interval: 5s
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
  mailhog:
    image: mailhog/mailhog
    ports: ['1025:1025', '8025:8025']
volumes:
  pgdata:
```

## 22.7 Phase 6 — Detailed patterns

### 22.7.1 MFA enrollment (canonical)

```ts
// lib/auth/mfa.ts
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';

export async function enrollMFA(userId: string): Promise<{ secret: string; qr: string }> {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({ issuer: 'OpenProject', label: userId, secret });
  const otpauth = totp.toString();
  const qr = await QRCode.toDataURL(otpauth);
  await redis.set(`mfa:enroll:${userId}`, secret.base32, { ex: 600 });
  return { secret: secret.base32, qr };
}

export async function verifyMFA(userId: string, token: string): Promise<boolean> {
  const secret = await redis.get<string>(`mfa:secret:${userId}`);
  if (!secret) return false;
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
```

---

## 23. Resolved Conflicts (decisions log)

Where the 9 expert docs disagreed, this spec rules. The top 5 most important resolutions are highlighted.

### 23.1 Top 5 most important decisions

1. **REST primary, tRPC internal** ([03 §3.2](#appendix-a-quick-reference-index))
   - vs the [02](#appendix-a-quick-reference-index) assumption of REST everywhere.
   - **Decision:** REST is the public API; tRPC used internally for `_app.tsx` initial load and admin tools.
   - **Why:** REST enables 3rd-party integrations, public docs, and easy mobile clients; tRPC gives us end-to-end types for internal speed.

2. **Hybrid SSE + WebSocket** ([06 §4.2](#appendix-a-quick-reference-index))
   - vs pure SSE (suggested by some perf-conscious reviewers) and pure WS (suggested by Socket.io fans).
   - **Decision:** SSE for read-only streams (WP updates, notifications, presence); WebSocket for high-frequency (cursor, typing).
   - **Why:** SSE is HTTP/2-friendly, auto-reconnects, works through CDNs. WS is needed for bidirectional sub-100-ms latency (typing). Two protocols, two distinct use cases.

3. **Pages Router only, no App Router** (per `AGENTS.md` + N7)
   - vs migrating to App Router (a common "modern Next.js" suggestion).
   - **Decision:** Stay on Pages Router for v2; App Router migration is a separate v3 initiative.
   - **Why:** 56 models, 14+ page trees, 9-doc design all assume Pages Router. Migration would add 4–6 weeks and risk Phase 0 timeline.

4. **RLS phased rollout** ([04 §4.2](#appendix-a-quick-reference-index) + [09 §4.6](#appendix-a-quick-reference-index))
   - vs "RLS on Day 1" (some security voices) and "No RLS, app-level check" (perf voices).
   - **Decision:** RLS in shadow mode for 1 week, then enforced per route group.
   - **Why:** Per N1–N3 (security wins), RLS is the right long-term answer. Shadow mode mitigates R-16 (production read-path breakage).

5. **Vite + Vitest as the test runner; not Jest** ([08 §4.1](#appendix-a-quick-reference-index))
   - vs "Jest is the standard".
   - **Decision:** Vitest, already in `package.json` (`vitest@4.1.4`).
   - **Why:** Faster, native ESM, native TS, no Babel, integrates with Vite if we add it later. Don't fight the existing choice.

### 23.2 Other resolved conflicts (less critical)

| # | Conflict | Resolution | Source |
|---|---|---|---|
| 6 | Tailwind v4 vs v3 (some docs assume v3 config) | **v4** with `@theme inline` | [01 §15](#appendix-a-quick-reference-index) |
| 7 | `socket.io` vs raw `ws` | **Raw `ws`** + SSE | [06 §4.4](#appendix-a-quick-reference-index) |
| 8 | `axios` vs `fetch` | **Native `fetch`** (Node 20) | [02 §7.3](#appendix-a-quick-reference-index) |
| 9 | PostgreSQL enums vs string columns | **Enums for status/priority/type**, strings for everything else | [04 §9.2](#appendix-a-quick-reference-index) |
| 10 | Soft delete vs hard delete | **Soft delete by default** for 7 hot tables; hard delete elsewhere | [04 §5](#appendix-a-quick-reference-index) |
| 11 | Per-row `orgId` vs RLS | **RLS** (with `orgId` column) | [04 §4.2](#appendix-a-quick-reference-index) |
| 12 | `DataLoader` everywhere vs only on hot paths | **Only on hot paths** (member.role, user.avatar) | [09 §4.2](#appendix-a-quick-reference-index) |
| 13 | k6 in CI per PR vs nightly | **Smoke on PR, full suite nightly** | [07 §4.2](#appendix-a-quick-reference-index) + [09 §13](#appendix-a-quick-reference-index) |
| 14 | Mutation testing per PR vs scheduled | **Scheduled (weekly)** for v2; per-PR for v2.1 | [08 §3.4](#appendix-a-quick-reference-index) |
| 15 | Single-region vs multi-region | **Single region** for v2 | [07 §3.2](#appendix-a-quick-reference-index) |
| 16 | Storybook Chromatic deploy in v2 | **Deferred to v2.1**; stories required, deploy not | [02 §5.5](#appendix-a-quick-reference-index) |
| 17 | Feature flag provider | **Vercel Edge Config** (simple) for v2; Unleash in v2.1 | OQ-2 |
| 18 | MCP / GraphQL public API | **Deferred to v2.1**; v2 API is REST only | [03 §3.1](#appendix-a-quick-reference-index) |

---

## 24. Final Notes

- **This is a living document.** Update it when the 10th expert doc is produced, when OQs are answered, and at the end of every phase retro.
- **The §5 priority matrix is the single source of truth for what goes in which phase.** If a doc suggests a P0 item that is not in §5, raise it in standup.
- **The §15 risk register is reviewed weekly.** New risks added; mitigations updated.
- **The §16 KPIs are reviewed at the end of every phase.** Targets are aspirational; we adjust when we have data.
- **The §17 migration strategy is the runbook for launch day.** Print it.

---

**End of master spec.**
