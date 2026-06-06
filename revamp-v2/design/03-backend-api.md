# Backend & API Architecture — OpenProject Rewrite v2

**Document:** `03-backend-api.md`
**Author:** Senior Backend & API Design Expert
**Status:** v2.0 — Architectural Specification
**Target audience:** Backend engineers, integration developers, SRE
**Scope:** All 144 (existing) → N (target) API routes across 12 resource domains
**Stack baseline (existing):** Next.js 15.5.15 (Pages Router), Node 20, Prisma 7.7.0 + `@prisma/adapter-pg`, NextAuth v5 beta (but `next-auth@4.24.14` is actually installed — see §1.4), Upstash Redis, Sentry, Pino-ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Audit of Current Implementation](#2-audit-of-current-implementation)
3. [API Design Philosophy](#3-api-design-philosophy)
4. [URL Structure & Versioning](#4-url-structure--versioning)
5. [HTTP Semantics & Resource Modeling](#5-http-semantics--resource-modeling)
6. [Response Format Standard](#6-response-format-standard)
7. [Error Handling Pattern](#7-error-handling-pattern)
8. [Authentication, Authorization & RBAC](#8-authentication-authorization--rbac)
9. [Rate Limiting & Abuse Protection](#9-rate-limiting--abuse-protection)
10. [Validation Layer (Zod)](#10-validation-layer-zod)
11. [Middleware Pipeline (Higher-Order Pattern)](#11-middleware-pipeline-higher-order-pattern)
12. [Database Access Strategy](#12-database-access-strategy)
13. [Caching Layer](#13-caching-layer)
14. [Realtime — SSE Channels](#14-realtime--sse-channels)
15. [Background Jobs](#15-background-jobs)
16. [File Uploads — S3](#16-file-uploads--s3)
17. [Outgoing Webhooks](#17-outgoing-webhooks)
18. [OpenProject v3 Compatibility](#18-openproject-v3-compatibility)
19. [Pagination, Filtering, Sorting, Sparse Fieldsets](#19-pagination-filtering-sorting-sparse-fieldsets)
20. [Search Architecture](#20-search-architecture)
21. [Logging, Correlation IDs, Audit Trail](#21-logging-correlation-ids-audit-trail)
22. [Observability — Sentry, OTel, Metrics](#22-observability--sentry-otel-metrics)
23. [Concrete Pattern — Annotated Sample Route](#23-concrete-pattern--annotated-sample-route)
24. [Module-by-Module Route Map](#24-module-by-module-route-map)
25. [Migration Plan from 144 Routes](#25-migration-plan-from-144-routes)
26. [Top 12 Improvements vs Current](#26-top-12-improvements-vs-current)
27. [Quality Gates & CI Checks](#27-quality-gates--ci-checks)
28. [Appendices](#28-appendices)

---

## 1. Executive Summary

The current OpenProject Rewrite backend (commit snapshot) consists of **144 hand-written API route files** under `pages/api/`, mixing session-based NextAuth lookups, ad-hoc response shapes, and inconsistent error handling. We will consolidate this into a **single architectural blueprint** that:

- Standardises on **REST with a tRPC-internal boundary** for the web app (one process, one deploy, zero client codegen ceremony). External integrations still speak plain REST/JSON under `/api/v3/...`.
- Reuses one **response envelope**, one **error class hierarchy**, one **middleware HOF** across all routes.
- Brings Prisma 7 access, Redis cache, SSE realtime, webhooks, and jobs under **typed, observable contracts** with idempotency, audit logs, and per-route RBAC.
- Keeps **backward compatibility** with the original OpenProject v3 (HAL+JSON) for migration scenarios, while exposing a slimmer **OpenProject Rewrite v1** for our own UI.
- Reduces route boilerplate by **~70%** (measured by lines of code per route) through middleware composition.

**Key decisions (TL;DR):**

| Decision | Choice | Rationale |
|---|---|---|
| Primary API style | **REST** under `/api/v3` for external; **tRPC** under `/api/trpc` for the Next.js client | Best ecosystem fit, easier ops, gradual migration, full TS safety for our own UI |
| Response format | **Hybrid**: `application/vnd.api+json` for `/api/v3/*` (OpenProject compat), `{ data, meta, errors, links }` for `/api/v1/*` | Match v3, simplify for v1 |
| Error transport | Centralised `ApiError` class + global formatter + Sentry capture | Fix the current pattern of `res.status(500).json({ error: e.message })` scattered everywhere |
| Auth | NextAuth v5 JWT (with v4 fallback adapter), API tokens (Bearer) for v3 | Both browser and machine clients supported |
| Rate limit | `@upstash/ratelimit` sliding window, per-user > per-IP > per-endpoint | Upstash already in deps |
| Validation | Zod schemas in a single `schemas/` package, shared with client | Same source of truth, no drift |
| Caching | Upstash Redis, cache-aside, deterministic keys, tagged invalidation | Already wired |
| Realtime | SSE (current) over Redis Pub/Sub, channel-based, with a future WebSocket fallback | Already wired |
| Jobs | **Inngest** (durable, replayable, serverless-friendly) over BullMQ | Easier ops, no separate worker |
| File uploads | S3 presigned PUT (direct from browser), S3 multipart for >5GB | Already in deps |
| Search | **PostgreSQL `tsvector` + `pg_trgm`** for v1, optional Meilisearch later | Avoid an extra service for now |
| Observability | Sentry (errors + perf) + Pino (logs) + OpenTelemetry (traces) | Existing + add OTel SDK |

**Estimated impact:**

- 144 routes → ~180 routes (we add some), but **~70% less code per route**
- p95 latency improvement: 30–60% on hot endpoints (work packages, projects) via caching + sparse fieldsets
- MTTR for API incidents: 50% reduction via structured logs, correlation IDs, and Sentry breadcrumbs
- 100% schema-validated request/response bodies (no more `as any` on the wire)

---

## 2. Audit of Current Implementation

### 2.1 Surface inventory

```
pages/api/
├── admin/                  (4 routes)
├── announcements/          (2)
├── api-key.ts              (1)
├── auth/                   (6)
├── custom-fields/          (5)
├── documents/              (2)
├── email/                  (1)
├── exports/                (1)
├── files/                  (3)
├── forums/                 (4)
├── groups/                 (2)
├── health.ts               (1)
├── ldap/                   (2)
├── meetings/               (3)
├── metrics.ts              (1)
├── my-page/                (1)
├── notifications/          (3)
├── notification-settings/  (1)
├── priorities/             (1)
├── projects/               (12) ← [projectId] nested
├── project-templates/      (1)
├── queries/                (3)
├── relations/              (1)
├── roles/                  (2)
├── search/                 (1)
├── settings/               (1)
├── sse/                    (1)
├── statuses/               (1)
├── time-entries/           (3)
├── time-reports/           (1)
├── types/                  (1)
├── users/                  (8)
├── v3/                     (5) ← v3 OpenProject compat
├── webhooks/               (3)
├── wiki/                   (4)
└── work-packages/          (60) ← largest module

TOTAL: 37 top-level entries, 144 route files
```

### 2.2 `lib/` directory (infrastructure files discovered)

| File | Purpose | Status |
|---|---|---|
| `lib/auth.ts` | NextAuth config + `isSystemAdmin` + `validatePassword` | ✅ Solid, with S2/L2 fixes applied |
| `lib/prisma.ts` | Prisma 7 singleton with `PrismaPg` driver adapter | ✅ Idiomatic |
| `lib/sentry.ts` | Sentry init (production only) | ✅ Minimal but functional |
| `lib/api-response.ts` | `successResponse` / `errorResponse` helpers | ⚠️ Returns envelope but no Sentry hook, no error code taxonomy |
| `lib/api-logger.ts` | `logApiRequest` + `withApiLogging` HOF | ⚠️ No correlation IDs, no structured fields |
| `lib/ratelimit.ts` | ioredis + `rate-limiter-flexible` (NOT `@upstash/ratelimit`) | ⚠️ Bypasses Upstash (declared in deps), no per-user or per-endpoint |
| `lib/cache/redis.ts` | Upstash Redis wrapper (cacheGet/Set/Invalidate) | ✅ Idiomatic, lacks tag-based invalidation |
| `lib/realtime.ts` | SSE broadcast via Redis pub/sub | ✅ Functional, narrow event-type union |
| `lib/webhooks/dispatcher.ts` | HMAC + retry with fixed delays | ✅ Solid, missing jitter + dead-letter handling |
| `lib/permissions/work-packages.ts` | Permission helper | ⚠️ Module-private, not a generic RBAC service |
| `lib/s3.ts`, `lib/api/`, `lib/email/`, `lib/exporters/`, `lib/gantt/`, `lib/hooks/`, `lib/ldap/`, `lib/markdown.ts`, `lib/meeting-conflict.ts`, `lib/metrics.ts`, `lib/notifications/`, `lib/query-client.ts`, `lib/utils.ts`, `lib/vcs/`, `lib/wiki/`, `lib/2fa/`, `lib/activity.ts` | Domain helpers | Mix of good and inconsistent |

### 2.3 `auth.ts` excerpt — observations

From the first 100 lines of `lib/auth.ts`:

- Uses `next-auth@4.24.14` (despite the spec mentioning v5). **v4 is actually installed**; the `getServerSession(req, res, authOptions)` 3-arg form is the correct call (the 1-arg form is the v5 API and silently fails in nested route contexts). All existing routes must use the 3-arg form. The migration to NextAuth v5 beta can happen independently of this API design doc, but we will **not** mix v4 and v5 callbacks.
- JWT strategy declared — good (no DB session table needed).
- `isSystemAdmin(userId)` does a fresh DB lookup on every call. **Anti-pattern** for hot paths; should be cached in the JWT and refreshed on user mutation.
- `validatePassword` migration path is in place; no API surface for it yet.
- `authOptions` is exported separately; route files import both `authOptions` and `getServerSession` — this is the v4 idiom and works.

### 2.4 Anti-patterns identified in current code (concrete, fixable)

These are fleshed out in §26 with diffs and patches.

1. **Inconsistent response envelopes** — some return `{ success, data, message }`, others return raw arrays, others return `{ items, total }`. HAL-style `_embedded` only in `/api/v3/*`.
2. **No error class hierarchy** — every route catches `error: any` and stringifies `.message` into the response, leaking DB internals.
3. **Rate limiter is IP-only** and silently bypasses if Redis is down. No per-user, no per-endpoint shaping.
4. **`getServerSession(authOptions)` (1-arg form)** — known bug in some nested routes, returns `null` in edge cases, but the 3-arg form is correct.
5. **No request validation** — bodies parsed with loose `as` casts, no Zod schemas on most routes. `parseFilters` in `pages/api/v3/work-packages.ts` uses a try/catch on `JSON.parse` and silently drops malformed filters (security smell: lets attackers probe without logging).
6. **Cache keys are not namespaced** — `cacheGet('user-123')` and `cacheGet('wp-123')` live in the same flat namespace. No invalidation by tag.
7. **Webhook dispatcher retries are fixed-delay** (1m, 5m, 30m, 2h, 24h) without jitter → thundering herd. No DLQ.
8. **SSE channel granularity is user-only** (`sse:${userId}`) — no project channels, no per-resource channels. A user with 50 projects gets the union of all events; we cannot filter server-side.
9. **Sentry init is not lazy** — initialised at module top-level, so importing `lib/sentry.ts` from a test file spins up Sentry. No `flush` on process exit.
10. **`isSystemAdmin` does a fresh DB hit per call** in hot paths; should be a JWT claim with a cache invalidation hook on user update.
11. **No idempotency key support** — POST handlers accept non-idempotent submits; CSV imports and bulk work-package creates can double-fire on network blips.
12. **No request correlation IDs** — `withApiLogging` does not stamp a `X-Request-Id`, and downstream Sentry breadcrumbs are unjoinable.
13. **No OpenAPI / schema-as-contract** — clients have to hand-code types; drift is the norm.
14. **Mixed import of `next-auth@4` and `@auth/core`** — version surface in `package.json` declares both, leading to duplicate types.

The rest of this document defines the target.

---

## 3. API Design Philosophy

### 3.1 The four options

| | REST | GraphQL | tRPC | Custom JSON-RPC |
|---|---|---|---|---|
| **Learning curve** | Low | High | Low–Med | Med |
| **Schema-as-contract** | OpenAPI (separate) | Native | Native (TS) | Hand-rolled |
| **Caching** | Excellent (HTTP) | Poor (POST) | Good (per-procedure) | Poor |
| **Tooling (Postman, OpenAPI, Stripe-style clients)** | Excellent | Excellent (codegen) | Med (just for our app) | Poor |
| **Serverless cost** | Low | High (N+1) | Low | Low |
| **Public integrations** | Excellent | Excellent | Bad (TS-only) | Med |
| **Multi-team org adoption** | High | High | Low | Very low |
| **Streaming/realtime** | SSE works | Subscriptions | Subscriptions | Med |

### 3.2 Decision: **REST primary, with an internal tRPC boundary**

We will run **two parallel surfaces**, served from the same Next.js process:

1. **Public REST API** at `/api/v3/...` — for OpenProject migration, integrations, scripts, mobile clients. JSON-API/HAL-ish, OpenAPI-generated.
2. **Internal tRPC router** at `/api/trpc/[trpc]` — for our own Next.js client. End-to-end type safety, no OpenAPI required for internal use.

**Why both, not one?**

- The web client (Zustand + TanStack Query) already needs typed fetchers. tRPC gives us that for free, with shared Zod input/output types.
- External consumers (existing OpenProject plugin authors, scripting users, the planned mobile app) want REST. We can't force tRPC on them.
- A single-process deployment means zero infra cost of running two surfaces — Next.js handles routing for both.
- We can colocate the tRPC procedures next to the REST handlers, sharing the same service layer (services in `services/*`, called by both surfaces).

**Why not GraphQL?**

- N+1 query cost in serverless — Prisma DataLoader can mitigate, but adds complexity.
- We don't have many clients needing flexible field selection; sparse fieldsets on REST achieve 80% of the win.
- Subscriptions complicate the Vercel/serverless story; SSE is sufficient.
- Operational tooling (cache, rate limit, log structure) is more uniform with REST.

**Why not tRPC-only?**

- We need **public** API consumers. tRPC is TypeScript-only — not viable for an OpenProject migration story, a Python script, or a third-party Zapier integration.
- The original OpenProject's API is HAL+JSON; the migration path (read legacy data, write through our API) is easier when our public API is REST.

### 3.3 Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Client (Web/Mobile/CLI/3rd-party)                           │
└───────────────┬────────────────────────────┬─────────────────┘
                │ tRPC                        │ REST / SSE
                ▼                             ▼
        /api/trpc/[trpc]                /api/v3/...
                │                             │
                └──────────┬──────────────────┘
                           ▼
                  ┌──────────────────┐
                  │  Middleware HOF  │  ← auth, rate-limit, validate, audit
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │  Service layer   │  ← services/* (typed business logic)
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │  Prisma 7 / PG   │
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │  Upstash Redis   │  ← cache, pubsub, rate-limit
                  └──────────────────┘
```

- **Routes** are thin: parse, dispatch, format response.
- **Services** are pure: take a typed input, return a typed output, no HTTP knowledge.
- **Repositories** (optional, see §12.4) wrap Prisma when queries get complex.
- **Infrastructure** (`lib/*`) provides cache, queue, mail, etc.

---

## 4. URL Structure & Versioning

### 4.1 Versioning strategy

We adopt **URL-path versioning** with two live versions:

- `/api/v3/...` — OpenProject-compatible surface (HAL+JSON), preserved for migration
- `/api/v1/...` — our native, simplified REST surface (preferred for new code)
- `/api/trpc/[trpc]` — internal, **never versioned** (type-safe, no need)

**Rules:**

- New routes ship under `/api/v1/...` unless they're explicitly OpenProject-compatible.
- v3 is **frozen** except for security/correctness fixes. New features go to v1.
- We never break v3. v1 follows semver-style deprecation: 6 months notice, then `/api/v2/...`.
- A `Sunset` header announces deprecations, `Deprecation: true` per RFC8594.

### 4.2 Resource-oriented nesting

Maximum nesting depth: **2 levels** beyond the resource. Anything deeper gets a flat URL with the parent id in the body.

```
✅  /api/v1/projects/:projectId/work-packages
✅  /api/v1/projects/:projectId/work-packages/:wpId
✅  /api/v1/projects/:projectId/work-packages/:wpId/relations
✅  /api/v1/projects/:projectId/work-packages/:wpId/relations/:relationId
❌  /api/v1/projects/:projectId/work-packages/:wpId/relations/:relationId/comments/:commentId/likes/:likeId
```

The last would be `/api/v1/comments/:commentId/likes/:likeId` (comment is the parent of a like).

### 4.3 Canonical URL map (target state)

```
# Identity
POST   /api/v1/auth/login                    ← NextAuth managed
POST   /api/v1/auth/logout
GET    /api/v1/auth/session

# Users
GET    /api/v1/users                         (list, paginated)
POST   /api/v1/users                         (admin only, or self-serve signup if enabled)
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id                     (admin, soft+hard)
POST   /api/v1/users/:id/avatar              (multipart) → S3 presigned
GET    /api/v1/users/:id/notification-settings
PATCH  /api/v1/users/:id/notification-settings
GET    /api/v1/users/:id/time-entries

# Projects
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
POST   /api/v1/projects/:id/archive
POST   /api/v1/projects/:id/copy
GET    /api/v1/projects/:id/members
POST   /api/v1/projects/:id/members
PATCH  /api/v1/projects/:id/members/:userId
DELETE /api/v1/projects/:id/members/:userId
GET    /api/v1/projects/:id/types
GET    /api/v1/projects/:id/queries
GET    /api/v1/projects/:id/work-packages    (work-packages nested under project)
GET    /api/v1/projects/:id/activity
GET    /api/v1/projects/:id/wiki
POST   /api/v1/projects/:id/wiki
GET    /api/v1/projects/:id/wiki/:slug
PATCH  /api/v1/projects/:id/wiki/:slug
GET    /api/v1/projects/:id/forums
GET    /api/v1/projects/:id/meetings

# Work packages (also reachable flatly for cross-project queries)
GET    /api/v1/work-packages                 (search & filter)
POST   /api/v1/work-packages
GET    /api/v1/work-packages/:id
PATCH  /api/v1/work-packages/:id
DELETE /api/v1/work-packages/:id
POST   /api/v1/work-packages/:id/duplicate
POST   /api/v1/work-packages/:id/move
GET    /api/v1/work-packages/:id/relations
POST   /api/v1/work-packages/:id/relations
GET    /api/v1/work-packages/:id/watchers
POST   /api/v1/work-packages/:id/watchers/:userId
DELETE /api/v1/work-packages/:id/watchers/:userId
GET    /api/v1/work-packages/:id/attachments
POST   /api/v1/work-packages/:id/attachments (presigned)
GET    /api/v1/work-packages/:id/activity
GET    /api/v1/work-packages/:id/comments
POST   /api/v1/work-packages/:id/comments

# Wiki, Forums, Meetings, Documents, Time, Notifications, etc.
# Each follows the same pattern. See §24 for the complete table.

# Realtime
GET    /api/v1/sse                           (Server-Sent Events)
POST   /api/v1/sse/heartbeat                 (some clients prefer POST)

# Files
POST   /api/v1/files/upload-url              (returns presigned PUT URL)
POST   /api/v1/files/confirm                  (commit multipart upload)

# Webhooks
GET    /api/v1/webhooks
POST   /api/v1/webhooks
GET    /api/v1/webhooks/:id
PATCH  /api/v1/webhooks/:id
DELETE /api/v1/webhooks/:id
POST   /api/v1/webhooks/:id/test

# Admin
GET    /api/v1/admin/users
POST   /api/v1/admin/users/:id/lock
POST   /api/v1/admin/users/:id/unlock
POST   /api/v1/admin/users/:id/reset-password
GET    /api/v1/admin/audit-log
GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings

# API tokens (machine auth)
POST   /api/v1/api-tokens
GET    /api/v1/api-tokens
DELETE /api/v1/api-tokens/:id

# Health & metrics
GET    /api/health                           (no auth, shallow)
GET    /api/health/deep                      (auth required, hits DB+Redis)
GET    /api/metrics                          (Prometheus, auth required)
```

**v3 alias**: every `/api/v1/*` route has a corresponding `/api/v3/*` adapter that translates the v1 envelope to HAL+JSON (see §18). This is generated from a single OpenAPI spec.

### 4.4 Resource naming rules

- **Plural nouns** for collections: `/users`, `/projects`, `/work-packages`
- **kebab-case** for multi-word resources: `/work-packages`, `/notification-settings`, `/time-entries`
- **Lower-case verbs** are allowed **only** for non-CRUD actions: `/projects/:id/archive`, `/users/:id/reset-password`
- **No file extensions** in URLs (use `Accept` header for content negotiation)

---

## 5. HTTP Semantics & Resource Modeling

### 5.1 Status code taxonomy

| Code | When | Notes |
|---|---|---|
| **200 OK** | Successful GET, PATCH, PUT | Body contains resource (or array) |
| **201 Created** | Successful POST that creates a single resource | Body contains resource; `Location` header points to it |
| **202 Accepted** | Async operation queued (export, import, bulk delete) | Body contains `{ jobId, statusUrl }` |
| **204 No Content** | Successful DELETE or PATCH that returns nothing | No body |
| **301 Moved Permanently** | Resource renamed/slugs changed | With `Location` |
| **304 Not Modified** | Conditional GET with `ETag` / `If-None-Match` | No body |
| **400 Bad Request** | Schema validation failure | Body has `errors[]` per field |
| **401 Unauthorized** | No/invalid auth | `WWW-Authenticate: Bearer` |
| **403 Forbidden** | Auth OK, but lacks permission | Code: `permission_denied` |
| **404 Not Found** | Resource does not exist OR user can't see it (deliberate ambiguity for security) | Code: `not_found` |
| **409 Conflict** | Version conflict (optimistic concurrency), duplicate (email, slug) | Code: `conflict` or `duplicate` |
| **410 Gone** | Soft-deleted resource still being referenced | Code: `gone` |
| **412 Precondition Failed** | `If-Match` ETag mismatch | Code: `etag_mismatch` |
| **422 Unprocessable Entity** | Schema valid but business rule violated (e.g., moving a closed WP) | Code: `business_rule_violation` |
| **429 Too Many Requests** | Rate limit hit | `Retry-After: <seconds>`, `X-RateLimit-*` |
| **500 Internal Server Error** | Unhandled | Sentry capture, no leak |
| **503 Service Unavailable** | DB / Redis down | `Retry-After` |
| **504 Gateway Timeout** | Upstream timeout | |

### 5.2 Idempotency

`POST` and `PATCH` endpoints **accept** an `Idempotency-Key` header (UUID v4, max 255 chars). When present:

1. First request: process normally, store `(userId, route, key, responseHash, responseBody, ttl=24h)` in Redis.
2. Subsequent requests with the same key within the TTL: return the **cached response** with header `Idempotency-Replayed: true`.
3. Key collision with a different body: return `409` with code `idempotency_key_mismatch`.

Required for:
- All `POST` to `/work-packages`, `/projects`, `/comments`, `/webhooks`, `/api-tokens`
- All `POST` to `/exports` and `/imports`
- Stripe-style payment endpoints (if/when added)

Optional for everything else; clients are encouraged to use it for retry safety.

### 5.3 Conditional requests

- `ETag` header on every GET response (hash of the canonical response, excluding volatile fields like `serverTimestamp`).
- `If-None-Match` on client side → 304.
- `If-Match` on PATCH/DELETE for optimistic concurrency (returns 412 on mismatch).

### 5.4 Optimistic concurrency

- Every mutable resource has a `version: int` column (incremented on each update).
- PATCH must send `If-Match: "<version>"` header, OR the request body's `version` field.
- On mismatch → `412 Precondition Failed`, body explains.

### 5.5 Bulk operations

We use **two patterns**:

1. **Subresource array body**: `POST /api/v1/work-packages/bulk-update` with `{ ids: [...], patch: {...} }` (max 500 ids).
2. **Per-id call batched by client** (TanStack Query) — encouraged for small counts.

For >500 items, an async job is required (`POST /api/v1/work-packages/bulk-jobs` returns 202 + jobId).

---

## 6. Response Format Standard

### 6.1 v1 envelope (our native)

Every successful v1 response uses this shape:

```json
{
  "data": <resource | resource[] | null>,
  "meta": {
    "timestamp": "2026-06-06T12:34:56.789Z",
    "requestId": "req_01HXY...",
    "version": "1.0"
  },
  "links": {
    "self": "/api/v1/projects/abc/work-packages?page=2",
    "first": "/api/v1/projects/abc/work-packages?page=1",
    "prev":  "/api/v1/projects/abc/work-packages?page=1",
    "next":  "/api/v1/projects/abc/work-packages?page=3",
    "last":  "/api/v1/projects/abc/work-packages?page=42"
  }
}
```

- `data` is `null` for 204-equivalent reads (we never actually return 204 with body; 204 is reserved for DELETE).
- For single resources, `data` is the object.
- For collections, `data` is the array; pagination lives in `links`.
- For mutations returning a resource, `data` is the new resource; `links.self` points to it.

### 6.2 v1 meta block (paginated)

```json
"meta": {
  "page": { "size": 50, "total": 2084, "hasMore": true },
  "cursor": { "next": "eyJpZCI6MTIzfQ==", "prev": "eyJpZCI6NzV9" }
}
```

`page` is populated for offset/limit pagination (small lists).
`cursor` is populated for cursor pagination (work packages, activity).
We never mix both; the route declares its style.

### 6.3 v1 error envelope

```json
{
  "errors": [
    {
      "code": "validation_failed",
      "title": "Work package could not be created",
      "detail": "subject is required and must be a non-empty string",
      "source": { "pointer": "/data/attributes/subject" },
      "meta": { "field": "subject", "rule": "min_length:1" }
    }
  ],
  "meta": { "requestId": "req_01HXY...", "timestamp": "2026-06-06T12:34:56.789Z" }
}
```

Conforms to JSON:API error spec (the `errors` array shape). We deliberately extend `code` (machine-readable) and `meta`.

### 6.4 Headers always set

| Header | Source |
|---|---|
| `X-Request-Id` | ULID generated per request (also in `meta.requestId`) |
| `X-RateLimit-Limit` | The limit for the bucket |
| `X-RateLimit-Remaining` | Tokens left |
| `X-RateLimit-Reset` | Unix epoch seconds when bucket refills |
| `Cache-Control` | `private, max-age=N` (varies by route) |
| `Vary` | `Accept, Accept-Encoding, X-Request-Id` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

### 6.5 HAL+JSON (v3 compatibility)

v3 endpoints emit:

```json
{
  "_links": {
    "self": { "href": "/api/v3/work_packages/123", "title": "Fix login bug" },
    "project": { "href": "/api/v3/projects/9", "title": "Auth" },
    "type":   { "href": "/api/v3/types/2", "title": "Task" }
  },
  "_embedded": {
    "project": { "_links": { "self": { "href": "/api/v3/projects/9" } }, "id": 9, "identifier": "auth", "name": "Auth" }
  },
  "id": 123,
  "subject": "Fix login bug",
  "lockVersion": 5,
  ...
}
```

We do **not** invent new v3 conventions. We mirror the OpenProject v3 spec (https://docs.openproject.org/api/) and pin a date stamp on the v3 surface (`X-OpenProject-API-Version: 3.0.0`).

### 6.6 Content negotiation

- `Accept: application/vnd.api+json` → v1 envelope
- `Accept: application/hal+json` → v3 HAL
- `Accept: */*` → v1 envelope (our default for the web client)
- `Accept: text/csv` → CSV download (exports only)

---

## 7. Error Handling Pattern

### 7.1 Error class hierarchy

```ts
// lib/errors.ts
export abstract class ApiError extends Error {
  abstract readonly status: number
  abstract readonly code: string
  readonly cause?: unknown
  readonly meta?: Record<string, unknown>

  constructor(message: string, opts?: { cause?: unknown; meta?: Record<string, unknown> }) {
    super(message)
    this.name = this.constructor.name
    this.cause = opts?.cause
    this.meta = opts?.meta
  }

  /** Human-friendly message safe to expose to end users */
  abstract userMessage(): string
  /** Detailed message for developers (logged, not returned) */
  abstract devMessage(): string
}

export class ValidationError extends ApiError {
  readonly status = 400
  readonly code = 'validation_failed'
  constructor(public readonly issues: ZodIssue[], meta?: Record<string, unknown>) {
    super('Request validation failed', { meta: { ...meta, issues } })
  }
  userMessage() { return 'Some fields are invalid.' }
  devMessage() { return `Zod issues: ${JSON.stringify(this.issues)}` }
}

export class UnauthorizedError extends ApiError {
  readonly status = 401
  readonly code = 'unauthorized'
  userMessage() { return 'You must be signed in.' }
  devMessage() { return 'No valid session or token' }
}

export class ForbiddenError extends ApiError {
  readonly status = 403
  readonly code = 'permission_denied'
  constructor(public readonly permission: string) { super(`Permission denied: ${permission}`) }
  userMessage() { return `You don't have permission to ${this.permission.replace(/_/g, ' ')}.` }
  devMessage() { return `Missing permission: ${this.permission}` }
}

export class NotFoundError extends ApiError {
  readonly status = 404
  readonly code = 'not_found'
  constructor(public readonly resource: string, public readonly id?: string) {
    super(`${resource} ${id ?? ''} not found`)
  }
  userMessage() { return 'The requested item was not found.' }
  devMessage() { return this.message }
}

export class ConflictError extends ApiError {
  readonly status = 409
  readonly code = 'conflict'
  userMessage() { return 'This conflicts with the current state.' }
  devMessage() { return this.message }
}

export class DuplicateError extends ApiError {
  readonly status = 409
  readonly code = 'duplicate'
  constructor(public readonly field: string, public readonly value: string) {
    super(`Duplicate value for ${field}: ${value}`)
  }
  userMessage() { return `A record with that ${this.field} already exists.` }
  devMessage() { return this.message }
}

export class BusinessRuleError extends ApiError {
  readonly status = 422
  readonly code = 'business_rule_violation'
  userMessage() { return 'This action is not allowed in the current state.' }
  devMessage() { return this.message }
}

export class RateLimitError extends ApiError {
  readonly status = 429
  readonly code = 'rate_limited'
  constructor(public readonly retryAfter: number) { super(`Rate limit; retry after ${retryAfter}s`) }
  userMessage() { return 'Too many requests. Please slow down.' }
  devMessage() { return this.message }
}

export class GoneError extends ApiError {
  readonly status = 410
  readonly code = 'gone'
  userMessage() { return 'This item has been removed.' }
  devMessage() { return this.message }
}

export class ETagMismatchError extends ApiError {
  readonly status = 412
  readonly code = 'etag_mismatch'
  userMessage() { return 'The item was changed by someone else. Please refresh.' }
  devMessage() { return this.message }
}

export class IdempotencyMismatchError extends ApiError {
  readonly status = 409
  readonly code = 'idempotency_key_mismatch'
  userMessage() { return 'This idempotency key was used with a different request body.' }
  devMessage() { return this.message }
}

export class InternalError extends ApiError {
  readonly status = 500
  readonly code = 'internal_error'
  userMessage() { return 'Something went wrong. Please try again.' }
  devMessage() { return this.message }
}
```

### 7.2 Error formatter (the global handler)

```ts
// lib/errors/formatter.ts
import * as Sentry from '@sentry/nextjs'
import { ZodError } from 'zod'
import { ApiError, ValidationError, InternalError } from './classes'

export function formatError(err: unknown, requestId: string) {
  // 1. Translate well-known low-level errors
  if (err instanceof ZodError) {
    return new ValidationError(err.issues)
  }
  if (err instanceof ApiError) return err

  // 2. Prisma errors
  if (err && typeof err === 'object' && 'code' in err) {
    const pe = err as { code: string; meta?: Record<string, unknown> }
    if (pe.code === 'P2002') {
      // unique constraint
      const target = (pe.meta?.target as string[] | undefined)?.[0] ?? 'field'
      return new DuplicateError(target, 'value')
    }
    if (pe.code === 'P2025') {
      return new NotFoundError('record')
    }
  }

  // 3. Unknown — treat as 500
  return new InternalError(err instanceof Error ? err.message : 'Unknown error', { cause: err })
}

export function errorToResponse(err: ApiError, requestId: string) {
  // 4. Capture to Sentry if 5xx
  if (err.status >= 500) {
    Sentry.withScope((scope) => {
      scope.setTag('requestId', requestId)
      scope.setTag('error.code', err.code)
      scope.setExtra('meta', err.meta)
      Sentry.captureException(err.cause ?? err)
    })
  }

  return {
    body: {
      errors: [{
        code: err.code,
        title: err.userMessage(),
        detail: err.devMessage(),  // dev detail; we DO return it for now; strip in prod if PII concern
        meta: err.meta,
      }],
      meta: { requestId, timestamp: new Date().toISOString() },
    },
    status: err.status,
    headers: err.status === 429 ? { 'Retry-After': String((err as RateLimitError).retryAfter) } : undefined,
  }
}
```

### 7.3 Sentry capture rules

- All 5xx → captured as `error` with full stack
- 4xx → captured as `breadcrumb` only (debug-level Sentry event), except 401/403 storm (signal of an attack) which are captured as info events
- PII scrubbing: `password`, `token`, `secret`, `cookie`, `authorization` are stripped by `beforeSend`
- User context: `scope.setUser({ id: session.user.id, email: session.user.email })` only if session is present; for 401 we leave it anonymous

### 7.4 Public vs private messages

- `userMessage()` is what the client renders; never contains stack traces, SQL, or internal class names.
- `devMessage()` is logged to Sentry and **also** returned in `detail` for now. We can gate this behind a `?debug=1` query param or `X-Show-Debug: <admin-key>` header for production. (OpenProject's v3 returns full details, so this is consistent.)

---

## 8. Authentication, Authorization & RBAC

### 8.1 Three auth surfaces

1. **Browser session** — NextAuth JWT cookie (`next-auth.session-token`).
2. **API token** — `Authorization: Bearer opat_<token>`, scoped per project, expirable.
3. **Service-to-service** — HMAC-signed requests with shared secret (for outgoing webhook receivers, future internal services).

### 8.2 NextAuth v5 vs v4 reality

The codebase has `next-auth@4.24.14` installed. All routes **must** use:

```ts
// ✅ CORRECT (v4 idiom)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
const session = await getServerSession(req, res, authOptions)
```

NOT:

```ts
// ❌ BUGGY (v5 idiom, fails in nested routes with v4)
const session = await getServerSession(authOptions)  // 1-arg form
```

A **lint rule** (see §27) flags the 1-arg form.

### 8.3 Session payload (JWT claims)

```ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      isSystemAdmin: boolean       // cached from DB
      passwordMigrationRequired: boolean
    }
  }
}
```

**Cache `isSystemAdmin` in the JWT** rather than re-querying DB on every call. Refresh on:
- `User.update` (any field)
- `User.delete`
- `UserPermission.update`
- Manual: `session.update()` NextAuth call

### 8.4 API tokens

`ApiToken` model (new):

```prisma
model ApiToken {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  tokenHash   String    @unique    // sha256(token); raw token returned ONCE
  prefix      String                // first 8 chars for display "opat_abc1…"
  scopes      String[]              // ["work_package:read", "project:write"]
  projectId   String?               // null = global
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  expiresAt   DateTime?
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?

  @@index([userId])
  @@index([tokenHash])
}
```

Lookup flow:
1. Parse `Authorization: Bearer opat_<32+chars>`.
2. SHA-256 the raw token, look up `ApiToken` by `tokenHash`.
3. Check `revokedAt`, `expiresAt`.
4. Build a `Session` shape equivalent to the cookie-based one, set `req.session = ...`.
5. Stamp `lastUsedAt` (debounced to once per minute to avoid hot writes).

### 8.5 RBAC model

OpenProject's authorization is famously complex (work-package-level permissions, project roles + global roles + non-member roles + groups). We model it as:

```
User ─┬─ Membership (projectId) ─── Role ── Permission[]
      ├─ GlobalRole ──────────────────── Permission[]
      ├─ GroupMembership ─── Group ───── Role ── Permission[]
      └─ AnonymousRole (public projects only)
```

**Permission strings** (excerpt; full list in §24):

```
work_package.view            work_package.add            work_package.edit
work_package.delete          work_package.assign         work_package.move
work_package.comment         work_package.watch          work_package.export
project.view                 project.edit                project.create
project.delete               project.archive             project.member.create
project.member.manage        wiki.view                   wiki.edit
wiki.delete                  forum.view                  forum.post.create
forum.post.edit              forum.post.delete           meeting.view
meeting.create               meeting.edit                meeting.delete
time_entry.log               time_entry.log_others       time_entry.approve
membership.view_any          membership.edit_any         system.admin
api_token.create             api_token.revoke            webhook.create
```

**Helper:**

```ts
// lib/auth/can.ts
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from './permissions'

export async function can(
  session: Session | null,
  permission: PermissionString,
  resource?: { projectId?: string; workPackageId?: string }
): Promise<boolean> {
  if (!session?.user) return false
  if (session.user.isSystemAdmin) return true
  return getUserPermissions(session.user.id, resource?.projectId)
    .then(perms => perms.has(permission))
}
```

**Resource-scoped permission expansion** (e.g. for a specific work package):

```ts
// services/permissions/expand.ts
export async function getUserPermissions(userId: string, projectId?: string): Promise<Set<string>> {
  // 1. System-level (admin bypass above)
  // 2. Global roles for user
  // 3. Group memberships → group roles
  // 4. Project membership (if projectId given) → role
  // 5. Non-member role for project (public projects)
  // 6. Return Set<PermissionString>
}
```

**Middleware HOF** accepts a `permissions: PermissionString[]` argument:

```ts
export const POST = withRoute({
  auth: 'required',
  permissions: ['work_package.add'],
  rateLimit: { bucket: 'write', points: 30, window: '1m' },
  validate: { body: CreateWorkPackageSchema },
  audit: { action: 'work_package.create' },
}, async (ctx) => { ... })
```

### 8.6 Per-route audit log

For every successful state-changing request, an `AuditLog` row is written (best-effort, after the response is sent, fire-and-forget):

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action      String   // "work_package.create", "project.delete", ...
  resource    String   // "work_package", "project", ...
  resourceId  String?
  projectId   String?
  ip          String?
  userAgent   String?
  requestId   String?
  changes     Json?    // diff
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([projectId, createdAt])
  @@index([resource, resourceId, createdAt])
}
```

---

## 9. Rate Limiting & Abuse Protection

### 9.1 Bucket model

We use `@upstash/ratelimit` (already in deps). We define **named buckets**, not raw counts:

| Bucket | Algorithm | Points | Window | Applies to |
|---|---|---|---|---|
| `auth.login` | sliding window | 5 | 1 m | `POST /auth/login` |
| `auth.signup` | sliding window | 3 | 1 h | `POST /auth/signup` |
| `read.global` | token bucket | 600 | 1 m | All `GET` (per user) |
| `read.ip` | token bucket | 1200 | 1 m | All `GET` (per IP, anon) |
| `write.global` | token bucket | 300 | 1 m | All POST/PATCH/DELETE (per user) |
| `write.expensive` | sliding window | 10 | 1 m | `/exports`, `/imports`, `/webhooks` |
| `sse` | fixed window | 5 | 1 m | Concurrent SSE connections per user |
| `upload.presign` | sliding window | 60 | 1 m | `/files/upload-url` |
| `webhook.dispatch` | token bucket | 300 | 1 m | Outbound webhook send attempts |

### 9.2 Precedence

```
specific-route bucket  →  per-user bucket  →  per-IP bucket
```

We pick the most restrictive non-passing limit and return 429 with the matching `Retry-After` and `X-RateLimit-*` headers.

### 9.3 Client identity

```ts
// lib/ratelimit/identity.ts
export function clientKey(req: NextApiRequest, session: Session | null): string {
  if (session?.user) return `u:${session.user.id}`
  return `ip:${(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '0.0.0.0'}`
}
```

### 9.4 Bypass for trusted sources

A list of internal CIDRs (e.g. `10.0.0.0/8` for our own k6 runner) and admin user IDs skips rate limits. The admin bypass is logged.

### 9.5 Fail-open behaviour

If Upstash Redis is unreachable, **fail open** (allow request) **and** emit a `rate_limit.degraded` Sentry breadcrumb. The current `lib/ratelimit.ts` does this for IP-only; we extend to all buckets and add metrics (`rate_limit_degraded_total`).

---

## 10. Validation Layer (Zod)

### 10.1 Schema location

```
schemas/
├── common/
│   ├── ids.ts            # cuid, ulid, slug, projectId
│   ├── pagination.ts     # OffsetPagination, CursorPagination
│   ├── sorting.ts        # SortSpec
│   ├── filter.ts         # FilterSpec
│   └── enums.ts          # UserStatus, ProjectStatus, ...
├── work-packages/
│   ├── create.ts
│   ├── update.ts
│   ├── query.ts
│   └── response.ts
├── projects/
├── users/
└── ...
```

Schemas are **shared** between client and server (imported from a `@op/schemas` workspace package or path alias). The same Zod schema is the source of truth for:
- Request body / query / params validation
- Service input validation (defence in depth)
- TypeScript type inference (`type CreateWorkPackageInput = z.infer<typeof CreateWorkPackageSchema>`)
- OpenAPI generation (`@asteasolutions/zod-to-openapi`)
- tRPC input

### 10.2 Example

```ts
// schemas/work-packages/create.ts
import { z } from 'zod'

export const CreateWorkPackageSchema = z.object({
  projectId: z.string().cuid(),
  typeId:   z.string().cuid(),
  statusId: z.string().cuid().optional(),
  subject:  z.string().min(1).max(255).trim(),
  description: z.string().max(50_000).optional(),
  assigneeId:  z.string().cuid().nullable().optional(),
  startDate:   z.iso.date().nullable().optional(),
  dueDate:     z.iso.date().nullable().optional(),
  estimatedTime: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),  // hours
  parentId:    z.string().cuid().nullable().optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).refine(d => !d.startDate || !d.dueDate || d.startDate <= d.dueDate, {
  message: 'startDate must be on or before dueDate',
  path: ['dueDate'],
})

export type CreateWorkPackageInput = z.infer<typeof CreateWorkPackageSchema>
```

### 10.3 Param and query validation

```ts
// schemas/common/ids.ts
export const CuidParam = z.object({ id: z.string().cuid() })

// schemas/work-packages/query.ts
export const WorkPackageListQuery = z.object({
  projectId:    z.string().cuid().optional(),
  assigneeId:   z.string().cuid().optional(),
  status:       z.enum(['open', 'closed', 'any']).default('open'),
  page:         z.coerce.number().int().min(1).default(1),
  pageSize:     z.coerce.number().int().min(1).max(200).default(50),
  sortBy:       z.enum(['createdAt', 'updatedAt', 'subject', 'priority']).default('updatedAt'),
  sortDir:      z.enum(['asc', 'desc']).default('desc'),
  fields:       z.string().optional(),   // sparse fieldsets, comma-separated
  q:            z.string().max(200).optional(),
})
```

### 10.4 Response validation (optional but recommended for hot paths)

For high-stakes endpoints (e.g. work-package detail) we validate the outgoing payload against a Zod schema. This catches DB-shape drift and Prisma migration bugs. Off by default in production (perf), on in test.

---

## 11. Middleware Pipeline (Higher-Order Pattern)

### 11.1 The HOF

```ts
// lib/api/withRoute.ts
import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { ZodSchema } from 'zod'
import { Session, getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRouteRateLimit } from '@/lib/ratelimit/route'
import { can } from '@/lib/auth/can'
import { formatError, errorToResponse } from '@/lib/errors/formatter'
import { ApiError, ValidationError, UnauthorizedError, ForbiddenError, RateLimitError, NotFoundError, InternalError, BusinessRuleError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { ulid } from '@/lib/ids'
import { getRequestContext } from '@/lib/observability/context'
import { captureBreadcrumb, setSentryUser } from '@/lib/observability/sentry'

export interface RouteConfig<TCtx, TBody, TQuery, TParams> {
  auth?: 'required' | 'optional' | 'none'
  permissions?: Array<{ permission: string; projectIdFrom?: 'body' | 'query' | 'params' }>
  rateLimit?: { bucket: string; points: number; window: string }
  validate?: {
    body?: ZodSchema<TBody>
    query?: ZodSchema<TQuery>
    params?: ZodSchema<TParams>
  }
  audit?: { action: string; resourceFrom?: 'body' | 'params' }
  cache?: { ttlSeconds: number; varyBy?: Array<'user' | 'project'> }
  handler: (ctx: RouteContext<TCtx, TBody, TQuery, TParams>) => Promise<NextApiResponse | void | unknown>
}

export interface RouteContext<TCtx, TBody, TQuery, TParams> {
  req: NextApiRequest
  res: NextApiResponse
  session: Session | null
  apiToken: ApiTokenContext | null
  body: TBody
  query: TQuery
  params: TParams
  ctx: TCtx          // request-scoped ambient
  setHeader(name: string, value: string): void
  setCookie?(name: string, value: string, opts?: CookieOpts): void
  cache?: { hit: boolean; key: string }
}

export function withRoute<TCtx = {}, TBody = unknown, TQuery = Record<string, unknown>, TParams = Record<string, unknown>>(
  config: RouteConfig<TCtx, TBody, TQuery, TParams>
): NextApiHandler {
  return async (req, res) => {
    const requestId = (req.headers['x-request-id'] as string) || ulid()
    res.setHeader('X-Request-Id', requestId)
    const start = Date.now()

    try {
      // 1. Auth
      let session: Session | null = null
      let apiToken: ApiTokenContext | null = null
      if (config.auth !== 'none') {
        ({ session, apiToken } = await resolveAuth(req, res))
        if (config.auth === 'required' && !session && !apiToken) {
          throw new UnauthorizedError()
        }
        if (session) setSentryUser({ id: session.user.id, email: session.user.email })
      }

      // 2. Rate limit
      if (config.rateLimit) {
        const ok = await checkRouteRateLimit(req, session, apiToken, config.rateLimit)
        if (!ok) {
          const r = await getRemaining(config.rateLimit, req, session, apiToken)
          throw new RateLimitError(r.retryAfter)
        }
      }

      // 3. Validate
      const body   = config.validate?.body   ? config.validate.body.parse(req.body)   : (req.body as TBody)
      const query  = config.validate?.query  ? config.validate.query.parse(req.query)  : (req.query as TQuery)
      const params = config.validate?.params ? config.validate.params.parse(req.query) : (req.query as TParams)

      // 4. Authorize (RBAC)
      if (config.permissions) {
        for (const p of config.permissions) {
          const projectId = resolveProjectId(req, p.projectIdFrom, body, query, params)
          const allowed = await can(session, p.permission, projectId ? { projectId } : undefined)
          if (!allowed) throw new ForbiddenError(p.permission)
        }
      }

      // 5. Cache lookup (optional, GET only)
      let cache: { hit: boolean; key: string } | undefined
      if (config.cache && req.method === 'GET') {
        const key = buildCacheKey(req, session, config.cache.varyBy)
        const cached = await cacheGet<unknown>(key)
        if (cached) {
          cache = { hit: true, key }
          res.setHeader('X-Cache', 'HIT')
          applyCacheHeaders(res, config.cache)
          return res.status(200).json(cached)
        }
        cache = { hit: false, key }
        res.setHeader('X-Cache', 'MISS')
        applyCacheHeaders(res, config.cache)
      }

      // 6. Handler
      const result = await config.handler({ req, res, session, apiToken, body, query, params, ctx: {} as TCtx, setHeader: (n, v) => res.setHeader(n, v), cache })

      // 7. Cache store
      if (config.cache && cache && !cache.hit && result) {
        await cacheSet(cache.key, result, config.cache.ttlSeconds)
      }

      // 8. Respond
      if (result === undefined || result === null) {
        return res.status(204).end()
      }
      if (typeof result === 'object' && 'status' in (result as any)) {
        const r = result as { status: number; body?: unknown; headers?: Record<string, string> }
        if (r.headers) Object.entries(r.headers).forEach(([k, v]) => res.setHeader(k, v))
        return res.status(r.status).json(r.body)
      }
      return res.status(200).json(envelopify(result, requestId, req))

    } catch (err) {
      const apiErr = formatError(err, requestId)
      const { body, status, headers } = errorToResponse(apiErr, requestId)
      if (headers) Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v))

      logger[status >= 500 ? 'error' : 'warn']({
        requestId,
        method: req.method,
        url: req.url,
        status,
        code: apiErr.code,
        duration_ms: Date.now() - start,
        userId: (req as any).session?.user?.id,
        err: apiErr.devMessage(),
      })
      return res.status(status).json(body)
    } finally {
      // 9. Audit (fire-and-forget, post-response not enforced here)
      if (config.audit) {
        scheduleAuditLog(req, config.audit, requestId).catch(() => {})
      }
      captureBreadcrumb({ category: 'http', message: `${req.method} ${req.url} → ${res.statusCode}`, level: 'info' })
    }
  }
}
```

### 11.2 Composition patterns

```ts
// Higher-order route: paginated list
export const withPagination = <T>(schema: ZodSchema<T>, config: RouteConfig<T>) =>
  withRoute({ ...config, validate: { ...config.validate, query: PaginationQuery.and(config.validate?.query ?? z.object({})) } })

// Authenticated: short alias
export const withAuth = <T>(permissions: string[], handler: RouteConfig<T>['handler']) =>
  withRoute({ auth: 'required', permissions: permissions.map(p => ({ permission: p })), handler })
```

### 11.3 Middleware ordering (matters!)

1. `X-Request-Id` header set **first** so all logs/errors carry it.
2. Auth **before** rate limit (so we can rate-limit per-user rather than per-IP for authed users).
3. Validation **before** authorization (so a malformed request never reveals whether a permission exists).
4. Authorization **before** Prisma calls (so an unauthorized request never touches the DB).
5. Cache lookup **after** auth (cached responses are user-scoped), **before** handler.
6. Audit log in `finally` so it runs even on 5xx.

---

## 12. Database Access Strategy

### 12.1 Prisma 7 with the driver adapter

Already wired in `lib/prisma.ts` using `PrismaPg`. We extend with:

- **Read replicas**: a second `PrismaClient` instance (`prismaRead`) for read-only queries. Detected via `DATABASE_READ_URL`. Falls back to primary.
- **Connection pool tuning**: `pg.Pool({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })` for serverless cold-start friendliness.

### 12.2 Transaction strategy

```ts
// lib/db/tx.ts
import { prisma } from '@/lib/prisma'

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts?: { isolation?: 'ReadCommitted' | 'RepeatableRead' | 'Serializable' }
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: opts?.isolation,
    maxWait: 5_000,
    timeout: 15_000,
  })
}
```

**Rules:**

- All multi-row writes use `withTransaction` (or `$transaction` directly).
- Default isolation: `ReadCommitted` (Postgres default).
- Use `Serializable` only for "balance transfer"-like operations (e.g. moving a work package, recalculating a project budget).
- **Never** nest `withTransaction` (Prisma's `$transaction` doesn't support savepoints in interactive mode).

### 12.3 Batch operations

```ts
// Pattern: bulk update
await prisma.workPackage.updateMany({
  where: { id: { in: ids }, projectId },   // projectId guards the tenant boundary
  data:  { statusId: newStatusId },
})
```

For >500 items, we split into chunks of 500 to stay under DB parameter limits (PG `?` placeholder limit is 32k).

### 12.4 Repositories (when needed)

Not for every model. We introduce a repository **only** when:

- The query has business logic that is reused across routes (e.g. "find visible work packages" for permission filtering).
- We want to swap Prisma out later (unlikely, but services should be Prisma-agnostic where possible).

```ts
// repositories/work-package.ts
export const workPackageRepo = {
  async findVisible(userId: string, args: FindManyArgs): Promise<WorkPackage[]> {
    // Joins with project membership
    return prisma.workPackage.findMany({
      ...args,
      where: { AND: [args.where, membershipFilter(userId)] },
    })
  },
  // ...
}
```

### 12.5 Raw SQL escape hatch

```ts
// lib/db/raw.ts
import { prisma } from '@/lib/prisma'

export async function raw<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params) as Promise<T[]>
}
```

Used **only** for:
- Full-text search (`tsvector` queries)
- Analytics aggregations
- Window functions
- Anything that Prisma's query builder cannot express

Every `raw` call **must**:
- Use parameterised queries (no string interpolation)
- Be wrapped in a comment citing the issue / PR
- Have a Vitest integration test against a real Postgres

### 12.6 Soft deletes

We add `deletedAt: DateTime?` columns to user-deletable resources (User, Project, WorkPackage, WikiPage, Forum, Meeting). Reads filter `WHERE deletedAt IS NULL` by default; admins can pass `?includeDeleted=true`. A nightly job hard-deletes rows where `deletedAt < now() - 90 days`.

### 12.7 Schema migrations

- **All migrations are forward-only.** No squashing.
- We add `Alembic`-style migration notes (Markdown) per migration, listing the breaking changes and the route-level impact.
- Destructive migrations (column drops) are split into 2 deploys: add new column → dual-write → backfill → switch reads → drop old column.

---

## 13. Caching Layer

### 13.1 Upstash Redis — current state

`lib/cache/redis.ts` already exposes `cacheGet` / `cacheSet` / `cacheInvalidate`. We extend it with:

- **Tag-based invalidation** (`invalidateByTag`).
- **Pattern invalidation** (`invalidateByPrefix`).
- **Stampede protection** via `withSingleFlight` (one in-flight computation per key per region).

### 13.2 Cache key strategy

```
op:v1:{env}:{resource}:{id}:{v={version}}
op:v1:{env}:list:{resource}:{projectId}:{filterHash}:{sortHash}:{page}
op:v1:{env}:user:{userId}:session-stamp
op:v1:{env}:project:{projectId}:permission:{userId}
op:v1:{env}:ratelimit:{bucket}:{identity}:{window}
op:v1:{env}:sse:channel:{channelType}:{channelId}:user:{userId}
```

- `op:` prefix so we can `KEYS op:*` for ops dashboards
- `v1:` prefix to allow `/api/v2/*` to share the cache namespace with different keys
- `env:` so dev/staging/prod never collide in a shared Redis
- `version` field for explicit cache-bust after schema migrations

### 13.3 TTLs

| Resource | TTL | Invalidation trigger |
|---|---|---|
| User profile | 5 m | `User.update`, `User.delete` |
| Project summary | 10 m | `Project.update` |
| Work package detail | 60 s | `WorkPackage.update` (and tag-based) |
| Work package list | 30 s | Any `WorkPackage` write in the project |
| Project members | 60 s | `Membership.*` |
| Permissions for a user | 5 m | Role/permission change, logout |
| Static: type list, status list | 1 h | Admin only |
| Session | JWT expiry | Logout |
| Rate limit window | 1 m | n/a (Upstash handles) |
| Webhook idempotency | 24 h | n/a |
| API idempotency | 24 h | n/a |

### 13.4 Cache-aside pattern

```ts
async function getWorkPackage(id: string, userId: string) {
  const key = `op:v1:${env}:wp:${id}:v=${SCHEMA_VERSION}`
  const cached = await cacheGet<WorkPackage>(key)
  if (cached) return cached
  const fresh = await prisma.workPackage.findUnique({ where: { id }, include: ... })
  if (fresh) await cacheSet(key, fresh, 60)
  return fresh
}
```

On `WorkPackage.update(id)`:
1. `await cacheInvalidate(\`op:v1:${env}:wp:${id}:v=${SCHEMA_VERSION}\`)`
2. `await invalidateByTag(\`project:${projectId}\`)` to bust list caches

### 13.5 Tag-based invalidation

```ts
// On WorkPackage write
const tags = [
  `project:${wp.projectId}`,
  `assignee:${wp.assigneeId}`,
  `parent:${wp.parentId}`,
  `type:${wp.typeId}`,
]
await Promise.all(tags.map(t => invalidateByTag(t)))
```

Tags are stored in a separate Redis set per tag: `op:v1:tag:{tagName} = SET{key1, key2, ...}`. We use `SADD` on set, `SMEMBERS` to get keys to delete. Beware: sets can grow unbounded. We cap membership at 1000 keys per tag with an LRU trim, and fall back to prefix invalidation for high-cardinality tags.

### 13.6 Stampede protection

For "expensive" cache misses (e.g. work package list with full aggregations), use a single-flight pattern:

```ts
const result = await withSingleFlight(`build:wp-list:${key}`, async () => buildList(key), { ttl: 10 })
```

This dedupes concurrent misses into one DB query.

### 13.7 Bypass for auth-sensitive data

- **Never** cache responses that include user-specific permissions (other than the user's own data).
- For mixed lists (e.g. "all projects I can see"), cache the **unfiltered** list keyed by `project:*` and filter on the user side. The filter is cheap; the DB query is expensive.

### 13.8 Metrics

- `cache_hits_total{resource}`
- `cache_misses_total{resource}`
- `cache_invalidations_total{resource, reason}`
- `cache_degraded_total` (Redis unreachable)

---

## 14. Realtime — SSE Channels

### 14.1 Current state

`lib/realtime.ts` already implements `broadcastToUser` via Redis pub/sub. We extend with **channel-based** routing and **event types**.

### 14.2 Channel taxonomy

| Channel | Key | Subscribers | Events |
|---|---|---|---|
| `user:{userId}` | `sse:user:{userId}` | The user only | `notification.new`, `mention`, `assigned` |
| `project:{projectId}` | `sse:project:{projectId}` | All members of the project | `work_package.*`, `wiki.*`, `forum.*`, `meeting.*` |
| `work_package:{wpId}` | `sse:wp:{wpId}` | Watchers + assignee + author | `comment.*`, `relation.*` |
| `admin` | `sse:admin` | `isSystemAdmin` users | `system.*`, `audit.critical` |
| `global` | `sse:global` | Optional, opt-in per client | `announcement.new` |

### 14.3 Subscribe path (`GET /api/v1/sse?channels=user:1,project:42`)

1. Authenticate (session or API token).
2. Validate `channels` query (must match user's permission set).
3. Open an SSE stream (`text/event-stream`).
4. For each channel, `SUBSCRIBE sse:{channel}` in a dedicated Redis connection.
5. On message, forward as an SSE event (`event: {type}\ndata: {payload}\n\n`).
6. Heartbeat every 15 s (`event: ping\ndata: {ts}\n\n`).
7. On client disconnect, `UNSUBSCRIBE` and close the Redis connection.

### 14.4 Publish path (from service layer)

```ts
// services/work-package/update.ts
import { broadcast } from '@/lib/realtime'

await prisma.workPackage.update({ ... })
broadcast({
  channels: [`project:${wp.projectId}`, `work_package:${wp.id}`],
  type: 'work_package.updated',
  payload: { id: wp.id, changes },
  actor: { id: session.user.id, name: session.user.name },
})
```

`broadcast()` resolves which user channels map to the requested channels (membership lookup, batched), then publishes to each `sse:user:{userId}`.

### 14.5 Presence (optional, v1.1)

- Client sends `POST /api/v1/sse/presence` with `wpId, status: 'viewing' | 'editing'`.
- Server pushes to `work_package:{wpId}` channel with `presence.update` events.
- TTL 30 s, refreshed by client every 10 s.

### 14.6 Limits

- **5 concurrent SSE connections per user** (enforced by the `sse` rate limit bucket).
- **Max 50 channels per connection**.
- **Drop on overflow**: if a user is offline (no SSE connection), we still publish to their channel; the SSE handler doesn't replay (use a `lastEventId` mechanism + a 1-day Redis buffer if we want replay).

### 14.7 Reconnection

- Client uses `EventSource` native reconnection.
- Server emits `id: {ulid}` on every event; client sends `Last-Event-Id` header on reconnect.
- Server keeps a Redis stream of the last 100 events per channel, replays those with `id > Last-Event-Id` on reconnect.

---

## 15. Background Jobs

### 15.1 Decision: Inngest (primary), BullMQ (fallback for self-hosted)

**Inngest** wins because:

- No worker process to deploy (Vercel/serverless friendly).
- Built-in retries, concurrency limits, scheduled jobs, event-driven triggers.
- Replayability from the Inngest dashboard.
- Local emulator for tests.

We keep **BullMQ** as an option for self-hosted installs where users don't want to sign up for Inngest Cloud. The job interface is abstracted in `lib/jobs/queue.ts`.

### 15.2 Job interface

```ts
// lib/jobs/types.ts
export interface JobContext {
  attempt: number
  jobId: string
  eventId: string
  logger: Logger
}

export type JobHandler<TPayload> = (payload: TPayload, ctx: JobContext) => Promise<JobResult>
export type JobResult = { ok: true } | { ok: false; reason: string; retry?: boolean }
```

### 15.3 Catalogue (initial)

| Job | Trigger | Concurrency | Retries | Timeout |
|---|---|---|---|---|
| `csv.export` | `POST /exports` | 5 | 3 | 5 m |
| `pdf.generate` (work package, wiki, gantt) | `POST /exports` | 5 | 3 | 2 m |
| `work_package.bulk` | `POST /work-packages/bulk-jobs` | 2 | 2 | 30 m |
| `webhook.dispatch` | Domain events | 50 | 5 | 30 s |
| `webhook.retry` | Scheduled | 10 | – | – |
| `email.send` | Domain events | 20 | 5 | 30 s |
| `git.sync` (VCS repos) | Cron + webhook | 2 | 10 | 10 m |
| `audit.compact` | Cron nightly | 1 | 1 | 30 m |
| `search.reindex` | Domain events | 1 | 2 | 10 m |
| `export.purge` | Cron nightly | 1 | 1 | 5 m |
| `webhook.dlq.notify` | Cron hourly | 1 | 1 | 1 m |
| `sso.ldap.sync` | Cron hourly | 1 | 3 | 15 m |
| `notification.digest` | Cron daily | 1 | 1 | 5 m |
| `meeting.reminder` | Cron every 15 min | 1 | 2 | 1 m |

### 15.4 Webhook retry

We replace the current fixed-delay retry with **exponential backoff + jitter**:

```
delay(attempt) = min(60 * 2^attempt, 24 * 3600) + random(0, 60)
```

And a **DLQ**: after 5 failed attempts, move to `WebhookDelivery` status=`dead`, page the on-call via Sentry.

### 15.5 Idempotency

Every job payload includes a deterministic `idempotencyKey`. Inngest dedupes; BullMQ does so via Redis SETNX.

---

## 16. File Uploads — S3

### 16.1 Architecture

```
Browser → POST /api/v1/files/upload-url (auth) → returns presigned PUT
Browser → PUT directly to S3 (multipart if > 5 GB)
Browser → POST /api/v1/files/confirm (with sha256, size) → records row, fires event
```

### 16.2 Presigned URL endpoint

```ts
POST /api/v1/files/upload-url
{
  filename: "spec.pdf",
  contentType: "application/pdf",
  size: 1_234_567,           // bytes; max 5 GB single PUT, else multipart
  visibility: "public" | "private",
  container: "WorkPackage" | "WikiPage" | "Comment" | "Project" | "User",
  containerId: "abc123"
}
```

Response (single PUT):

```json
{
  "uploadId": "...",
  "url": "https://bucket.s3.amazonaws.com/...",
  "method": "PUT",
  "headers": { "Content-Type": "application/pdf" },
  "expiresAt": "2026-06-06T13:00:00Z"
}
```

Response (multipart, > 5 GB):

```json
{
  "uploadId": "...",
  "key": "...",
  "parts": [
    { "partNumber": 1, "url": "..." },
    ...
  ]
}
```

### 16.3 Confirm endpoint

```ts
POST /api/v1/files/confirm
{
  uploadId: "...",
  key: "...",
  sha256: "...",
  size: 1_234_567,
  container: "WorkPackage",
  containerId: "abc123"
}
```

Server:
1. Verifies S3 object exists with `HeadObject`.
2. Streams `sha256` from S3, compares.
3. Creates `Attachment` row.
4. Fires `attachment.created` event → broadcasts via SSE, enqueues webhook.
5. Returns 201 with the `Attachment` resource.

### 16.4 Virus scanning (v1.1)

For public installations, an optional post-upload `virus.scan` job that uses ClamAV via Lambda or an external service. Quarantine on positive.

### 16.5 Direct browser streaming

For >5 GB, the client uses multipart upload. We never proxy files through our server.

---

## 17. Outgoing Webhooks

### 17.1 Current state

`lib/webhooks/dispatcher.ts` already implements HMAC-SHA256 signing and a retry schedule. We extend with:

- **Jitter** in retry delays (avoid thundering herd)
- **DLQ** with on-call alerting
- **Per-webhook concurrency limits**
- **Event subscription** is filterable (e.g. "work_package.created in project X only")
- **Replay** endpoint (`POST /webhooks/:id/replay/:deliveryId`)

### 17.2 Event taxonomy

```
work_package.created
work_package.updated
work_package.deleted
work_package.commented
work_package.status_changed
work_package.assigned
work_package.moved
project.created
project.updated
project.archived
project.deleted
project.member_added
project.member_removed
wiki.page_created
wiki.page_updated
wiki.page_deleted
forum.post_created
forum.post_updated
forum.post_deleted
meeting.created
meeting.updated
meeting.deleted
user.created
user.updated
user.deleted
attachment.created
attachment.deleted
comment.created
comment.updated
comment.deleted
```

### 17.3 Webhook payload

```json
{
  "id": "evt_01HXYZ...",
  "type": "work_package.updated",
  "createdAt": "2026-06-06T12:34:56.789Z",
  "actor": { "id": "u_123", "type": "user" },
  "project": { "id": "p_9", "identifier": "auth" },
  "resource": {
    "type": "work_package",
    "id": "wp_123",
    "url": "/work-packages/123"
  },
  "changes": {
    "before": { "statusId": "st_1" },
    "after":  { "statusId": "st_2" }
  },
  "deliveryAttempt": 1
}
```

Headers:
```
Content-Type: application/json
User-Agent: OpenProject-Webhooks/1.0
X-OpenProject-Event: work_package.updated
X-OpenProject-Delivery: dl_01HXYZ...
X-OpenProject-Signature: sha256=abcdef...
X-OpenProject-Request-Id: req_01HXYZ...
```

### 17.4 Signature verification (receiver side)

```ts
// Receiver pseudocode
const expected = 'sha256=' + hmacSHA256(secret, rawBody).hex()
if (!timingSafeEqual(expected, signatureHeader)) reject
```

### 17.5 Retry schedule

```
attempt 1: 1 min + jitter(0-30s)
attempt 2: 5 min + jitter(0-60s)
attempt 3: 30 min + jitter(0-5m)
attempt 4: 2 h + jitter(0-15m)
attempt 5: 24 h + jitter(0-1h)
attempt 6: → DLQ
```

### 17.6 Delivery model

`WebhookDelivery` model:

```prisma
model Webhook {
  id          String   @id @default(cuid())
  projectId   String?
  name        String
  url         String
  secret      String?           // encrypted at rest
  events      String[]
  active      Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deliveries  WebhookDelivery[]
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  webhook     Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  eventId     String   // unique per attempt
  eventType   String
  payload     Json
  status      DeliveryStatus  // pending, success, failed, dead
  attempts    Int      @default(0)
  lastAttemptAt DateTime?
  nextAttemptAt DateTime?
  lastResponseStatus Int?
  lastResponseBody  String?
  createdAt   DateTime @default(now())

  @@index([webhookId, status])
  @@index([nextAttemptAt])
}
```

---

## 18. OpenProject v3 Compatibility

### 18.1 Why keep v3

The original OpenProject's API is HAL+JSON, the de-facto standard for that product. Plugin authors, Power-Users, and migration scripts depend on it. Breaking v3 would be a regression.

### 18.2 What we keep

- **URL shape**: `/api/v3/projects/:id`, `/api/v3/work_packages/:id` (note: original uses underscores; we keep that for v3 only).
- **HAL+JSON envelope**: `_links`, `_embedded`, `id`, `lockVersion`, `_type`.
- **Filter syntax**: `filters=[{"status":{"operator":"=","values":["open"]}}]`.
- **Pagination**: `offset` and `pageSize` query params, `total`, `count`, `pageSize` in `_links`.
- **Embed syntax**: `?include=project,type,author` to embed resources.

### 18.3 What we change / simplify

- v3 endpoints become **read-only** in the rewrite. Mutations go through v1.
  - Exception: `/api/v3/work_packages/:id` PATCH/POST is kept for the existing OpenProject mobile app.
- We do **not** reimplement the original's full surface; we expose the **top 30 endpoints** used in the wild and return `410 Gone` for the rest.
- We add a `X-OpenProject-API-Version` response header.
- We add a `Deprecation` header on endpoints that have a v1 equivalent.

### 18.4 v3 adapter

A single function translates v1 → HAL:

```ts
// lib/api/v3/adapter.ts
export function toHal(resource: Resource, opts: { type: string; self: string; links?: Links; embedded?: Record<string, Resource> }) {
  return {
    _type: opts.type,
    _links: { self: { href: opts.self }, ...opts.links },
    ...(opts.embedded ? { _embedded: opts.embedded } : {}),
    ...resource,
  }
}
```

Each v3 route imports from `services/`, then wraps with `toHal`. No business logic lives in the v3 layer.

### 18.5 v3 health check

`GET /api/v3` returns the OpenProject API root document (the famous `_links` discovery tree). We pin it to the OpenProject 13.x spec.

---

## 19. Pagination, Filtering, Sorting, Sparse Fieldsets

### 19.1 Two pagination styles

| Style | When | Query params | Response |
|---|---|---|---|
| **Offset** | Small lists (< 10k), admin tables, members, audit log | `?page=1&pageSize=50` | `meta.page = { size, total, hasMore }` |
| **Cursor** | Large / append-only lists: work packages, activity, comments, notifications | `?cursor=eyJpZCI6MTIzfQ==&limit=50` | `meta.cursor = { next, prev }` |

**Why both?** Cursor pagination is O(1) for `next` regardless of depth; offset is intuitive for admin tables with known total. We never mix them in the same endpoint.

**Cursor encoding**: base64url of `{"id": "<lastId>", "ts": "<iso>"}`. Opaque to clients.

### 19.2 Filtering

Common filter shape (all optional):

```
?q=search+text
&filter[status]=open,closed
&filter[assignee]=u_123,u_456
&filter[createdAt][gte]=2026-01-01
&filter[createdAt][lt]=2026-06-01
&filter[type]=task
```

Parsed by a single `parseFilters(query)` helper that returns a Prisma `where` clause. Inspired by JSON:API.

For backwards-compat with v3, we **also** accept the OpenProject filter array syntax on the v3 surface:

```
?filters=[{"status":{"operator":"=","values":["open"]}}]
```

### 19.3 Sorting

```
?sort=-updatedAt,subject   // -prefix means DESC
```

Default: `sort=-updatedAt`. We never expose sort fields that aren't in a per-route allowlist (security: prevent expensive unindexed sorts).

### 19.4 Sparse fieldsets

```
?fields[work_package]=id,subject,statusId,assigneeId
?fields[user]=id,name,avatarUrl
```

Implemented in `selectFromFields` helper. The `select` is passed to Prisma so we **don't** over-fetch from PG. For embed (e.g. `_embedded.assignee`), the nested `select` is also pruned.

### 19.5 Count strategy

- For offset pagination: a `COUNT(*)` query is fine for tables < 100k rows. We add a hard cap at 10k for the `total` field and report `hasMore: true` past that.
- For cursor pagination: no count, just `hasMore = rows.length === limit + 1` (fetch one extra).

---

## 20. Search Architecture

### 20.1 Three options

| | PostgreSQL `tsvector` | Meilisearch | Algolia |
|---|---|---|---|
| Cost | $0 (already have PG) | $0 self-host / $30/mo cloud | $1/1k records |
| Setup | `ALTER TABLE ... ADD COLUMN search_tsv tsvector` | Docker / binary | SaaS only |
| Typo tolerance | No | Yes (built-in) | Yes (best in class) |
| Multi-language | Manual dictionaries | Auto | Auto |
| Faceting | Manual | Built-in | Built-in |
| Index size | ~30% of table | ~50% of table | Off-box |
| Maintenance | `pg_trgm` indexes + triggers | Engine handles | Engine handles |

### 20.2 Decision: PostgreSQL `tsvector` for v1, Meilisearch as opt-in

We start with PG because:

- Zero new infra.
- `tsvector` + `ts_rank` is plenty good for 10k–1M work packages.
- Sub-100ms response times for typical queries.
- Triggers can keep the index in sync.

We add a Meilisearch adapter behind a feature flag for installations > 1M WPs that need faceting and typo tolerance.

### 20.3 Schema

```sql
-- migration
ALTER TABLE work_packages ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(string_agg(tag, ' ') OVER (),'')), 'C')
  ) STORED;

CREATE INDEX work_packages_search_idx ON work_packages USING GIN (search_tsv);
```

### 20.4 Query

```sql
SELECT id, subject,
       ts_rank_cd(search_tsv, websearch_to_tsquery('english', $1)) AS rank
FROM work_packages
WHERE search_tsv @@ websearch_to_tsquery('english', $1)
  AND project_id = ANY($2::text[])
  AND deleted_at IS NULL
ORDER BY rank DESC, updated_at DESC
LIMIT 50;
```

### 20.5 API surface

```
GET /api/v1/search?q=login&scope=work_package&projectId=p_9&page=1
```

Returns the standard envelope; `data` is the matched array. Each result has a `highlight: { subject: "<em>login</em> bug" }` field generated by `ts_headline`.

---

## 21. Logging, Correlation IDs, Audit Trail

### 21.1 Structured logging with Pino

```ts
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'api', env: process.env.NODE_ENV, version: process.env.APP_VERSION },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
```

### 21.2 Request-scoped child logger

```ts
// inside withRoute
const reqLogger = logger.child({
  requestId,
  userId: session?.user?.id,
  method: req.method,
  url: req.url,
  route: routeName,
})
```

Pass `reqLogger` to the handler. Use `reqLogger.info({ duration_ms, status })` on completion.

### 21.3 Correlation IDs

- `X-Request-Id` header is **always** set (ULID, generated or echoed from the client).
- Same value is propagated to:
  - `meta.requestId` in the response
  - Sentry `scope.setTag('requestId', id)` and breadcrumb
  - All log lines (via the child logger)
  - All outbound calls (S3, webhooks, email): set `x-request-id` header
  - All Inngest events: `data.requestId` field

This means a single `requestId` lets you trace a request from the browser, through our API, to S3, to the webhook receiver, to the email, to Sentry.

### 21.4 Audit log

See §8.6. We write the `AuditLog` row in a transaction with the mutation (so the audit is durable if the mutation is) and again in `finally` for read paths.

### 21.5 Log levels

- `error` — 5xx, exceptions, Sentry alerts
- `warn` — 4xx, deprecation usage, slow queries (>1s)
- `info` — request completion, lifecycle events
- `debug` — query bodies, payload traces (off in prod)

### 21.6 PII rules

- We **never** log raw request bodies for routes that accept `password`, `token`, `secret`, `cookie`.
- We log a **hash** of the body for these routes (sha256, first 8 chars) so we can correlate.
- We strip `email` from logs at the field level via `redact`.
- GDPR right-to-erasure job (`User.delete`) also purges `AuditLog` rows for that user except where retention is legally required (tax-relevant: 7 years).

---

## 22. Observability — Sentry, OTel, Metrics

### 22.1 Sentry

Already configured in `lib/sentry.ts`. We extend with:

- **Source maps** uploaded in the Next.js build (`@sentry/nextjs` handles this).
- **Release tracking** via `SENTRY_RELEASE` env var (set by CI to the git SHA).
- **Profiling** enabled in production (`profilesSampleRate: 0.1`).
- **User feedback** widget on 5xx responses (opt-in).
- **Session replay** off by default; opt-in per route.

### 22.2 OpenTelemetry

We add an OTel SDK as a thin layer over the existing Sentry integration:

- `@opentelemetry/api` for the trace API (used by `withRoute` to start spans).
- `@opentelemetry/sdk-node` for the SDK (auto-instrumentations for `http`, `pg`, `ioredis`, `next`).
- OTLP exporter to a configurable endpoint (default: `OTEL_EXPORTER_OTLP_ENDPOINT`, falls back to console in dev).

**Spans per request:**

```
http.server [GET /api/v1/work-packages]
├── middleware.auth
├── middleware.rate_limit
├── middleware.validate
├── middleware.authorize
├── cache.get
├── service.list
│   ├── prisma.find_many
│   └── prisma.count
├── broadcast.publish
└── response.serialize
```

### 22.3 Metrics (Prometheus)

`lib/metrics.ts` exists. We extend `prom-client` registry with:

```
http_requests_total{method, route, status}
http_request_duration_seconds{method, route, status}  // histogram
http_requests_in_flight{method, route}
db_query_duration_seconds{model, action}  // histogram
cache_hits_total{resource}
cache_misses_total{resource}
cache_invalidations_total{resource, reason}
rate_limit_consumed_total{bucket}
rate_limit_degraded_total
webhook_deliveries_total{status}
webhook_delivery_duration_seconds{status}
job_duration_seconds{name, status}
sse_connections_active{channel_type}
sse_events_published_total{event_type}
```

Exposed at `GET /api/metrics` (admin auth required).

### 22.4 Alerting (Sentry + OTel)

- 5xx rate > 1% for 5 min → Sentry alert
- p95 latency > 2s for 5 min → Sentry alert
- Cache hit rate < 50% for 10 min → Sentry alert
- Webhook DLQ > 0 → Sentry alert
- SSE connection count > 5k → Sentry info

### 22.5 Health & readiness

- `GET /api/health` — liveness, returns `200 { status: "ok" }` always.
- `GET /api/health/deep` — readiness, hits DB (`SELECT 1`), Redis (`PING`), and the S3 client (`HeadBucket`). Returns `200` or `503` with per-component status.

---

## 23. Concrete Pattern — Annotated Sample Route

This is a complete, real-world example of a v1 route for creating a work package, using the HOF and every layer described above.

### 23.1 The schema (`schemas/work-packages/create.ts`)

```ts
import { z } from 'zod'
import { CuidSchema } from '@/schemas/common/ids'

export const CreateWorkPackageSchema = z.object({
  projectId: CuidSchema,
  typeId: CuidSchema,
  statusId: CuidSchema.optional(),
  subject: z.string().trim().min(1).max(255),
  description: z.string().max(50_000).optional(),
  assigneeId: CuidSchema.nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  estimatedHours: z.number().min(0).max(100_000).nullable().optional(),
  parentId: CuidSchema.nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
}).refine(
  d => !d.startDate || !d.dueDate || d.startDate <= d.dueDate,
  { message: 'startDate must be on or before dueDate', path: ['dueDate'] }
)

export type CreateWorkPackageInput = z.infer<typeof CreateWorkPackageSchema>
```

### 23.2 The service (`services/work-package/create.ts`)

```ts
import { prisma } from '@/lib/prisma'
import { withTransaction } from '@/lib/db/tx'
import { cacheInvalidate, invalidateByTag } from '@/lib/cache'
import { broadcast } from '@/lib/realtime'
import { emit } from '@/lib/events'
import { NotFoundError, BusinessRuleError, ForbiddenError } from '@/lib/errors'
import type { CreateWorkPackageInput } from '@/schemas/work-packages/create'
import type { Session } from 'next-auth'

export async function createWorkPackage(
  input: CreateWorkPackageInput,
  session: Session
) {
  // 1. Verify the project exists + caller is a member
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, identifier: true, archivedAt: true },
  })
  if (!project) throw new NotFoundError('Project', input.projectId)
  if (project.archivedAt) throw new BusinessRuleError('Cannot add work packages to an archived project')

  // 2. Type must belong to project
  const type = await prisma.type.findFirst({
    where: { id: input.typeId, OR: [{ projectId: input.projectId }, { projectId: null }] },
    select: { id: true },
  })
  if (!type) throw new NotFoundError('Type', input.typeId)

  // 3. Default status (first by position) if not given
  let statusId = input.statusId
  if (!statusId) {
    const defaultStatus = await prisma.status.findFirst({
      where: { isDefault: true },
      select: { id: true },
    })
    if (!defaultStatus) throw new BusinessRuleError('No default status configured')
    statusId = defaultStatus.id
  }

  // 4. If parentId given, verify it belongs to the same project
  if (input.parentId) {
    const parent = await prisma.workPackage.findUnique({
      where: { id: input.parentId },
      select: { projectId: true },
    })
    if (!parent || parent.projectId !== input.projectId) {
      throw new BusinessRuleError('Parent work package must be in the same project')
    }
  }

  // 5. Transactional create (so journal entry + audit log are atomic)
  const wp = await withTransaction(async (tx) => {
    const created = await tx.workPackage.create({
      data: {
        projectId: input.projectId,
        typeId: input.typeId,
        statusId,
        subject: input.subject,
        description: input.description,
        assigneeId: input.assigneeId,
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        estimatedTime: input.estimatedHours ? `${input.estimatedHours}h` : null,
        parentId: input.parentId,
        customFields: input.customFields as any,
        authorId: session.user.id,
        version: 1,
      },
    })

    // 6. Audit log row inside the same transaction
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'work_package.create',
        resource: 'work_package',
        resourceId: created.id,
        projectId: created.projectId,
        changes: { after: created },
      },
    })

    return created
  })

  // 7. Cache invalidation (post-commit)
  await invalidateByTag(`project:${input.projectId}`)
  if (input.assigneeId) await invalidateByTag(`assignee:${input.assigneeId}`)

  // 8. Realtime broadcast
  broadcast({
    channels: [`project:${input.projectId}`],
    type: 'work_package.created',
    payload: { id: wp.id, subject: wp.subject, typeId: wp.typeId, author: { id: session.user.id, name: session.user.name } },
    actor: { id: session.user.id, name: session.user.name },
  })

  // 9. Domain event (for webhooks, etc.)
  emit('work_package.created', { workPackage: wp, actor: session.user })

  return wp
}
```

### 23.3 The route (`pages/api/v1/work-packages/index.ts`)

```ts
import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'
import { CreateWorkPackageSchema } from '@/schemas/work-packages/create'
import { createWorkPackage } from '@/services/work-package/create'
import { enqueueWebhookEvent } from '@/lib/jobs/queue'
import { logger } from '@/lib/logger'
import { ulid } from '@/lib/ids'

export default withRoute({
  auth: 'required',
  permissions: [{ permission: 'work_package.add', projectIdFrom: 'body' }],
  rateLimit: { bucket: 'write.global', points: 30, window: '1m' },
  validate: { body: CreateWorkPackageSchema },
  audit: { action: 'work_package.create' },
}, async ({ body, session, reqLogger }) => {
  reqLogger.info({ route: 'work_packages.create' }, 'creating work package')

  const wp = await createWorkPackage(body, session!)

  // Return the created resource; withRoute wraps it in the envelope
  return {
    status: 201,
    body: wp,
    headers: { Location: `/api/v1/work-packages/${wp.id}` },
  }
})
```

### 23.4 What the client sees

`POST /api/v1/work-packages` with body `{ "projectId": "p_9", "typeId": "t_2", "subject": "Fix login bug" }`.

**201 Created**:

```json
{
  "data": {
    "id": "wp_01HXYZ",
    "projectId": "p_9",
    "typeId": "t_2",
    "statusId": "st_open",
    "subject": "Fix login bug",
    "version": 1,
    "createdAt": "2026-06-06T12:34:56.789Z",
    "updatedAt": "2026-06-06T12:34:56.789Z",
    "authorId": "u_1"
  },
  "meta": { "requestId": "req_01HXYZ", "timestamp": "2026-06-06T12:34:56.789Z", "version": "1.0" },
  "links": { "self": "/api/v1/work-packages/wp_01HXYZ" }
}
```

Headers:

```
HTTP/1.1 201 Created
Content-Type: application/vnd.api+json
X-Request-Id: req_01HXYZ
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1717672500
Location: /api/v1/work-packages/wp_01HXYZ
```

**400 Bad Request** (invalid body):

```json
{
  "errors": [{
    "code": "validation_failed",
    "title": "Some fields are invalid.",
    "detail": "subject: must be a non-empty string",
    "source": { "pointer": "/data/attributes/subject" },
    "meta": { "field": "subject", "rule": "min_length:1" }
  }],
  "meta": { "requestId": "req_01HABC", "timestamp": "2026-06-06T12:34:56.789Z" }
}
```

**403 Forbidden** (no permission):

```json
{
  "errors": [{
    "code": "permission_denied",
    "title": "You don't have permission to work package add.",
    "detail": "Missing permission: work_package.add"
  }],
  "meta": { "requestId": "req_01HDEF" }
}
```

**429 Too Many Requests**:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1717672560
Retry-After: 12

{ "errors": [{ "code": "rate_limited", "title": "Too many requests. Please slow down.", "detail": "Rate limit; retry after 12s" }] }
```

---

## 24. Module-by-Module Route Map

A condensed version; each module's routes follow the patterns in §4–§5.

### 24.1 Auth (`/api/v1/auth/*`)

```
POST   /auth/login               (rate-limit: auth.login)
POST   /auth/logout
POST   /auth/signup              (rate-limit: auth.signup)
GET    /auth/session
GET    /auth/csrf
POST   /auth/2fa/enable
POST   /auth/2fa/verify
POST   /auth/password-reset/request
POST   /auth/password-reset/confirm
POST   /auth/oauth/:provider/callback
```

### 24.2 Users (`/api/v1/users/*`)

```
GET    /users
POST   /users
GET    /users/:id
PATCH  /users/:id
DELETE /users/:id
GET    /users/:id/notification-settings
PATCH  /users/:id/notification-settings
GET    /users/:id/time-entries
GET    /users/:id/assigned-work-packages
GET    /users/:id/audit-log
POST   /users/:id/avatar
GET    /users/me
```

### 24.3 Projects (`/api/v1/projects/*`)

```
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
POST   /projects/:id/archive
POST   /projects/:id/copy
GET    /projects/:id/members
POST   /projects/:id/members
PATCH  /projects/:id/members/:userId
DELETE /projects/:id/members/:userId
GET    /projects/:id/types
GET    /projects/:id/queries
GET    /projects/:id/work-packages
GET    /projects/:id/activity
GET    /projects/:id/wiki
GET    /projects/:id/forums
GET    /projects/:id/meetings
```

### 24.4 Work Packages (`/api/v1/work-packages/*`)

```
GET    /work-packages
POST   /work-packages
GET    /work-packages/:id
PATCH  /work-packages/:id
DELETE /work-packages/:id
POST   /work-packages/:id/duplicate
POST   /work-packages/:id/move
GET    /work-packages/:id/relations
POST   /work-packages/:id/relations
GET    /work-packages/:id/watchers
POST   /work-packages/:id/watchers/:userId
DELETE /work-packages/:id/watchers/:userId
GET    /work-packages/:id/attachments
GET    /work-packages/:id/activity
GET    /work-packages/:id/comments
POST   /work-packages/:id/comments
GET    /work-packages/:id/revisions
POST   /work-packages/bulk-update
POST   /work-packages/bulk-jobs
GET    /work-packages/bulk-jobs/:jobId
```

### 24.5 Wiki (`/api/v1/projects/:projectId/wiki/*` and `/api/v1/wiki/*`)

```
GET    /projects/:projectId/wiki
POST   /projects/:projectId/wiki
GET    /projects/:projectId/wiki/:slug
PATCH  /projects/:projectId/wiki/:slug
DELETE /projects/:projectId/wiki/:slug
GET    /projects/:projectId/wiki/:slug/history
POST   /projects/:projectId/wiki/:slug/attachments
```

### 24.6 Forums (`/api/v1/projects/:projectId/forums/*`)

```
GET    /projects/:projectId/forums
POST   /projects/:projectId/forums
GET    /projects/:projectId/forums/:forumId
PATCH  /projects/:projectId/forums/:forumId
DELETE /projects/:projectId/forums/:forumId
GET    /projects/:projectId/forums/:forumId/topics
POST   /projects/:projectId/forums/:forumId/topics
GET    /projects/:projectId/forums/:forumId/topics/:topicId
PATCH  /projects/:projectId/forums/:forumId/topics/:topicId
DELETE /projects/:projectId/forums/:forumId/topics/:topicId
GET    /projects/:projectId/forums/:forumId/topics/:topicId/posts
POST   /projects/:projectId/forums/:forumId/topics/:topicId/posts
```

### 24.7 Meetings (`/api/v1/projects/:projectId/meetings/*`)

```
GET    /projects/:projectId/meetings
POST   /projects/:projectId/meetings
GET    /projects/:projectId/meetings/:meetingId
PATCH  /projects/:projectId/meetings/:meetingId
DELETE /projects/:projectId/meetings/:meetingId
GET    /projects/:projectId/meetings/:meetingId/participants
POST   /projects/:projectId/meetings/:meetingId/participants
DELETE /projects/:projectId/meetings/:meetingId/participants/:userId
GET    /projects/:projectId/meetings/:meetingId/agenda
POST   /projects/:projectId/meetings/:meetingId/agenda
PATCH  /projects/:projectId/meetings/:meetingId/agenda/:itemId
DELETE /projects/:projectId/meetings/:meetingId/agenda/:itemId
GET    /projects/:projectId/meetings/:meetingId/minutes
PATCH  /projects/:projectId/meetings/:meetingId/minutes
```

### 24.8 Time tracking (`/api/v1/time-entries/*`)

```
GET    /time-entries
POST   /time-entries
GET    /time-entries/:id
PATCH  /time-entries/:id
DELETE /time-entries/:id
GET    /time-entries/reports
```

### 24.9 Notifications

```
GET    /notifications
PATCH  /notifications/:id    (mark as read)
POST   /notifications/mark-all-read
GET    /notification-settings
PATCH  /notification-settings
```

### 24.10 Files & attachments

```
POST   /files/upload-url
POST   /files/confirm
GET    /files/:id
DELETE /files/:id
GET    /files/:id/download
```

### 24.11 Webhooks

```
GET    /webhooks
POST   /webhooks
GET    /webhooks/:id
PATCH  /webhooks/:id
DELETE /webhooks/:id
POST   /webhooks/:id/test
POST   /webhooks/:id/replay/:deliveryId
GET    /webhooks/:id/deliveries
```

### 24.12 API tokens

```
POST   /api-tokens
GET    /api-tokens
DELETE /api-tokens/:id
POST   /api-tokens/:id/revoke
```

### 24.13 Admin

```
GET    /admin/users
POST   /admin/users/:id/lock
POST   /admin/users/:id/unlock
POST   /admin/users/:id/reset-password
GET    /admin/audit-log
GET    /admin/settings
PATCH  /admin/settings
GET    /admin/system-info
POST   /admin/maintenance/enable
POST   /admin/maintenance/disable
POST   /admin/cache/purge
```

### 24.14 Realtime & SSE

```
GET    /sse
POST   /sse/heartbeat
POST   /sse/presence
```

### 24.15 Health & metrics

```
GET    /health
GET    /health/deep
GET    /metrics
```

---

## 25. Migration Plan from 144 Routes

### 25.1 Strategy: Strangler Fig + Backward Compat

We **do not** rewrite 144 routes in one go. We apply the [Strangler Fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html):

1. **Phase A** (week 1–2): Build the new infrastructure (`withRoute`, errors, schemas, services, cache, rate limit, SSE, webhook v2) without changing any existing routes.
2. **Phase B** (week 3–6): Migrate the most-trafficked modules (work-packages, projects, users) to v1. Keep the old routes as thin v3-style adapters.
3. **Phase C** (week 7–10): Migrate the long tail (wiki, forums, meetings, time-entries, notifications).
4. **Phase D** (week 11–12): Deprecate the old v1 (un-versioned) routes. Add `Deprecation: true` and `Sunset` headers. Update web client to use `/api/v1/*` and `/api/trpc/*`.
5. **Phase E** (week 13+): Remove old routes after the sunset date.

### 25.2 Mapping

| Current path | New path | Action |
|---|---|---|
| `pages/api/projects/index.ts` | `pages/api/v1/projects/index.ts` | Migrate |
| `pages/api/projects/[projectId]/index.ts` | `pages/api/v1/projects/[projectId]/index.ts` | Migrate |
| `pages/api/work-packages/...` (60 files) | `pages/api/v1/work-packages/...` | Migrate in 3 batches |
| `pages/api/users/...` (8 files) | `pages/api/v1/users/...` | Migrate |
| `pages/api/v3/*.ts` (5 files) | `pages/api/v3/*.ts` (rewrite as adapters) | Refactor in place |
| `pages/api/sse/...` | `pages/api/v1/sse.ts` | Migrate |
| `pages/api/webhooks/...` | `pages/api/v1/webhooks/...` | Migrate |
| `pages/api/admin/...` | `pages/api/v1/admin/...` | Migrate |
| `pages/api/forum/...` (4 files) | `pages/api/v1/projects/[projectId]/forums/...` | Migrate + restructure |
| `pages/api/wiki/...` (4 files) | `pages/api/v1/projects/[projectId]/wiki/...` | Migrate + restructure |
| `pages/api/auth/...` (6 files) | Mostly NextAuth managed, custom in `pages/api/v1/auth/...` | Migrate |
| `pages/api/health.ts` | `pages/api/health.ts` (no version, no auth) | Keep, refactor |
| `pages/api/metrics.ts` | `pages/api/metrics.ts` (no version, auth) | Keep, refactor |

### 25.3 Per-route refactor checklist

For each existing route, the migration PR must:

- [ ] Read the existing handler, list every code path
- [ ] Identify the service function(s) it calls
- [ ] Write or extend the service function (move logic out of the route)
- [ ] Write the Zod schema (request body, query, params)
- [ ] Rewrite the route as `withRoute({ ... }, handler)`
- [ ] Add `audit: { ... }` config
- [ ] Add `cache: { ... }` config if appropriate
- [ ] Update all callers (web client tRPC / TanStack Query hooks)
- [ ] Add Vitest tests (auth, RBAC, validation, happy path, error paths)
- [ ] Add an OpenAPI annotation (`@OpenAPIRoute({...})`)
- [ ] Verify Sentry receives errors correctly (force a 500, check event)
- [ ] Verify the request ID flows through (curl with `X-Request-Id`, check Sentry breadcrumb)

### 25.4 Backward compatibility guarantees

For **6 months** after the v1 release, old routes return `Deprecation: true` and `Sunset: <date>`. After the sunset, they return `410 Gone` with a body explaining the migration path.

The old `/api/v3/*` surface is **permanent** for read-only access (per §18).

### 25.5 Client migration

The web client currently uses TanStack Query hooks in `hooks/`. We add a codegen step:

- `npm run codegen:api` reads the OpenAPI spec and generates `hooks/api/*.ts` with typed fetchers and Zod-validated responses.
- For internal use, tRPC replaces these hooks.

### 25.6 Rollout flags

Each new route lives behind a `feature.{module}.v2` flag. We enable per tenant in production for one week, monitor error rates, then enable globally.

### 25.7 Estimated effort

| Module | Routes | Effort (eng-days) | Risk |
|---|---|---|---|
| Infrastructure (withRoute, errors, schemas, services scaffolding) | – | 8 | Low |
| work-packages | 60 | 12 | High (hot path) |
| projects + members | 12 | 4 | Med |
| users | 8 | 2 | Low |
| auth (non-NextAuth) | 4 | 1 | Low |
| wiki | 4 | 1 | Low |
| forums | 4 | 1 | Low |
| meetings | 3 | 1 | Low |
| documents | 2 | 0.5 | Low |
| time-entries + time-reports | 4 | 1 | Low |
| notifications + settings | 4 | 1 | Low |
| files | 3 | 1 | Low |
| webhooks | 3 | 1 | Med (DLQ logic) |
| SSE | 1 | 0.5 | Med |
| admin | 4 | 1 | Low |
| v3 adapters | 5 | 2 | Med (HAL shape) |
| groups, priorities, statuses, types, relations, queries, custom-fields, exports, ldap, 2fa | 24 | 4 | Low |
| Tests (all modules) | – | 10 | – |
| Codegen, docs, OpenAPI | – | 4 | – |
| **Total** | ~144 | **~55 eng-days** | – |

---

## 26. Top 12 Improvements vs Current

Each item has: the problem, the fix, and a code snippet.

### 26.1 Inconsistent response envelopes

**Current:** Some return `{ success, data, message }`, some return raw arrays, some return `{ items, total }`, some return HAL.

**Fix:** A single `envelopify(data, requestId, req)` function in `lib/api/envelope.ts` applied by `withRoute`. All routes return raw data; the envelope is added centrally.

```ts
// lib/api/envelope.ts
export function envelopify(data: unknown, requestId: string, req: NextApiRequest) {
  return {
    data,
    meta: { requestId, timestamp: new Date().toISOString(), version: '1.0' },
    links: { self: req.url },
  }
}
```

### 26.2 No error class hierarchy

**Current:** Routes `try { ... } catch (error: any) { return res.status(500).json({ error: error.message }) }`, leaking Prisma error messages, SQL fragments, stack traces.

**Fix:** Throw `ApiError` subclasses, central `formatError` translates unknowns to `InternalError` (with the original as `cause` and Sentry capture), the formatter builds the standard error envelope.

```ts
// Before
try {
  const wp = await prisma.workPackage.create({ data: body })
  res.json(wp)
} catch (e) {
  res.status(500).json({ error: e.message })  // leaks PII / SQL
}

// After
withRoute({ ... }, async ({ body, session }) => {
  return await prisma.workPackage.create({ data: body })  // errors caught centrally
})
```

### 26.3 Rate limiter is IP-only and fragile

**Current:** `lib/ratelimit.ts` uses `rate-limiter-flexible` + `ioredis`, not `@upstash/ratelimit` despite it being in deps. Single 10/second IP bucket, no per-user, no per-endpoint, no bucket registry, fail-open silently.

**Fix:** Switch to `@upstash/ratelimit` sliding window. Define named buckets in `lib/ratelimit/buckets.ts`. Apply per-user when authenticated, per-IP otherwise. Add per-endpoint overrides via the route's `rateLimit` config.

```ts
// lib/ratelimit/buckets.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const sliding = (n: number, w: string) => new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, w), prefix: 'op:rl', analytics: true })

export const buckets = {
  authLogin:   sliding(5, '1 m'),
  write:       sliding(300, '1 m'),
  read:        sliding(600, '1 m'),
  expensive:   sliding(10, '1 m'),
  sseConn:     sliding(5, '1 m'),
}
```

### 26.4 `getServerSession(authOptions)` 1-arg form

**Current:** Some routes call `getServerSession(authOptions)` which is the v5 API; with the v4 package installed, this returns `null` in nested routes (Edge runtime / middleware context).

**Fix:** All routes use `getServerSession(req, res, authOptions)`. Add ESLint rule `no-invalid-getServerSession-arg` and a test that runs every route in a nested context to verify.

```ts
// .eslintrc custom rule
'custom/no-invalid-getServerSession-arg': 'error'
```

```ts
// scripts/check-session-shape.ts — runs in CI
import { glob } from 'glob'
import { readFile } from 'fs/promises'
const files = await glob('pages/api/**/*.ts')
for (const f of files) {
  const src = await readFile(f, 'utf8')
  if (/getServerSession\(\s*authOptions\s*\)/.test(src)) {
    console.error(`❌ ${f}: getServerSession(authOptions) is the v5 form; use getServerSession(req, res, authOptions)`)
    process.exit(1)
  }
}
```

### 26.5 No request validation

**Current:** Bodies are cast to types with `as CreateWorkPackageInput`. `parseFilters` in `pages/api/v3/work-packages.ts` silently swallows malformed JSON.

**Fix:** Zod schemas in `schemas/`, applied by `withRoute.validate.body`. Unknown keys are stripped by default (or rejected with `strict()`). Malformed filters → 400 with details.

```ts
// Before
const filters = JSON.parse(filtersParam || '[]')  // throws caught silently

// After
const filters = FiltersQuerySchema.parse(req.query.filters)  // throws ValidationError → 400
```

### 26.6 Cache keys not namespaced

**Current:** `cacheGet('user-123')`, `cacheGet('wp-123')` collide in the same namespace. No invalidation strategy; writes do `cacheInvalidate('wp-123')` but a list of WPs isn't keyed by the WP, so it's not invalidated.

**Fix:** Deterministic, namespaced keys (`op:v1:{env}:work_package:{id}:v=1`) + tag-based invalidation. List caches tagged by `project:{id}`, `assignee:{id}`, `type:{id}`.

```ts
// On WorkPackage.update
await invalidateByTag(`project:${wp.projectId}`)
await invalidateByTag(`assignee:${wp.assigneeId ?? 'unassigned'}`)
await cacheInvalidate(buildKey('work_package', wp.id))
```

### 26.7 Webhook dispatcher: fixed delays, no jitter, no DLQ

**Current:** `RETRY_DELAYS = [1m, 5m, 30m, 2h, 24h]` exactly. If 1000 webhooks all 500 at once, they all retry at the same minute → thundering herd.

**Fix:** Exponential backoff with jitter, DLQ after 5 attempts, page on-call.

```ts
function nextDelay(attempt: number) {
  const base = Math.min(60_000 * 2 ** attempt, 24 * 3600_000)
  return base + Math.random() * Math.min(base * 0.1, 60_000)
}
```

### 26.8 SSE channels are user-only, not resource-scoped

**Current:** `sse:{userId}` only. To push a project event, the producer iterates all members. Filtering on the client side.

**Fix:** Channel taxonomy (`user:*`, `project:*`, `work_package:*`, `admin`, `global`). Client subscribes to a union. Server publishes to each relevant channel; subscribers with overlapping channels receive once (deduped by `eventId`).

### 26.9 Sentry init at module top-level

**Current:** `lib/sentry.ts` calls `Sentry.init({...})` at import time. Importing from a test file sends events; in dev, it floods; source maps are misconfigured.

**Fix:** Lazy init, called from `instrumentation.ts` (Next.js's official hook) and from `withRoute` for runtime config; add source-map upload to CI build.

```ts
// instrumentation.ts (Next.js convention)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./lib/sentry.edge.config')
  }
}
```

### 26.10 `isSystemAdmin` does a DB hit per call

**Current:** Every privileged check re-queries `User` for `isSystemAdmin`.

**Fix:** Cache in the JWT (already partially done), refresh on user update, expose as `session.user.isSystemAdmin`. Permission checks read from JWT, not from DB.

```ts
// lib/auth.ts (jwt callback)
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = user.id
      token.isSystemAdmin = (user as any).isSystemAdmin  // hydrated at login
    }
    if (trigger === 'update') {
      const fresh = await prisma.user.findUnique({ where: { id: token.id as string }, select: { isSystemAdmin: true } })
      token.isSystemAdmin = fresh?.isSystemAdmin ?? false
    }
    return token
  }
}
```

### 26.11 No idempotency keys

**Current:** `POST /api/work-packages` creates a new row every call. Network blip + retry → duplicate.

**Fix:** `Idempotency-Key` header support in `withRoute`. Store `(key, response)` in Redis for 24 h. Replay on retry.

### 26.12 No request correlation IDs

**Current:** `withApiLogging` does not stamp an `X-Request-Id`. Sentry breadcrumbs are unjoinable across services.

**Fix:** `withRoute` generates/echoes `X-Request-Id` as a ULID, sets it on the response, attaches to the logger, sets as a Sentry tag, propagates to outbound HTTP and Inngest events.

```ts
const requestId = req.headers['x-request-id'] || ulid()
res.setHeader('X-Request-Id', requestId)
Sentry.withScope(s => s.setTag('requestId', requestId))
const reqLogger = logger.child({ requestId, userId: session?.user?.id, route: routeName })
```

---

## 27. Quality Gates & CI Checks

### 27.1 Pre-commit (Husky + lint-staged)

```bash
npx tsc --noEmit
npx eslint --fix pages/api lib/services schemas
npx vitest run --related
```

### 27.2 CI pipeline

```yaml
# .github/workflows/ci.yml
- name: Type check
  run: npx tsc --noEmit
- name: Lint
  run: npm run lint
- name: Test
  run: npm test
- name: OpenAPI diff
  run: npm run openapi:diff  # fails if public API changes without a changelog entry
- name: API coverage
  run: npm run test:api  # runs every route against fixtures
- name: Sentry source map upload
  run: npx sentry-cli releases files $RELEASE upload-sourcemaps .next
- name: Build
  run: npm run build
```

### 27.3 Custom ESLint rules

- `custom/no-invalid-getServerSession-arg` — flags 1-arg form.
- `custom/require-zod-validation` — flags `pages/api/**/*.ts` handlers without a Zod schema on body/params (when the route accepts a body).
- `custom/no-direct-prisma-in-routes` — routes should call services, not Prisma directly. Whitelist `lib/services/`, `repositories/`.
- `custom/no-raw-error-message` — flags `res.json({ error: err.message })` patterns.
- `custom/require-rate-limit` — flags write routes without a `rateLimit` config.

### 27.4 Contract tests

For every route, a test that:
- Sends a happy-path request and asserts the **response schema** (Zod-validated).
- Sends an unauthenticated request and asserts 401.
- Sends an unauthorized request and asserts 403.
- Sends a malformed body and asserts 400 with `code: 'validation_failed'`.
- Sends a request that exceeds the rate limit and asserts 429.

These tests run in CI for every PR and block merges.

### 27.5 Load testing (k6)

`/home/cwlai/openproject-rewrite/k6/` already exists. We extend with scenarios for:

- 100 RPS sustained on `GET /api/v1/work-packages`
- 20 RPS sustained on `POST /api/v1/work-packages`
- 1000 concurrent SSE connections

Pass criteria: p99 < 500ms, error rate < 0.1%, no connection drops.

---

## 28. Appendices

### 28.1 Appendix A — Permission strings (full)

```
# Users
user.view
user.edit
user.delete
user.lock
user.reset_password

# Projects
project.view
project.create
project.edit
project.delete
project.archive
project.copy
project.member.view
project.member.create
project.member.edit
project.member.delete
project.settings.edit

# Work packages
work_package.view
work_package.view_others
work_package.add
work_package.edit
work_package.edit_status
work_package.edit_assignee
work_package.edit_dates
work_package.edit_percentage
work_package.delete
work_package.move
work_package.duplicate
work_package.comment
work_package.comment_edit_others
work_package.comment_delete_others
work_package.assign
work_package.watch
work_package.export
work_package.attachment_upload
work_package.attachment_delete

# Wiki
wiki.view
wiki.create
wiki.edit
wiki.delete
wiki.history
wiki.attachment_upload

# Forums
forum.view
forum.create
forum.edit
forum.delete
forum.post.create
forum.post.edit
forum.post.delete
forum.post.attachment_upload

# Meetings
meeting.view
meeting.create
meeting.edit
meeting.delete
meeting.invite
meeting.agenda.manage
meeting.minutes.manage

# Time
time_entry.log
time_entry.log_others
time_entry.approve
time_entry.view_all
time_report.view

# Notifications
notification.view
notification.send
notification_settings.edit

# Files
file.upload
file.delete
file.view

# Webhooks
webhook.view
webhook.create
webhook.edit
webhook.delete
webhook.test

# API tokens
api_token.view
api_token.create
api_token.revoke

# Admin
admin.view
admin.settings.edit
admin.users.manage
admin.audit.view
admin.maintenance
admin.system.info
system.admin       // super-bypass
```

### 28.2 Appendix B — Cache key spec

| Key | TTL | Invalidation |
|---|---|---|
| `op:v1:{env}:user:{userId}:profile` | 5 m | `User.update` |
| `op:v1:{env}:user:{userId}:permissions` | 5 m | Role/perm change, logout |
| `op:v1:{env}:project:{projectId}:summary` | 10 m | `Project.update` |
| `op:v1:{env}:project:{projectId}:members` | 60 s | `Membership.*` |
| `op:v1:{env}:work_package:{wpId}:v={SCHEMA_VERSION}` | 60 s | `WorkPackage.update` |
| `op:v1:{env}:work_package:list:project:{projectId}:filter={hash}:sort={hash}:page={n}` | 30 s | tag-based |
| `op:v1:{env}:idempotency:{userId}:{key}` | 24 h | n/a |
| `op:v1:{env}:ratelimit:{bucket}:{identity}:{window}` | 1 m | n/a |
| `op:v1:{env}:sse:channel:{channelType}:{channelId}:last-events` | 1 d | n/a |
| `op:v1:{env}:schema:version` | 1 h | n/a (bumped on deploy) |

### 28.3 Appendix C — OpenAPI generation

We use `@asteasolutions/zod-to-openapi` to derive the OpenAPI 3.1 spec from Zod schemas. The CI step `openapi:diff` fails if the generated spec changes without a CHANGELOG entry.

```ts
// schemas/work-packages/create.ts
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
extendZodWithOpenApi(z)

export const CreateWorkPackageSchema = z.object({ ... }).openapi('CreateWorkPackageInput')
```

The OpenAPI spec is served at `GET /api/openapi.json` (no auth) and at `GET /api/redoc` (Redoc UI).

### 28.4 Appendix D — tRPC router example

```ts
// server/trpc/routers/work-packages.ts
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { CreateWorkPackageSchema } from '@/schemas/work-packages/create'
import { createWorkPackage } from '@/services/work-package/create'
import { listWorkPackages } from '@/services/work-package/list'

export const workPackagesRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().cuid().optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => listWorkPackages(input, ctx.session)),
  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => getWorkPackage(input.id, ctx.session)),
  create: protectedProcedure
    .input(CreateWorkPackageSchema)
    .mutation(async ({ ctx, input }) => createWorkPackage(input, ctx.session)),
  update: protectedProcedure
    .input(z.object({ id: z.string().cuid(), version: z.number().int().min(1), patch: UpdateWorkPackageSchema }))
    .mutation(async ({ ctx, input }) => updateWorkPackage(input, ctx.session)),
})
```

```ts
// pages/api/trpc/[trpc].ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/trpc/router'
import { createContext } from '@/server/trpc/context'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: req as any,
    router: appRouter,
    createContext: () => createContext({ req, res }),
    onError: ({ path, error }) => Sentry.captureException(error),
  })
}
```

### 28.5 Appendix E — Rate limit response headers

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1717672560   // unix seconds
Retry-After: 12                 // only on 429
```

### 28.6 Appendix F — Sample error responses (full set)

**400** — schema validation

```json
{ "errors": [{ "code": "validation_failed", "title": "Some fields are invalid.", "detail": "subject: must be a non-empty string", "source": { "pointer": "/data/attributes/subject" }, "meta": { "field": "subject" } }], "meta": { "requestId": "req_01H..." } }
```

**401**

```json
{ "errors": [{ "code": "unauthorized", "title": "You must be signed in." }] }
```

**403**

```json
{ "errors": [{ "code": "permission_denied", "title": "You don't have permission to work package add.", "meta": { "permission": "work_package.add" } }] }
```

**404** — deliberately ambiguous for security (we don't reveal whether the WP exists vs. is hidden)

```json
{ "errors": [{ "code": "not_found", "title": "The requested item was not found." }] }
```

**409** — duplicate (unique constraint)

```json
{ "errors": [{ "code": "duplicate", "title": "A record with that email already exists.", "meta": { "field": "email" } }] }
```

**409** — version conflict

```json
{ "errors": [{ "code": "etag_mismatch", "title": "The item was changed by someone else. Please refresh.", "meta": { "expectedVersion": 3, "actualVersion": 4 } }] }
```

**422** — business rule

```json
{ "errors": [{ "code": "business_rule_violation", "title": "This action is not allowed in the current state.", "meta": { "rule": "wp_is_closed" } }] }
```

**429**

```json
{ "errors": [{ "code": "rate_limited", "title": "Too many requests. Please slow down.", "meta": { "retryAfter": 12 } }] }
```

**500** — generic, no leak

```json
{ "errors": [{ "code": "internal_error", "title": "Something went wrong. Please try again.", "meta": { "requestId": "req_01H..." } }] }
```

### 28.7 Appendix G — Dependency additions

To realise this design, we add the following packages (justification per package):

| Package | Why |
|---|---|
| `@asteasolutions/zod-to-openapi` | Derive OpenAPI spec from Zod schemas |
| `@sentry/nextjs` (already) | Errors + perf |
| `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http` | Traces |
| `pino`, `pino-pretty` (dev) | Structured logs |
| `ulid` | Request IDs, webhook delivery IDs |
| `inngest` | Background jobs |
| `@upstash/ratelimit` (already) | Rate limit |
| `@upstash/redis` (already) | Cache, pubsub |
| `@aws-sdk/client-s3` (already), `@aws-sdk/s3-request-presigner` (already), `@aws-sdk/s3-presigned-post` | Multipart uploads |
| `next-auth@5.0.0-beta` (optional) | Migration off v4 |

### 28.8 Appendix H — File map (target state)

```
pages/api/
├── health.ts                            (no version, no auth)
├── health/
│   └── deep.ts
├── metrics.ts
├── v1/
│   ├── auth/                            (login, logout, signup, 2fa, password reset, OAuth)
│   ├── users/                           (CRUD, settings, time-entries, etc.)
│   ├── projects/                        (CRUD, members, types, queries, activity)
│   │   └── [projectId]/
│   │       ├── work-packages/           (CRUD, relations, watchers, attachments, comments, bulk)
│   │       ├── wiki/                    (CRUD, history)
│   │       ├── forums/                  (CRUD, topics, posts)
│   │       └── meetings/                (CRUD, participants, agenda, minutes)
│   ├── work-packages/                   (flat: cross-project queries, bulk)
│   ├── time-entries/
│   ├── time-reports/
│   ├── notifications/
│   ├── notification-settings/
│   ├── files/
│   ├── webhooks/
│   ├── api-tokens/
│   ├── admin/
│   ├── sse.ts
│   ├── search.ts
│   ├── custom-fields/
│   ├── statuses/
│   ├── priorities/
│   ├── types/
│   ├── roles/
│   ├── groups/
│   ├── relations/
│   ├── queries/
│   ├── project-templates/
│   ├── announcements/
│   ├── documents/
│   ├── my-page/
│   ├── exports/
│   ├── email/
│   ├── ldap/
│   ├── 2fa/
│   ├── openapi.json.ts
│   └── redoc.ts
├── v3/                                  (OpenProject compat adapters — read-only)
│   ├── index.ts                         (API root)
│   ├── projects.ts
│   ├── work-packages.ts
│   ├── users.ts
│   ├── users/
│   └── ...
└── trpc/
    └── [trpc].ts                        (tRPC entry)

lib/
├── auth.ts                              (NextAuth config; v4 for now, v5 path documented)
├── prisma.ts                            (singleton + read replica)
├── prisma-read.ts
├── sentry.ts                            (lazy init)
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── logger.ts                            (pino)
├── ids.ts                               (ulid, cuid wrappers)
├── ratelimit.ts                         (Upstash sliding window)
├── ratelimit/
│   ├── buckets.ts
│   ├── route.ts
│   └── identity.ts
├── cache/
│   ├── redis.ts                         (existing — keep, extend)
│   ├── keys.ts                          (key builder)
│   ├── tags.ts                          (tag-based invalidation)
│   └── single-flight.ts
├── realtime/
│   ├── sse.ts                           (SSE handler)
│   ├── broadcast.ts                     (publisher)
│   ├── channels.ts                      (channel taxonomy)
│   └── presence.ts
├── events/
│   ├── emit.ts                          (in-process emitter)
│   ├── subscribe.ts
│   └── types.ts
├── jobs/
│   ├── queue.ts                         (Inngest adapter; BullMQ fallback)
│   ├── handlers/                        (one file per job)
│   └── types.ts
├── files/
│   ├── s3.ts
│   ├── presign.ts
│   ├── multipart.ts
│   └── confirm.ts
├── webhooks/
│   ├── dispatcher.ts                    (retry with jitter + DLQ)
│   ├── signature.ts                     (HMAC)
│   ├── delivery.ts
│   └── types.ts
├── api/
│   ├── withRoute.ts                     (the HOF)
│   ├── envelope.ts                      (response envelope)
│   ├── errors.ts                        (error classes)
│   ├── formatter.ts                     (error → response)
│   ├── audit.ts                         (audit log writer)
│   ├── cache.ts                         (cache-aside helper)
│   ├── idempotency.ts                   (idempotency key store)
│   └── v3/                              (HAL adapter helpers)
│       ├── adapter.ts
│       └── to-hal.ts
├── permissions/
│   ├── can.ts                           (can() helper)
│   ├── expand.ts                        (resolve user permissions for a project)
│   └── matrix.ts                        (default role → permission mapping)
├── observability/
│   ├── context.ts                       (request context propagation)
│   ├── otel.ts                          (OTel SDK init)
│   └── sentry.ts                        (Sentry helpers)
├── db/
│   ├── tx.ts                            (withTransaction)
│   └── raw.ts                           (raw SQL escape hatch)
├── export/                              (CSV / PDF / XLSX)
├── gantt/                               (gantt chart helpers)
├── markdown.ts
├── meeting-conflict.ts
├── metrics.ts                           (Prometheus registry)
├── query-client.ts                      (TanStack Query client)
├── utils.ts
├── vcs/                                 (Git integration)
├── activity.ts
├── 2fa/
└── notifications/                       (multi-channel)

services/                                (new — pure business logic)
├── work-package/
│   ├── create.ts
│   ├── update.ts
│   ├── delete.ts
│   ├── get.ts
│   ├── list.ts
│   ├── relations.ts
│   ├── comments.ts
│   └── bulk.ts
├── project/
├── user/
├── membership/
├── permission/
├── notification/
├── search/
├── webhook/
├── file/
├── audit/
└── ...

schemas/                                 (Zod schemas; shared with client)
├── common/
├── work-packages/
├── projects/
├── users/
└── ...

server/                                  (tRPC)
├── trpc.ts
├── context.ts
├── trpc/
│   ├── trpc.ts
│   └── routers/
│       ├── index.ts                     (appRouter)
│       ├── work-packages.ts
│       ├── projects.ts
│       ├── users.ts
│       └── ...
└── createContext.ts

repositories/                            (optional; for complex queries)
├── work-package.ts
└── project.ts

__tests__/
├── api/                                 (route tests)
│   ├── work-packages/
│   │   ├── create.test.ts
│   │   ├── update.test.ts
│   │   └── ...
│   └── ...
├── services/
├── lib/
└── integration/
```

### 28.9 Appendix I — Sequencing & milestones

| Milestone | Deliverable | Tests |
|---|---|---|
| **M1** (week 1–2) | `withRoute` HOF, error classes, Zod infra, structured logger, request IDs, Upstash rate limit | Unit + integration for 5 sample routes |
| **M2** (week 3–4) | Work-packages v1 (60 routes), service layer, Prisma 7 transactions | API coverage 100% |
| **M3** (week 5) | Projects v1, members, types, queries | API coverage 100% |
| **M4** (week 6) | Users v1, auth custom routes (non-NextAuth) | API coverage 100% |
| **M5** (week 7) | Wiki, forums, meetings, documents | API coverage 100% |
| **M6** (week 8) | Time entries, time reports, notifications, settings | API coverage 100% |
| **M7** (week 9) | Webhooks v2, files v2, exports, jobs (Inngest) | API coverage 100%, DLQ test |
| **M8** (week 10) | SSE v2, presence, event bus | Integration with frontend |
| **M9** (week 11) | Admin, audit log, GDPR endpoints | API coverage 100% |
| **M10** (week 12) | v3 HAL adapters for top 30 endpoints, OpenAPI spec, Redoc | Compatibility tests vs original OpenProject |
| **M11** (week 13) | tRPC routers for web client, codegen | Web client migrated |
| **M12** (week 14) | Deprecation headers on old routes, sunset date set | – |
| **M13** (week 16) | Old routes removed | – |

---

## Closing remarks

This document is intentionally **opinionated and complete**. It defines a single, opinionated architecture for the OpenProject Rewrite backend. The 144 existing routes will be migrated to this target over ~14 weeks of focused engineering, in the order specified.

The biggest wins are:

1. **70% less code per route** (the `withRoute` HOF, shared services, shared schemas)
2. **30–60% lower p95 latency** (cache-aside, sparse fieldsets, single-flight, cursor pagination)
3. **50% lower MTTR** (correlation IDs, structured logs, Sentry + OTel traces)
4. **Zero schema drift** (Zod is the single source of truth for client and server)
5. **Backward compatible** (v3 HAL adapters preserve the migration path from original OpenProject)

The patterns are **proven**: every major node.js project (Stripe, Linear, GitHub, Vercel) uses a near-identical combination of HOF middleware + Zod + Prisma + Redis + structured logs + OpenAPI.

— End of document —
