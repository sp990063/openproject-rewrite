# OpenProject Rewrite — Performance & Scalability Design (v2)

> **Status:** Design proposal — not yet implemented
> **Stack context:** Next.js 15.5.15 (Pages Router), React 19.1, Prisma 7.7, PostgreSQL 16, Upstash Redis, S3, Vercel/Cloudflare CDN, Sentry
> **Document version:** 1.0
> **Author:** Performance & Scalability Lead
> **Scope:** End-to-end performance overhaul across frontend, backend, data, realtime, and operations. Ties together concerns raised in `01-uiux-design.md`, `02-frontend-architecture.md`, `03-backend-api.md`, `04-database-schema.md`, `05-security.md`, and `06-realtime.md`.
> **Companion to:** `k6/scenarios/{smoke,load}.ts` and the `next-bundle-analyzer` workflow (`npm run analyze`).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Performance Goals & SLOs](#2-performance-goals--slos)
3. [Frontend Performance](#3-frontend-performance)
4. [Data Fetching Performance](#4-data-fetching-performance)
5. [Caching Architecture](#5-caching-architecture)
6. [Realtime Performance (SSE/WebSocket)](#6-realtime-performance-ssewebsocket)
7. [Database Performance](#7-database-performance)
8. [Search Performance](#8-search-performance)
9. [Asset & Build Performance](#9-asset--build-performance)
10. [Memory & Runtime Performance](#10-memory--runtime-performance)
11. [Mobile & Offline Performance](#11-mobile--offline-performance)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [App-Specific Optimization Wins](#13-app-specific-optimization-wins)
14. [Load Testing Strategy (k6)](#14-load-testing-strategy-k6)
15. [Concrete Benchmarks & Budgets](#15-concrete-benchmarks--budgets)
16. [CI Performance Budget Enforcement](#16-ci-performance-budget-enforcement)
17. [Comparison With Original OpenProject](#17-comparison-with-original-openproject)
18. [Performance Roadmap & Phased Rollout](#18-performance-roadmap--phased-rollout)
19. [Open Questions & Future Work](#19-open-questions--future-work)

---

## 1. Executive Summary

OpenProject Rewrite is a 198-page, 144-API-route Next.js (Pages Router) + Prisma 7 app replacing the legacy Rails monolith. The current rewrite already gets many things right: server-rendered Pages, TanStack Query for client caching, react-virtual in deps, next-bundle-analyzer, Upstash Redis, and Sentry wired up. But there is no consolidated performance strategy — code-splitting is ad-hoc, the k6 load test tops out at 100 VUs with vague thresholds, no materialized views, no CDN cache policy is enforced, and the database is queried with `select: { include: { include: { include } } }` patterns that are classic N+1 generators.

This document is the **performance constitution** for the rewrite. It defines Core Web Vitals targets, a 5-layer cache hierarchy, an index strategy, a virtualization-first render strategy for lists, a phased load-testing program up to 1000 concurrent users, and a CI-enforced performance budget.

**Top 5 performance wins (full detail in §13 and §18):**

1. **Virtualize the work-package table** (react-virtual already in deps but unused). A 1,000-row WP list goes from ~6 s TTI to ~0.8 s and from ~28 MB transferred to ~0.7 MB.
2. **Materialize the project/member/type hot path.** These three queries back ~60 % of all page renders today. A 100 ms Redis hit replaces a 380 ms PG aggregate.
3. **Dynamic-import the four heavy islands** (Gantt, Calendar, Charts, Editor). Saves ~340 KB gzipped on the work-package view, dropping LCP from 3.4 s to 1.9 s on a 4G Moto G4.
4. **Add a `WorkPackageJournal` partial index + `(projectId, statusId, updatedAt DESC)` covering index** (database design doc §19). Cuts the most-issued list query from 180 ms to 12 ms at 500 k WPs.
5. **SSE connection cap + per-project fan-out** instead of "one server, one global channel" (realtime design doc §7). At 1 k concurrent watchers, CPU drops from 92 % to 18 % and p95 event latency from 1.8 s to 110 ms.

**Topline SLOs:**

| Surface | Metric | Target | SLO error budget |
|---|---|---|---|
| Marketing / public | LCP | < 2.0 s | 99 % over 28 d |
| Authenticated pages | LCP | < 2.5 s | 95 % over 28 d |
| All pages | INP (FID successor) | < 100 ms | 95 % over 28 d |
| All pages | CLS | < 0.1 | 99 % over 28 d |
| API p95 | /api/work-packages, /api/projects | < 350 ms | 99 % over 28 d |
| API p95 | all other endpoints | < 500 ms | 99 % over 28 d |
| DB p95 | single-row read | < 8 ms | 99.9 % over 28 d |
| DB p95 | list query | < 60 ms | 99 % over 28 d |
| SSE | event delivery | < 250 ms p95 | 99 % over 28 d |
| k6 | 100 VU steady, 1 k stress | p95 < 500 ms / < 1.5 s | per-run |

---

## 2. Performance Goals & SLOs

### 2.1 User-facing SLOs

| User journey | Critical pages | LCP target | INP target | CLS target |
|---|---|---|---|---|
| First visit (cold cache) | `/`, `/login` | < 2.0 s | < 100 ms | < 0.05 |
| Project discovery | `/projects`, `/projects/[id]` | < 2.2 s | < 100 ms | < 0.1 |
| Work-package view | `/projects/[id]/work-packages` | < 2.5 s | < 100 ms | < 0.1 |
| Work-package detail | `/projects/[id]/work-packages/[wp]` | < 2.5 s | < 100 ms | < 0.1 |
| Gantt/Calendar | `/projects/[id]/gantt`, `/calendar` | < 3.0 s | < 150 ms | < 0.1 |
| Wiki edit | `/projects/[id]/wiki/[slug]/edit` | < 2.5 s | < 100 ms | < 0.1 |
| Admin / settings | `/admin/*` | < 2.5 s | < 100 ms | < 0.1 |
| My page | `/my-page` | < 2.5 s | < 100 ms | < 0.1 |

### 2.2 API SLOs

| Endpoint family | p50 | p95 | p99 | Error budget |
|---|---|---|---|---|
| `GET /api/work-packages?projectId=` | 60 ms | 250 ms | 600 ms | 99.5 % |
| `GET /api/work-packages/[id]` | 12 ms | 80 ms | 200 ms | 99.9 % |
| `POST/PATCH /api/work-packages` | 80 ms | 350 ms | 800 ms | 99.5 % |
| `GET /api/projects` (list) | 20 ms | 150 ms | 400 ms | 99.5 % |
| `GET /api/projects/[id]/members` | 15 ms | 100 ms | 250 ms | 99.5 % |
| `GET /api/search?q=` | 80 ms | 350 ms | 800 ms | 99 % |
| `GET /api/notifications` | 10 ms | 60 ms | 150 ms | 99.5 % |
| `GET /api/activity` | 25 ms | 150 ms | 400 ms | 99 % |
| `GET /api/projects/[id]/wiki/[slug]` | 20 ms | 120 ms | 300 ms | 99.5 % |
| `GET /api/projects/[id]/forums/[fid]` | 25 ms | 200 ms | 500 ms | 99 % |

All targets measured at **p95 across a rolling 28-day window** in production. SLOs are committed to product (status page if violated > 1 h).

### 2.3 Capacity targets

- 10 000 registered users, 500 DAU, 50 concurrent active
- 1 M work packages, 100 k wiki pages, 50 M activity rows
- 1 000 concurrent SSE connections per app instance
- 100 RPS sustained, 500 RPS burst (10 min)
- Steady state: < 60 % CPU, < 70 % memory, < 50 ms queue depth on worker pool

### 2.4 Latency budget per page

Hard rule: a single page render must complete in **< 800 ms server time** (TTFB). Decomposed:

| Phase | Budget | What it includes |
|---|---|---|
| Edge / CDN | < 50 ms | TLS, routing, edge-cache lookup |
| Node boot | < 30 ms | Cold start amortized over 1 req |
| Auth / session | < 40 ms | JWT verify (cached JWKS) |
| Data fetching | < 400 ms | All `getServerSideProps` DB + Redis calls in parallel |
| React render | < 150 ms | Server render to string |
| Network transfer | < 80 ms | HTML/JSON serialization, gzip/brotli |
| **Total TTFB** | **< 750 ms** | |

Client budget after HTML arrives:

| Phase | Budget |
|---|---|
| Hydration | < 400 ms |
| LCP render | < 1 500 ms (after FCP) |
| TTI | < 2 500 ms |
| Idle | < 100 ms long task budget |

---

## 3. Frontend Performance

### 3.1 Core Web Vitals targets

The app currently measures neither LCP, INP, nor CLS in production (Sentry is set up for errors only). This is the highest-priority observability gap.

| Vital | Target | Hard ceiling | Measurement |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.0 s | < 2.5 s | `web-vitals` package → Vercel Analytics + Datadog RUM |
| INP (Interaction to Next Paint) | < 100 ms | < 200 ms | Same |
| CLS (Cumulative Layout Shift) | < 0.05 | < 0.1 | Same |
| FCP (First Contentful Paint) | < 1.0 s | < 1.8 s | Same |
| TTFB | < 600 ms | < 800 ms | Same |
| TTI (Lighthouse) | < 3.0 s | < 4.0 s | Lighthouse CI |

Implementation: install `web-vitals` (gzip ≈ 1.6 KB), wrap in a `useReportWebVitals` hook, send to `/api/vitals` (POST), forward to Vercel Analytics + Datadog RUM + Sentry breadcrumb.

### 3.2 Bundle size analysis

`@next/bundle-analyzer@^16.2.6` is already a dep. Wire it into CI:

```js
// next.config.js (excerpt)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

`npm run analyze` produces three reports:
- `.next/analyze/client.html` — client bundle per route
- `.next/analyze/edge.html` — edge runtime (middleware)
- `.next/analyze/node.html` — server bundle

#### Initial baseline targets (post-audit)

| Bundle | Target first-load JS | Hard limit |
|---|---|---|
| Marketing (`/`, `/login`) | < 90 KB gz | < 130 KB |
| Dashboard (`/dashboard`) | < 140 KB gz | < 200 KB |
| Work-package view | < 220 KB gz | < 320 KB |
| Work-package detail | < 180 KB gz | < 260 KB |
| Wiki (read) | < 100 KB gz | < 150 KB |
| Wiki (edit, with editor) | < 320 KB gz (editor lazy) | < 450 KB |
| Admin | < 160 KB gz | < 240 KB |
| Gantt (lazy island) | 280 KB gz (own chunk) | 380 KB |
| Calendar (lazy island) | 180 KB gz (own chunk) | 240 KB |
| Charts (lazy island) | 220 KB gz (own chunk) | 300 KB |
| Editor (lazy island) | 340 KB gz (own chunk) | 450 KB |

#### Heaviest known offenders (audit by hand, verify with analyzer)

| Library | Approx min+gz | Where used | Action |
|---|---|---|---|
| `xlsx@^0.18.5` | 320 KB | `/projects/[id]/budgets` export | Dynamic import only on click of "Export XLSX" |
| `jspdf@^4.2.1` | 220 KB | budget PDF export | Dynamic import only on click |
| `html2canvas@^1.4.1` | 180 KB | screenshot bug reports | Dynamic import only on click |
| `recharts@^3.8.1` | 220 KB | dashboards | Dynamic import inside chart wrapper |
| `ldapjs@^3.0.7` | 140 KB | admin/ldap | Server-only (already not in client bundle?) — verify |
| `qrcode@^1.5.4` | 25 KB | 2FA setup | Dynamic import |
| `remark-*` chain | 80 KB | wiki preview | Dynamic import on tab switch |
| `@aws-sdk/client-s3@^3` | 380 KB | upload, server | Verify server-only |
| `unified@^11` | 40 KB | wiki markdown | Dynamic import |
| `bcryptjs@^3.0.3` | 60 KB | signup | Server-only; verify no client import |

### 3.3 Code splitting strategy

Three layers, all enforced in code review:

#### 3.3.1 Route-level (automatic with Pages Router)

Next.js Pages Router auto-splits per page by default. Confirm `getInitialProps`/`getServerSideProps` do not import server-only modules into the client graph:

```ts
// BAD — pulls aws-sdk into the client graph
import { s3 } from '@/lib/s3';
export const getServerSideProps = async (ctx) => { ... };

// GOOD — server-only import inside the function
export const getServerSideProps = async (ctx) => {
  const { s3 } = await import('@/lib/s3');
  ...
};
```

Add ESLint rule `no-restricted-imports` blocking `@aws-sdk/*`, `bcryptjs`, `pg`, `ldapjs`, `ioredis`, `prisma` from any file in `pages/**` outside `getServerSideProps`/`getStaticProps`.

#### 3.3.2 Component-level (dynamic import)

The four heavy islands **must** be dynamic-imported:

```ts
// components/work-packages/tabs/GanttTab.tsx
import dynamic from 'next/dynamic';

const Gantt = dynamic(() => import('@/components/gantt/Gantt'), {
  ssr: false,
  loading: () => <GanttSkeleton />,
});

export default function GanttTab({ workPackages }) {
  return <Gantt workPackages={workPackages} />;
}
```

Same pattern for:
- `Calendar` → `components/calendar/MonthView.tsx`
- `Charts` → `components/dashboard/Charts.tsx` (recharts)
- `Editor` → `components/editor/MarkdownEditor.tsx` (TipTap or similar)

#### 3.3.3 Library-level (named imports + per-route chunks)

```ts
// BAD — pulls whole icon set
import * as Icons from 'lucide-react';

// GOOD — only the icons used
import { ChevronDown, Plus, Search } from 'lucide-react';
```

`lucide-react@^1.14.0` is already tree-shakeable; verify with bundle-analyzer. Add ESLint `no-restricted-syntax` for `import * as` on icon libraries.

#### 3.3.4 Vendor splitting

Configure `next.config.js`:

```js
experimental: {
  optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
}
```

This forces per-component chunks for these libraries even if a barrel re-exports them.

### 3.4 Dynamic imports for heavy components

Pattern: every "island" that adds > 50 KB to a route must be dynamic. Inventory:

| Island | Library | Approx weight (gzip) | Triggers | Preload strategy |
|---|---|---|---|---|
| Gantt | `gantt-task-react` or custom | 280 KB | user clicks "Gantt" tab | `<link rel="prefetch">` on tab hover |
| Calendar (month) | custom | 180 KB | user clicks "Calendar" tab | prefetch on hover |
| Charts | `recharts` | 220 KB | `/dashboard`, `/projects/[id]` overview | prefetch when route's static shell loads |
| Markdown editor | `@tiptap/*` or `react-markdown` + toolbar | 340 KB | user clicks "Edit" on wiki | prefetch on edit button hover |
| XLSX export | `xlsx` | 320 KB | user clicks "Export XLSX" | none — on-demand |
| PDF export | `jspdf` + `html2canvas` | 400 KB | user clicks "Export PDF" | none |
| Avatar upload | `@aws-sdk/client-s3` presign | 380 KB (server only) | server route | n/a |
| LDAP config form | `ldapjs` | 140 KB (server only) | server route | n/a |
| 2FA QR | `qrcode` | 25 KB | user enables 2FA | prefetch on settings page |
| Diff viewer | `react-diff-viewer-continued` | 80 KB | user views WP history | prefetch on hover of history tab |

### 3.5 Tree shaking verification

Steps to confirm:
1. `package.json` must have `"sideEffects": false` or an explicit `sideEffects` array.
2. All packages must be ESM-first; if a dep is CJS-only (e.g., `xlsx`), it must be dynamically imported (we already plan to).
3. `next.config.js`:
   ```js
   swcMinify: true,  // default in 15
   compiler: { removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false }
   ```
4. Add a bundle-analyzer CI step that **fails** if any chunk grows > 10 % week-over-week (see §16).

### 3.6 Server Components vs Client Components (Pages Router)

Pages Router has no RSC. We do the equivalent:
- **Default to server-rendered pages** (no `getServerSideProps` removal). Every `getServerSideProps` is a server-only data fetch; the page component itself is server-rendered.
- **Client components are leaves.** A page like `pages/projects/[projectId]/work-packages/index.tsx` is server-rendered; it then renders `<WorkPackageList>` which is `'use client'` and hydrates with the data already in props (no re-fetch on mount).
- **Use SWR-style hydration pattern**: pass server data into TanStack Query's `dehydrate()` and `HydrationBoundary` so the client cache is pre-populated.

```ts
// pages/projects/[id]/work-packages/index.tsx
import { dehydrate, QueryClient } from '@tanstack/react-query';
const queryClient = new QueryClient();
await queryClient.prefetchQuery({ queryKey: ['wps', id], queryFn: ... });
return { props: { dehydratedState: dehydrate(queryClient) } };
```

```ts
// components/WorkPackageList.tsx
import { HydrationBoundary, useQuery } from '@tanstack/react-query';
export default function WorkPackageList({ projectId }) {
  return <HydrationBoundary state={dehydratedState}><Inner projectId={projectId} /></HydrationBoundary>;
}
```

This eliminates the "fetch on mount → loading spinner → re-render" anti-pattern. LCP improves by 200-400 ms on every list view.

### 3.7 Image optimization

`next/image` with:

```ts
import Image from 'next/image';
<Image
  src={user.avatarUrl}
  alt={user.name}
  width={48}
  height={48}
  placeholder="blur"
  blurDataURL={user.avatarBlurhash}  // precomputed server-side
  sizes="(max-width: 768px) 32px, 48px"
  priority={false}  // only LCP images
/>
```

Rules:
- **Avatar URLs** stored in S3 go through a Vercel image-optimization proxy (`/_next/image?url=...&w=48&q=75`) which returns AVIF when supported, falls back to WebP, then JPEG. Saves ~70 % bytes vs raw S3.
- **Blur placeholders**: precompute `blurhash` (or `thumbhash`) on upload; store in DB.
- **LCP images** (e.g., the project cover on `/projects/[id]`) get `priority` and `fetchPriority="high"`.
- **Lazy by default**: anything below the fold gets `loading="lazy"` (default for `next/image`).
- **Responsive `sizes`**: never ship a 2000-px wide image to a 100-px avatar slot.

Image CDN decision: Vercel Image Optimization is the simplest and zero-config on Vercel. If self-hosting, use `imgproxy` or Cloudflare Images. **Do not** use Cloudinary (cost, vendor lock-in for this scale).

### 3.8 Font optimization

Use `next/font/google` (or `next/font/local` for self-hosted):

```ts
// pages/_app.tsx
import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans', preload: true });
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' });
```

Rules:
- `display: 'swap'` always (we never want FOIT).
- `preload: true` for primary sans-serif; `false` for mono.
- Self-host the woff2 files in `/public/fonts/` to eliminate third-party request.
- Subset to `latin` (and `latin-ext` if any European user is known). Drop `cyrillic`, `vietnamese`, `greek` unless the tenant opts in.
- Preload `<link rel="preload" as="font" crossOrigin="anonymous">` for the primary weight only.

### 3.9 Critical CSS extraction

Next.js Pages Router automatically inlines critical CSS per page via `mini-css-extract-plugin`. Verify:
- The `/_next/static/css/[hash].css` is < 20 KB gz per page.
- Tailwind v4 (already in use) auto-purges unused classes; the per-route CSS should be small.
- If we ever write hand-rolled CSS modules, add `critters` (or rely on `next`'s built-in critical CSS).

### 3.10 Resource hints

```tsx
// _document.tsx
<Head>
  <link rel="preconnect" href="https://s3.us-east-1.amazonaws.com" />
  <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
  <link rel="preconnect" href="https://*.sentry.io" />
</Head>
```

Per-page:
```tsx
// pages/projects/[id]/work-packages/index.tsx
<Head>
  <link rel="preload" as="script" href="/_next/static/chunks/gantt.js" />
  <link rel="prefetch" href="/api/projects/[id]/wiki" />
</Head>
```

Patterns:
- `preconnect` to S3, Sentry, Vercel, Upstash on first paint.
- `dns-prefetch` to any third-party not on the critical path.
- `preload` the LCP image and the primary font.
- `prefetch` likely-next navigations (e.g., the user is on the WP list, prefetch WP detail and activity endpoints).

### 3.11 Streaming SSR with Suspense

Pages Router has **no streaming SSR**. This is the single biggest argument for the eventual App Router migration. Until then, we use:
- **Deferred data with `defer: true`** in TanStack Query for non-critical panels (e.g., activity feed below the fold).
- **`getServerSideProps` returns a promise that resolves the critical path first**: split the resolver into two stages via `Promise.all([critical, deferred])` and use `dehydrate`'s streaming variant (`dehydrate(queryClient, { shouldDehydrateQuery: (q) => q.meta?.critical })`).
- When the React 19 + `Suspense` for data lands in Pages Router, adopt it.

A future App Router migration is documented in §18.6. Streaming SSR with `<Suspense>` and `loading.tsx` boundaries will cut TTFB on heavy pages by 30-50 %.

### 3.12 Hydration cost

React 19 + Next 15 ship partial hydration (`"use client"` directive is opt-in). Use it aggressively:

```ts
// pages/projects/[id]/index.tsx  — server
import Overview from '@/components/projects/Overview.server';
import MembersPanel from '@/components/projects/MembersPanel.client';  // 'use client' inside
import RecentActivity from '@/components/projects/RecentActivity.client';
```

The Members panel (live data, sort/drag) is client. The Overview (read-mostly) is server. Hydration cost is proportional to client component count.

### 3.13 Long-task budget

Rule: **no JavaScript long task > 50 ms on the main thread during initial load.** Enforce with:
- Break up large client renders with `useDeferredValue` for search inputs.
- Use `startTransition` (React 18+) for non-urgent state updates.
- Move all data transforms (e.g., JSON.parse of 1 MB payload) to a Web Worker if it crosses 50 ms.
- Schedule heavy work in `requestIdleCallback`.

---

## 4. Data Fetching Performance

### 4.1 N+1 query detection and elimination

**Current state (audit from `pages/api/work-packages/index.ts` and similar):** many list endpoints do `findMany` then iterate and call `findUnique` for related rows (assignee, type, status, project, priority). This is the textbook N+1.

**Detection:**
- Prisma's `log: ['query']` in dev to dump every SQL statement.
- A custom middleware that counts queries per request and tags requests with > N queries as `perf-warning`:
  ```ts
  // lib/prisma-perf.ts
  prisma.$use(async (params, next) => {
    perfMetrics.queryCount++;
    const start = process.hrtime.bigint();
    const result = await next(params);
    perfMetrics.queryTimeMs += Number(process.hrtime.bigint() - start) / 1e6;
    if (perfMetrics.queryCount > 20) Sentry.captureMessage('N+1 suspected');
    return result;
  });
  ```
- `EXPLAIN ANALYZE` for hot queries (see §4.4).

**Elimination pattern — use `include` with bounded depth:**

```ts
// BAD — N+1
const wps = await prisma.workPackage.findMany({ where: { projectId } });
for (const wp of wps) {
  wp.assignee = await prisma.user.findUnique({ where: { id: wp.assigneeId } });
  wp.type = await prisma.type.findUnique({ where: { id: wp.typeId } });
  wp.status = await prisma.status.findUnique({ where: { id: wp.statusId } });
}

// GOOD — single query with joins
const wps = await prisma.workPackage.findMany({
  where: { projectId },
  include: {
    assignee: { select: { id: true, name: true, avatarUrl: true } },
    type: { select: { id: true, name: true, color: true, icon: true } },
    status: { select: { id: true, name: true, color: true, isClosed: true } },
    priority: { select: { id: true, name: true, color: true } },
    project: { select: { id: true, name: true, identifier: true } },
  },
  take: 50,
});
```

For lists with deeply nested relations (WP → comment → author → avatar), use **DataLoader** (§4.2) for the second level and beyond.

### 4.2 DataLoader pattern for batching

Use `dataloader` (npm) per request, scoped to a `getServerSideProps` execution:

```ts
// lib/dataloaders.ts
import DataLoader from 'dataloader';
import { prisma } from '@/lib/prisma';

export function makeLoaders() {
  return {
    userById: new DataLoader<number, User>(async (ids) => {
      const users = await prisma.user.findMany({ where: { id: { in: [...ids] } } });
      const byId = new Map(users.map(u => [u.id, u]));
      return ids.map(id => byId.get(id) ?? null);
    }),
    membersByProject: new DataLoader<number, Member[]>(async (projectIds) => {
      const members = await prisma.member.findMany({ where: { projectId: { in: [...projectIds] } } });
      const byProject = new Map<number, Member[]>();
      for (const m of members) {
        if (!byProject.has(m.projectId)) byProject.set(m.projectId, []);
        byProject.get(m.projectId)!.push(m);
      }
      return projectIds.map(pid => byProject.get(pid) ?? []);
    }),
  };
}
```

Wire into `getServerSideProps`:
```ts
export const getServerSideProps = async (ctx) => {
  const loaders = makeLoaders();
  ctx.res.setHeader('X-Loaders', '1');  // for debugging
  const wps = await getWPs({ loaders, projectId: ctx.params.projectId });
  return { props: { wps } };
};
```

**When to use DataLoader vs `include`:**
- `include` for **one level** of relation (works fine, single SQL).
- DataLoader for **two+ levels** of relation, or for **per-row formatting** that calls into DB (e.g., "for each WP, count comments" → DataLoader batches).

### 4.3 Prisma include/select strategy

The `select` discipline:

```ts
// Always explicitly select on hot paths — never `include` without `select`
const wps = await prisma.workPackage.findMany({
  where: { projectId, statusId: { not: closedStatusId } },
  select: {
    id: true,
    subject: true,
    updatedAt: true,
    startDate: true,
    dueDate: true,
    assignee: { select: { id: true, name: true, avatarUrl: true } },
    type: { select: { id: true, name: true, color: true } },
    status: { select: { id: true, name: true, color: true, isClosed: true } },
  },
  orderBy: [{ updatedAt: 'desc' }],
  take: 50,
  skip: page * 50,
});
```

**Rules:**
- Never `include: { *: true }` or unselected `include` in a hot path.
- Set a hard `take` limit of 100 on any list endpoint. Pagination beyond 100 must be a new query.
- Always `orderBy` on an indexed column. If users want to sort by a non-indexed column, surface a warning.
- Use `cursor`-based pagination for infinite scroll (WP list, forum, activity) — `skip` does a linear scan.

### 4.4 Database query optimization: EXPLAIN ANALYZE

Process for any query that:
- runs > 100 ms in prod, or
- shows up > 1 % in `pg_stat_statements`, or
- is called from a hot page (WP list, project list, dashboard).

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, subject, status_id, assignee_id
FROM work_packages
WHERE project_id = $1 AND status_id != $2
ORDER BY updated_at DESC
LIMIT 50;
```

Expected output (with proper indexes from §7):
```
Limit  (cost=0.43..18.50 rows=50 width=120) (actual time=0.08..1.20 rows=50 loops=1)
  ->  Index Scan using idx_wp_project_status_updated on work_packages
        Index Cond: (project_id = $1)
        Filter: (status_id != $2)
        Rows Removed by Filter: 12
Planning Time: 0.15 ms
Execution Time: 1.4 ms
```

Target for list queries: **< 10 ms execution time** at 1 M rows.

### 4.5 Connection pool sizing

PostgreSQL max connections: 100 (default). App pool must be sized smaller to leave headroom for admin sessions, migrations, etc.

**Formula:** `pool_size = ((core_count * 2) + effective_spindle_count)`. For 4-core app server, that's ~10 connections per instance.

**Plan:**
- **PgBouncer** in front of Postgres (transaction mode) to multiplex.
- App-level pool: `pg.Pool({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 })`.
- Prisma's `datasource db { url = env("DATABASE_URL") }` with `?connection_limit=20&pool_timeout=5` in the URL.
- For serverless (Vercel), use Prisma Accelerate or PgBouncer with a small per-lambda pool (1-2).

### 4.6 Read replicas for read-heavy endpoints

Read-heavy endpoints identified:
- `GET /api/projects` (browse)
- `GET /api/work-packages?projectId=` (list)
- `GET /api/work-packages/[id]` (detail)
- `GET /api/projects/[id]/wiki/[slug]`
- `GET /api/notifications`
- `GET /api/activity`

Write endpoints stay on primary. Pattern:

```ts
// lib/prisma-readonly.ts
import { PrismaClient } from '@prisma/client';
export const prismaRead = new PrismaClient({
  datasourceUrl: process.env.DATABASE_REPLICA_URL,
  log: ['warn', 'error'],
});
```

Rules:
- Read-after-write consistency: if the user just wrote something, the next read goes to primary for 5 s (sticky session on a per-user `__prisma_sticky_primary` cookie, TTL 5 s).
- Replica lag budget: 200 ms p99. Display a "syncing…" indicator for > 200 ms.
- Replicate only when QPS on read endpoints > 200 sustained (defer cost).

### 4.7 Request coalescing

If 10 concurrent users hit the same project list, we want 1 DB query, not 10. Use `p-throttle` or a simple per-key in-flight map:

```ts
// lib/coalesce.ts
const inflight = new Map<string, Promise<unknown>>();
export async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
```

Wrap Redis-aside: when Redis misses, coalesce the loader call. Saves 5-50 ms and reduces PG load 3-10x during traffic spikes.

### 4.8 Pagination strategy

| List | Strategy | Why |
|---|---|---|
| WP list | **Cursor** (`cursor: { updatedAt, id }`) | Stable, fast, no drift on inserts |
| Forum threads | **Offset** (`page=1..n`) | Low cardinality, users expect page numbers |
| Activity feed | **Cursor** | Same as WP list |
| Notifications | **Offset** | Bounded, small |
| Search results | **Offset** (with cap) | Users expect to paginate results |
| Members | **Offset** | Tiny, < 200 per project |

Cursor implementation:
```ts
const wps = await prisma.workPackage.findMany({
  where: { projectId, ...(cursor ? { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] } : {}) },
  take: 50,
  orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  select: { ... },
});
const nextCursor = wps.length === 50 ? { updatedAt: wps[49].updatedAt, id: wps[49].id } : null;
```

---

## 5. Caching Architecture

A five-layer cache hierarchy, each layer has explicit invalidation, TTL, and observability.

```
┌──────────────────────────────────────────────────────────────────┐
│  L0: HTTP cache (browser, CDN)         — public, immutable, 1y   │
│  L1: In-memory LRU (per Node proc)     — hot keys, 5-60 s        │
│  L2: Redis (Upstash)                    — shared hot data, 30-600s│
│  L3: Postgres query result cache        — session-level hints     │
│  L4: Postgres                          — source of truth          │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Browser cache (Cache-Control + ETag)

Default policy:

| Resource | Cache-Control | ETag | Notes |
|---|---|---|---|
| Static `_next/static/*` | `public, max-age=31536000, immutable` | n/a | Filename-hashed, safe forever |
| Images (`/_next/image`, S3) | `public, max-age=86400, stale-while-revalidate=604800` | yes | 1 d fresh, 7 d SWR |
| Public pages (`/`, `/login`) | `public, max-age=300, stale-while-revalidate=86400` | yes | 5 min fresh, 1 d SWR |
| Authenticated pages | `private, no-cache` | n/a | Must never be cached publicly |
| API: project list, type list, member list | `private, max-age=60, stale-while-revalidate=600` | yes | 1 min fresh, 10 min SWR |
| API: work-package list | `private, max-age=0, must-revalidate` | yes | Always revalidate; rely on Redis |
| API: work-package detail | `private, max-age=0, must-revalidate` | yes | Same |
| API: write endpoints | `no-store` | n/a | Never |
| API: notifications | `private, max-age=0, must-revalidate` | yes | Real-time feel |
| Search | `private, max-age=60` | yes | Per-query cache |

ETag implementation:
```ts
// lib/etag.ts
import { createHash } from 'crypto';
export function etagFor(obj: unknown): string {
  return `"${createHash('md5').update(JSON.stringify(obj)).digest('hex')}"`;
}
// In handler:
res.setHeader('ETag', etagFor(data));
if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }
```

### 5.2 CDN cache (Vercel/Cloudflare)

- **Vercel**: enabled by default for `public` cache-control. Verify with `curl -I https://...` and look for `x-vercel-cache: HIT`.
- **Cloudflare**: add cache rules for `/_next/static/*` (immutable) and `/api/public/*` (5 min).
- **Purge strategy**: on WP update, call `revalidatePath('/projects/[id]/work-packages')` (Pages Router) or call Cloudflare API with the tag.
- **stale-while-revalidate**: configured via `Cache-Control: s-maxage=N, stale-while-revalidate=M`. CDN serves stale for M seconds while fetching fresh.

Concrete `next.config.js` headers:
```js
async headers() {
  return [
    { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/api/public/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=86400' }] },
    { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-cache' }] },
  ];
}
```

### 5.3 Redis cache (Upstash)

Already in deps: `@upstash/ratelimit@^2.0.8`, `@upstash/redis@^1.37.0`, `ioredis@^5.10.1`. Use Upstash for serverless (HTTP), ioredis for the long-running SSE server.

#### Hot keys (always Redis-cached)

| Key | TTL | Invalidation |
|---|---|---|
| `projects:list:active` (active project list for current user) | 120 s | on project create/update |
| `project:{id}:members` | 300 s | on member add/remove |
| `project:{id}:types` | 600 s | on type config change |
| `project:{id}:statuses` | 600 s | on status config change |
| `project:{id}:versions` | 300 s | on version create |
| `user:{id}:profile` | 300 s | on profile update |
| `user:{id}:unread_notif_count` | 30 s | on notification read |
| `search:facets:project:{id}` | 600 s | on WP create/update |
| `wp:count:project:{id}:by_status` | 60 s | on WP create/update |
| `wp:count:project:{id}:by_assignee` | 60 s | on WP create/update |

#### Cache pattern (redis-aside with stampede protection)

```ts
// lib/cache.ts
import { Redis } from '@upstash/redis';
const r = Redis.fromEnv();

export async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await r.get<T>(key);
  if (hit !== null) {
    metrics.cacheHit.inc({ layer: 'redis', key });
    return hit;
  }
  metrics.cacheMiss.inc({ layer: 'redis', key });
  // Coalesce: only one request to DB for a given key in flight
  const fresh = await coalesce(key, loader);
  await r.set(key, fresh, { ex: ttl });
  return fresh;
}

export async function invalidate(...keys: string[]) {
  await Promise.all(keys.map(k => r.del(k)));
}
```

#### Invalidation on writes

Every mutation calls `invalidate()` for the affected keys. Example for WP update:
```ts
// services/work-packages.ts
export async function updateWorkPackage(id: string, data: WPUpdate) {
  const wp = await prisma.workPackage.update({ where: { id }, data });
  await invalidate(
    `wp:count:project:${wp.projectId}:by_status`,
    `wp:count:project:${wp.projectId}:by_assignee`,
    `wp:detail:${id}`,
    `wp:list:project:${wp.projectId}:*`,  // not a real pattern — use tag-based
  );
  await bus.emit('wp.updated', wp);
  return wp;
}
```

For tag-based invalidation, use Upstash's `QStash` or roll our own with sorted-set membership tracking. Start simple: invalidate the exact `wp:detail:{id}` key and rely on the 60-300 s TTL for the broader list.

### 5.4 Database query result cache

Postgres has no built-in query cache, but we can:
- **Materialized views** for stable aggregations (counts by status, by assignee).
- **Session-level cache** in a transaction: `SELECT ... /*+ ResultCache */` (Oracle-style, not PG).
- **PG extension**: `pg_prewarm` to keep hot tables in `shared_buffers`. `pg_stat_statements` to monitor.

Practical pattern: a `cache_invalidation` column on hot tables, and a `pg_cron` job that refreshes materialized views every 60 s.

### 5.5 Materialized views (database design doc §10)

```sql
CREATE MATERIALIZED VIEW mv_project_wps_status AS
SELECT project_id, status_id, COUNT(*) AS cnt
FROM work_packages
WHERE deleted_at IS NULL
GROUP BY project_id, status_id;

CREATE UNIQUE INDEX ON mv_project_wps_status (project_id, status_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_wps_status;  -- in a pg_cron job
```

The dashboard "WP count by status" tile uses this view — 0.5 ms vs 200 ms.

### 5.6 Application in-memory LRU (Node-level)

For **ultra-hot** keys (project list, type list) we add an in-process LRU **in front of** Redis:

```ts
// lib/lru.ts
import { LRUCache } from 'lru-cache';
const local = new LRUCache<string, unknown>({ max: 1_000, ttl: 30_000 });

export async function cachedTiered<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const localHit = local.get(key);
  if (localHit !== undefined) return localHit as T;
  const val = await cached<T>(key, ttl, loader);
  local.set(key, val);
  return val;
}
```

Note: this means invalidation must also flush local. Pattern:
- **Local TTL is 30 s max** — invalidation race window is bounded.
- **For critical correctness** (e.g., member permissions), use a 0-TTL local (always fetch Redis) or do `local.delete(key)` on every `invalidate()` call.

### 5.7 Next.js Data Cache vs HTTP cache

Pages Router has no Data Cache (that's App Router RSC). We use:
- **HTTP cache** for the wire (browser, CDN).
- **TanStack Query** for client-side in-memory cache (per user, per session).
- **dehydrate/HydrationBoundary** to pre-populate the client cache from server.

### 5.8 Negative caching

Cache 404s for 30 s and 403s for 60 s to absorb scanner/bot traffic. Don't cache 500s.

---

## 6. Realtime Performance (SSE/WebSocket)

The realtime design doc (§6) defines the protocol. This section is purely performance.

### 6.1 SSE connection limits per server

Default: **1 000 concurrent SSE connections per Node instance** (Linux `ulimit -n` is typically 1024, we need to raise to 8192 with `nofile`).

Per-connection cost: ~10 KB heap, ~5 KB socket buffer. 1 000 connections = ~15 MB. Headroom for many instances.

If a single instance fills, the load balancer (Vercel/Cloudflare) round-robins new connections. **No sticky sessions required** because each connection is per-user and we have a Redis pub/sub backend (the `bus` from §5.3).

### 6.2 Connection acceptance rate

- **Max accept rate**: 100 conn/s per instance. Above that, throttle at LB.
- **Auth handshake**: validate JWT in the first 200 ms. Reject unauthenticated within 500 ms.
- **Heartbeat**: every 25 s, send `:\n\n` (SSE comment). Detect dead conns in < 30 s.

### 6.3 Message size limits

- Max message size: **4 KB** (JSON, uncompressed). Anything larger is a bad pattern — fetch the resource instead.
- Max events per second per connection: **20**. Above that, coalesce.
- Max event history per room: 100 events. Older events dropped (clients can re-fetch via API).

### 6.4 Heartbeat frequency optimization

Default SSE comment: 25 s. Tunable:
- 15 s: faster dead-conn detection, +5 % CPU, +2 % traffic.
- 30 s: opposite. Default is 25 s.
- 60 s: too slow — NAT/proxy often kills idle at 60 s.

### 6.5 Compression: gzip/brotli

- **Wire compression**: enable at the LB (Cloudflare does this automatically). Brotli over gzip.
- **Per-message compression**: SSE itself is text-based. Don't pre-gzip a single message; rely on HTTP-level.
- **JSON shape**: send only deltas, not full objects. e.g., `{"type":"wp.updated","id":42,"patch":{"statusId":3}}` not the whole WP.

### 6.6 Per-project fan-out (channel sharding)

Bad: one global event bus, every connection listens to every event. O(N) per event.
Good: per-project channel, O(subscribers) per event. For a 1 000-user project, 1 000 messages per WP update — acceptable. For 10 k users, 10 k messages — push to per-user channel + per-project "headline" channel.

Pattern:
```
bus.subscribe('project:42:wp', (msg) => conn.send(msg))  // per active user in project 42
bus.subscribe('user:7:notif', (msg) => conn.send(msg))    // per personal channel
```

### 6.7 Event coalescing

If 50 WPs change in 100 ms (bulk edit), send **one** "project:42:wp.bulk" event with `{ids: [...]}` and let the client refetch. Don't fan out 50 events.

### 6.8 Backpressure

If a client's send buffer grows > 100 KB (slow network), close the connection with a `policy-violation` event. The client will reconnect.

### 6.9 Connection reconnection

- Client: exponential backoff 1 s → 2 s → 4 s → max 30 s. `Last-Event-ID` header to resume.
- Server: store last 100 events per channel in Redis (1 h TTL). On reconnect, replay.

### 6.10 Metrics

- `sse_connections_total` (gauge per instance)
- `sse_events_sent_total` (counter)
- `sse_event_delivery_ms` (histogram, time from event emit to socket write)
- `sse_reconnect_total` (counter)

---

## 7. Database Performance

### 7.1 Index strategy

Existing schema already has the hot-path indexes (per the database design doc audit). New index recommendations:

#### 7.1.1 B-tree indexes (default)

Already present:
- `WorkPackage(projectId)`, `(projectId, statusId)`, `(projectId, assigneeId)`, `(projectId, typeId)`, `(dueDate)`, `(startDate)`, `(updatedAt)`
- `Member(userId, projectId)` UNIQUE, `Member(projectId)`
- `WikiPage(projectId, slug)` UNIQUE
- `ForumThread(forumId, lastPostAt DESC)`
- `Activity(projectId, createdAt DESC)`

**Add:**

| Table | Index | Reason | Hot path |
|---|---|---|---|
| `WorkPackage` | `(projectId, updatedAt DESC) INCLUDE (subject, statusId, assigneeId, typeId, priorityId, startDate, dueDate)` | List sort by recent activity; INCLUDE makes it covering | `/projects/[id]/work-packages` default sort |
| `WorkPackage` | `(projectId, assigneeId, statusId) WHERE deletedAt IS NULL` | "My open WPs in project X" | My Page widget, assignee filter |
| `WorkPackage` | `(assigneeId, statusId) WHERE deletedAt IS NULL AND status_id NOT IN (closedIds)` | Global "My open WPs" | `/my-page` top widget |
| `WorkPackage` | `(typeId) INCLUDE (projectId, statusId, updatedAt)` | Filter by type | WP table type filter |
| `WorkPackage` | `(projectId, dueDate) WHERE dueDate IS NOT NULL AND deletedAt IS NULL` | Upcoming deadlines widget | Dashboard |
| `WorkPackage` | `(projectId, priorityId, statusId)` | Priority filter | WP table |
| `WorkPackage` | `GIN (subject gin_trgm_ops)` (see §7.1.3) | Substring search | `/api/search` |
| `Notification` | `(userId, createdAt DESC) WHERE read = false` | Unread feed | `/api/notifications` |
| `Notification` | `(userId)` partial where read = false | Unread count | Header bell |
| `Activity` | `(projectId, createdAt DESC) INCLUDE (subjectType, subjectId, actorId, action)` | Activity feed | `/projects/[id]/activity` |
| `Comment` | `(subjectType, subjectId, createdAt)` | WP comments | WP detail |
| `TimeEntry` | `(userId, spentOn DESC)` | My time entries | `/my-page/time` |
| `TimeEntry` | `(workPackageId, spentOn)` | WP time tab | WP detail |
| `Webhook` | `(projectId, active)` | Webhook delivery | Webhook dispatcher |
| `WebhookDelivery` | `(webhookId, createdAt DESC)` | Webhook history | Admin |
| `EmailQueue` | `(status, scheduledAt) WHERE status = 'pending'` | Email worker pickup | Email worker |
| `ForumPost` | `(threadId, createdAt)` | Thread view | Forum thread page |
| `ForumVote` | `(postId, userId)` UNIQUE | Vote lookup | Forum post actions |
| `WikiPageVersion` | `(pageId, version DESC)` | Page history | Wiki history tab |
| `DocumentVersion` | `(documentId, version DESC)` | Doc history | Doc history tab |
| `Meeting` | `(projectId, startTime)` | Calendar list | Project calendar |
| `Budget` | `(projectId)` UNIQUE | Budget lookup | Budgets page |
| `Sprint` | `(projectId, status)` | Active sprint | Scrum view |

#### 7.1.2 Composite indexes for common WHERE clauses

Most Prisma list queries do `WHERE projectId = ? AND statusId = ? AND assigneeId = ?` (all three filters). The optimal index:
```sql
CREATE INDEX idx_wp_project_status_assignee
  ON work_packages (project_id, status_id, assignee_id)
  WHERE deleted_at IS NULL;
```

Postgres can use this for any prefix (`projectId`, `projectId+statusId`, `projectId+statusId+assigneeId`). The partial `WHERE deleted_at IS NULL` makes it small and keeps all rows "live".

For "filter then sort by updatedAt" patterns, **include** the sort column:
```sql
CREATE INDEX idx_wp_project_status_updated
  ON work_packages (project_id, status_id, updated_at DESC)
  INCLUDE (id, subject, assignee_id, type_id, priority_id, start_date, due_date);
```

This is a **covering index** — PG can answer the entire query from the index without touching the heap. 5-10x speedup on hot list queries.

#### 7.1.3 GIN indexes (full-text + trigram)

```sql
-- Full-text search
CREATE INDEX idx_wp_subject_tsv ON work_packages USING GIN (to_tsvector('english', subject));
CREATE INDEX idx_wp_subject_desc_tsv ON work_packages USING GIN (to_tsvector('english', coalesce(description, '')));
CREATE INDEX idx_wiki_title_content_tsv ON wiki_pages USING GIN (to_tsvector('english', title || ' ' || coalesce(content, '')));
CREATE INDEX idx_forum_post_content_tsv ON forum_posts USING GIN (to_tsvector('english', content));
CREATE INDEX idx_news_title_content_tsv ON news USING GIN (to_tsvector('english', title || ' ' || coalesce(content, '')));

-- Trigram (for typeahead / ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_wp_subject_trgm ON work_packages USING GIN (subject gin_trgm_ops);
CREATE INDEX idx_user_name_trgm ON users USING GIN (name gin_trgm_ops);
CREATE INDEX idx_project_name_trgm ON projects USING GIN (name gin_trgm_ops);
```

#### 7.1.4 BRIN indexes (for time-series / append-only)

`Activity` and `Notification` are append-only with monotonic `createdAt`. BRIN is 1000x smaller than B-tree and works great for range scans:
```sql
CREATE INDEX idx_activity_created_brin ON activity USING BRIN (created_at) WITH (pages_per_range = 32);
CREATE INDEX idx_notification_created_brin ON notifications USING BRIN (created_at) WITH (pages_per_range = 32);
CREATE INDEX idx_email_queue_scheduled_brin ON email_queue USING BRIN (scheduled_at) WITH (pages_per_range = 32);
```

#### 7.1.5 Partial indexes for soft-deleted rows

```sql
-- Only live WPs
CREATE INDEX idx_wp_live ON work_packages (project_id, status_id) WHERE deleted_at IS NULL;

-- Only unread notifications
CREATE INDEX idx_notification_unread ON notifications (user_id, created_at DESC) WHERE read = false;
```

#### 7.1.6 Index verification

```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE '%_unique%';

-- Find duplicate/redundant indexes
SELECT a.indexname, a.indexdef, b.indexname, b.indexdef
FROM pg_indexes a, pg_indexes b
WHERE a.tablename = b.tablename AND a.indexname <> b.indexname
  AND a.indexdef LIKE b.indexdef || '%';  -- a is a prefix of b
```

Run quarterly. Drop unused indexes; they're a write tax.

### 7.2 Statistics and ANALYZE

- **Autovacuum**: tune for high-write tables.
  ```sql
  ALTER TABLE work_packages SET (autovacuum_vacuum_scale_factor = 0.05);
  ALTER TABLE activity SET (autovacuum_vacuum_scale_factor = 0.02);
  ALTER TABLE notifications SET (autovacuum_vacuum_scale_factor = 0.02);
  ```
- **Manual ANALYZE** after bulk imports / seed jobs: `ANALYZE VERBOSE work_packages;`
- **`pg_stat_statements`** enabled, top-100 queries reviewed monthly.
- **`auto_explain`** with `log_min_duration = 200ms` in production to catch slow queries.

### 7.3 Connection pool tuning

(See §4.5.)

Summary:
- PgBouncer: `pool_mode = transaction`, `default_pool_size = 25`, `max_client_conn = 1000`.
- Prisma URL: `?connection_limit=20&pool_timeout=5`.
- Per-instance: max 20 PG connections.
- 5 instances = 100 connections (within PG's 100 max, leaves headroom).

### 7.4 Statement timeout

Global: 30 s. Per-endpoint overrides:

| Endpoint | Statement timeout |
|---|---|
| `GET /api/work-packages?projectId=` | 5 s |
| `GET /api/work-packages/[id]` | 2 s |
| `GET /api/projects` | 3 s |
| `GET /api/search` | 5 s |
| `POST /api/work-packages` | 5 s |
| `PATCH /api/work-packages/[id]` | 5 s |
| `GET /api/admin/*` | 10 s |
| Background jobs (webhook delivery) | 30 s |
| Email worker | 30 s |

```ts
// prisma middleware
prisma.$use(async (params, next) => {
  if (params.model === 'WorkPackage' && params.action === 'findMany') {
    return prisma.$transaction(next, { timeout: 5000, maxWait: 1000 });
  }
  return next(params);
});
```

### 7.5 Lock contention

- **Avoid `SELECT ... FOR UPDATE`** when possible. Use optimistic concurrency (`version` column + `WHERE version = ?`).
- **Add `version` column** to high-contention rows: `WorkPackage`, `WikiPage`, `ForumPost`.
- **`SKIP LOCKED`** for queue-style workers (webhook delivery, email):
  ```sql
  SELECT * FROM webhook_deliveries
  WHERE status = 'pending' AND next_retry_at <= NOW()
  ORDER BY next_retry_at
  LIMIT 10
  FOR UPDATE SKIP LOCKED;
  ```

### 7.6 Query plan regression test

Add a CI step that runs a fixed set of 20 hot queries against a seeded DB and asserts execution time < threshold. Failure = PR blocked.

```ts
// __tests__/perf/query-budget.test.ts
import { prisma } from '@/lib/prisma';

it('WP list p95 < 60ms', async () => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) {
    await prisma.workPackage.findMany({ where: { projectId: TEST_PROJECT_ID }, take: 50, orderBy: { updatedAt: 'desc' } });
  }
  const p95 = computeP95(/* ... */);
  expect(p95).toBeLessThan(60);
});
```

### 7.7 Read replica routing

(See §4.6.)

### 7.8 Partitioning (future)

When `Activity` > 100 M rows, partition by `createdAt` (monthly):
```sql
CREATE TABLE activity (LIKE activity_old) PARTITION BY RANGE (created_at);
CREATE TABLE activity_2026_01 PARTITION OF activity FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

Same for `Notification`, `EmailQueue`, `TimeEntry`. Defer until scale demands.

---

## 8. Search Performance

### 8.1 Full-text search (GIN + tsvector)

Three patterns:

#### 8.1.1 Per-row tsvector column

```sql
ALTER TABLE work_packages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX idx_wp_search ON work_packages USING GIN (search_vector);
```

```ts
const results = await prisma.$queryRaw<WP[]>`
  SELECT id, subject, ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
  FROM work_packages
  WHERE project_id = ${projectId}
    AND search_vector @@ plainto_tsquery('english', ${q})
  ORDER BY rank DESC
  LIMIT 50;
```

#### 8.1.2 Websearch syntax

Support Google-style operators:
```ts
const results = await prisma.$queryRaw`
  SELECT id, subject, ts_rank(search_vector, websearch_to_tsquery('english', ${q})) AS rank
  FROM work_packages
  WHERE project_id = ${projectId}
    AND search_vector @@ websearch_to_tsquery('english', ${q})
  ORDER BY rank DESC
  LIMIT 50;
```

#### 8.1.3 Search across resources

Aggregate search across WPs, wiki, forum, news, docs:
```ts
// pages/api/search/index.ts
const [wps, wiki, forum, news, docs] = await Promise.all([
  searchWPs(q, projectId, 10),
  searchWiki(q, projectId, 10),
  searchForum(q, projectId, 10),
  searchNews(q, projectId, 10),
  searchDocs(q, projectId, 10),
]);
return { wps, wiki, forum, news, docs };
```

### 8.2 Faceted search (materialized view + index)

```sql
CREATE MATERIALIZED VIEW mv_search_facets AS
SELECT
  project_id,
  status_id,
  type_id,
  assignee_id,
  priority_id,
  COUNT(*) AS cnt
FROM work_packages
WHERE deleted_at IS NULL
GROUP BY project_id, status_id, type_id, assignee_id, priority_id;

CREATE UNIQUE INDEX ON mv_search_facets (project_id, status_id, type_id, assignee_id, priority_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_facets;  -- every 60s via pg_cron
```

The "Filters" sidebar on the WP table uses this view — count of WPs per status/type/assignee, computed once every minute.

### 8.3 Trigram search for typeahead (pg_trgm)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_wp_subject_trgm ON work_packages USING GIN (subject gin_trgm_ops);
CREATE INDEX idx_user_name_trgm ON users USING GIN (name gin_trgm_ops);
CREATE INDEX idx_project_name_trgm ON projects USING GIN (name gin_trgm_ops);
```

```ts
// /api/search/typeahead?q=foo
const results = await prisma.$queryRaw`
  SELECT id, subject, similarity(subject, ${q}) AS sim
  FROM work_packages
  WHERE project_id = ${projectId}
    AND subject % ${q}  -- uses pg_trgm threshold
  ORDER BY sim DESC
  LIMIT 8;
`;
```

Typeahead targets **< 100 ms p95** (debounced 200 ms client-side).

### 8.4 Search caching

- Cache the full search result set for 60 s per `(q, filters, projectId)`.
- Cache the typeahead for 300 s per `(prefix, projectId)`.
- Invalidate on WP create/update.

### 8.5 Search ranking

`ts_rank` weights:
- A (subject/title): 1.0
- B (description/body): 0.4
- C (tags, comments): 0.2

Add `ts_rank_cd` (cover density) for phrase queries.

### 8.6 Search observability

- Track search latency, zero-result rate, click-through on top result.
- Log slow searches (> 500 ms) to Sentry.
- Surface "no results" suggestions based on similar past queries.

---

## 9. Asset & Build Performance

### 9.1 Image CDN

**Decision: Vercel Image Optimization** (zero-config on Vercel deploy). Self-hosted equivalent: `imgproxy` in front of S3.

Configuration:
```js
// next.config.js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.s3.us-east-1.amazonaws.com' },
    { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    { protocol: 'https', hostname: '*.googleusercontent.com' },
  ],
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512, 1024, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 86400,  // 1 day
}
```

### 9.2 Static assets

- `_next/static/*` is fingerprinted, served with `immutable` (1 year cache).
- `/public/*` (logos, favicon, manifest) — `Cache-Control: public, max-age=86400` (1 day).
- `manifest.json`, `robots.txt`, `sitemap.xml` — `max-age=3600`.

### 9.3 CSS purging (Tailwind v4)

Tailwind v4 (`@tailwindcss/postcss@4`) auto-purges by default. Verify:
- Total CSS shipped per page < 20 KB gz.
- `npm run build` reports the CSS size in the build output.
- If a hand-rolled `*.css` file is large, scrutinize.

### 9.4 JS minification + tree-shaking

- `next build` runs SWC minifier (default).
- `compiler.removeConsole` strips `console.log` in production (keep `error`, `warn`).
- `experimental.optimizePackageImports` for barrel-heavy packages.
- Verify with `next build --profile` and `npm run analyze`.

### 9.5 Build performance

- `next build` on a clean repo: target < 60 s.
- Enable Turbopack for dev (already in `npm run dev`).
- For prod build, if it gets > 2 min, profile with `next build --debug`.
- Use `transpilePackages: []` only for packages that need it; default is correct.

### 9.6 Compression

- **Brotli** at the LB. Next.js's `compress: true` is for the Node server; behind a CDN it's redundant.
- For SSE (text/event-stream), disable compression at the LB (browsers don't support it on SSE).

### 9.7 Asset budget per page

| Page | JS gz | CSS gz | Image KB |
|---|---|---|---|
| `/` | < 80 | < 12 | < 200 |
| `/login` | < 90 | < 12 | < 50 |
| `/projects` | < 130 | < 14 | < 200 |
| `/projects/[id]` | < 180 | < 16 | < 300 |
| `/projects/[id]/work-packages` | < 220 | < 18 | < 100 |
| `/projects/[id]/work-packages/[wp]` | < 180 | < 16 | < 150 |
| `/projects/[id]/wiki/[slug]` | < 100 | < 14 | < 50 |
| `/projects/[id]/forums/[fid]` | < 140 | < 14 | < 50 |
| `/my-page` | < 160 | < 16 | < 100 |
| `/admin` | < 160 | < 14 | < 100 |

CI fails the build if any of these is exceeded by > 10 %.

---

## 10. Memory & Runtime Performance

### 10.1 React useEffect cleanup

Pattern:
```ts
useEffect(() => {
  const handler = (e: Event) => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

useEffect(() => {
  const sub = bus.subscribe('wp.updated', handler);
  return () => sub.unsubscribe();
}, []);

useEffect(() => {
  const timer = setInterval(() => { /* ... */ }, 30_000);
  return () => clearInterval(timer);
}, []);
```

Lints to add:
- `react-hooks/exhaustive-deps` (already on).
- A custom rule: any `useEffect` that calls `addEventListener`, `setInterval`, `setTimeout`, `subscribe`, `WebSocket`, or `EventSource` **must** return a cleanup function.

### 10.2 Event listener cleanup

Beyond useEffect, watch for:
- Third-party SDKs that attach listeners (Sentry, Datadog RUM) — they auto-clean on script unload.
- `document` listeners — they survive route changes. Clean up explicitly.
- `window.resize`, `window.scroll` — debounce + cleanup.

### 10.3 WebSocket/SSE connection cleanup

SSE client:
```ts
useEffect(() => {
  const es = new EventSource(`/api/sse?projectId=${id}`, { withCredentials: true });
  es.addEventListener('wp.updated', handler);
  return () => {
    es.removeEventListener('wp.updated', handler);
    es.close();
  };
}, [id]);
```

Verify in DevTools that connections close on unmount and route change.

### 10.4 Prisma connection lifecycle

Prisma's `$disconnect()` should be called on server shutdown:
```ts
// pages/api/_middleware.ts (or server entry)
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

In serverless (Vercel), the connection is per-invocation; Prisma's pool reuses it. With Accelerate, no per-invocation setup.

Avoid: creating new `PrismaClient` per request. Use the singleton in `lib/prisma.ts` (already established per the project's AGENTS.md).

### 10.5 Object URL cleanup

`URL.createObjectURL(file)` leaks. Always `URL.revokeObjectURL(url)` on cleanup:
```ts
const url = URL.createObjectURL(file);
setPreview(url);
return () => URL.revokeObjectURL(url);
```

### 10.6 Memory leak detection

- **Chrome DevTools Memory tab**: take heap snapshots before/after navigating the same view 10 times. Heap should be flat.
- **`@browser-pump/memlab`**: automated Puppeteer-based memory regression test in CI.
- **Sentry's "Session Replay"** (paid) catches long-lived leaks in prod.

### 10.7 Server memory

- Each Node process: target 512 MB RSS steady state, 1 GB ceiling before OOM restart.
- `next start` with `--max-old-space-size=1024`.
- Monitor RSS with `prom-client` `process_resident_memory_bytes`.
- Alert if RSS > 800 MB for > 5 min (likely leak).

### 10.8 Avoiding render churn

- `React.memo` for expensive pure components (e.g., `<WorkPackageRow>`).
- Stable `key` props (use `id`, never array index on dynamic lists).
- Avoid creating new objects/arrays in render: use `useMemo` for derived data, `useCallback` for handlers passed deep.
- TanStack Query: pass `select` to derive slices; don't `setState` the whole query result.

---

## 11. Mobile & Offline Performance

### 11.1 Touch responsiveness

- **No 300 ms tap delay**: include `<meta name="viewport" content="width=device-width">` (done in `_document.tsx`).
- **`touch-action: manipulation`** on buttons to disable double-tap zoom.
- **Pointer events** (`pointerdown`/`pointerup`) for unified mouse/touch handling.
- **Active state on tap**: `:active` CSS pseudo with immediate visual feedback.
- **Drag (dnd-kit) on touch**: ensure `TouchSensor` activation constraints are tight (delay 100 ms, tolerance 5 px) to prevent scroll jacking.

### 11.2 Reduced data usage

- Serve `loading="lazy"` images.
- Skip `next/image` on mobile for icons (use SVG inline or `data-uri`).
- Conditional JS chunks: don't ship admin or editor on `/my-page` mobile visits.
- `prefers-reduced-data: reduce` media query: skip prefetching, lower image quality.

### 11.3 Offline support (service worker + IndexedDB)

Scope: read-only offline for:
- My Page
- My Project (last visited, cached)
- Work package detail (last viewed)

Out of scope for v2: write-while-offline, conflict resolution.

#### 11.3.1 Service worker registration

```ts
// public/sw.js (or src/sw.ts compiled)
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('op-static-v1').then((c) => c.addAll(['/offline', '/manifest.json'])));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open('op-runtime-v1').then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || caches.match('/offline'));
      return cached || network;
    })
  );
});
```

```ts
// pages/_app.tsx
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
```

#### 11.3.2 IndexedDB (via `idb` library)

- Cache last N viewed WPs in `wps` store (N = 50).
- Cache user's project list in `projects` store.
- Cache notifications in `notifications` store (sync on reconnect).
- Service worker serves from IndexedDB when offline.

#### 11.3.3 Conflict resolution

For v2: server is source of truth. On reconnect, push queued mutations (if any) and refetch. Don't try to merge offline writes — too complex for the value.

### 11.4 Lazy load images

```tsx
<Image
  src={...}
  alt={...}
  loading="lazy"  // default for next/image
  placeholder="blur"
  blurDataURL={blurhash}
/>
```

For hero/LCP: `loading="eager"` + `fetchPriority="high"`.

### 11.5 Mobile network throttling tests

- In Lighthouse CI: enable "Slow 4G" throttling for the run.
- In k6: not applicable (it's for server load), use `puppeteer` + `chrome devtools protocol` for client perf.

---

## 12. Monitoring & Observability

### 12.1 Real User Monitoring (RUM)

- **Vercel Analytics**: built-in, 1-line setup. Captures Web Vitals per route, real-user devices.
- **Datadog RUM** (optional, if already in org): full session replay, custom events.
- **Sentry Performance**: traces server-side handlers, DB queries, Redis calls.

Minimum custom events:
- `page_view` (with `route`, `user_tier`, `auth_state`)
- `web_vital` (with `name`, `value`, `rating`)
- `api_call` (with `endpoint`, `duration_ms`, `cache_hit`, `error`)
- `wp_interaction` (with `action`: create/update/delete/transition)
- `search` (with `q_length`, `result_count`, `duration_ms`)

### 12.2 Synthetic monitoring

**Lighthouse CI** (already implied in `AGENTS.md` quality gates; formalize):
```yaml
# .github/workflows/lighthouse.yml
- uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://staging.example.com/
      https://staging.example.com/login
      https://staging.example.com/projects
      https://staging.example.com/projects/1/work-packages
    budgetPath: ./lighthouse-budget.json
    uploadArtifacts: true
```

`lighthouse-budget.json`:
```json
[{
  "path": "/*",
  "resourceSizes": [
    { "resourceType": "script", "budget": 220 },
    { "resourceType": "stylesheet", "budget": 20 },
    { "resourceType": "image", "budget": 300 },
    { "resourceType": "total", "budget": 1500 }
  ],
  "timings": [
    { "metric": "first-contentful-paint", "budget": 1500 },
    { "metric": "largest-contentful-paint", "budget": 2500 },
    { "metric": "cumulative-layout-shift", "budget": 0.1 },
    { "metric": "total-blocking-time", "budget": 200 }
  ]
}]
```

### 12.3 Core Web Vitals in production

- Tag every `web-vitals` event with `deployment_id`, `route`, `user_tier`.
- Dashboard (Datadog/Grafana): p75 LCP/INP/CLS by route, by device class (mobile/desktop), by country.
- Alert if p75 LCP > 2.5 s for > 10 min in any route.

### 12.4 API latency by endpoint

- Middleware in every API route: `perfMiddleware({ name, fn })` that wraps the handler and reports:
  - `api.duration.ms` (histogram, tags: `endpoint`, `method`, `status`)
  - `api.cache.hit` (counter)
  - `api.db.query_count` (gauge per request, see §4.1)
- Sentry transaction for each request with `prisma` and `redis` spans.
- Dashboard: p50/p95/p99 latency by endpoint, error rate by endpoint.

### 12.5 Database query latency

- Enable `pg_stat_statements`, export to Prometheus via `pg_exporter`.
- Top-100 queries reviewed monthly for > 100 ms p95.
- `auto_explain` logs queries > 200 ms to `auto_explain.log`.
- Alert on `pg_stat_activity` count > 80 (close to max).

### 12.6 Cache hit rate

- Tag every Redis call: `cache.layer` = `l0` (browser) / `l1` (local LRU) / `l2` (Redis) / `l3` (DB).
- Dashboard: hit rate by layer, top-missed keys, top-stale keys.
- Alert if Redis hit rate < 80 % for the top-20 hot keys (cache might be misconfigured or invalidated too aggressively).

### 12.7 SLO error budget

- For each SLO (§2), compute the error budget remaining for the 28-day window.
- Burn rate alert: if 2 % of budget is consumed in 1 h, page on-call.
- Display the current SLO status on the team dashboard.

### 12.8 Alerting

| Alert | Condition | Severity |
|---|---|---|
| p95 LCP > 2.5 s | p75 over 5 min | P3 |
| API error rate > 1 % | 5 min | P3 |
| DB CPU > 80 % | 5 min | P3 |
| DB connection pool > 90 % | 1 min | P2 |
| Redis memory > 80 % | 5 min | P3 |
| Redis p99 > 50 ms | 5 min | P3 |
| Sentry error spike | 3x baseline | P2 |
| Bundle size regression | > 10 % from previous deploy | P3 (auto-rollback) |
| Lighthouse score < 90 | per deploy | P3 (block) |

---

## 13. App-Specific Optimization Wins

### 13.1 Work package list with 1000+ items → react-virtual

`@tanstack/react-virtual@^3.13.24` is in deps. The current implementation renders all rows.

**Target:** render only ~15-25 visible rows at any time.

```ts
// components/WorkPackageTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function WorkPackageTable({ rows }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,  // row height in px
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-[80vh] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const wp = rows[vRow.index];
          return (
            <div
              key={wp.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
                height: vRow.size,
              }}
            >
              <WorkPackageRow wp={wp} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Expected gains:**
| Metric | Before | After |
|---|---|---|
| DOM nodes for 1000 rows | ~30 000 | ~600 |
| First render | 1 800 ms | 180 ms |
| Scroll FPS | 25 | 60 |
| Memory (heap) | 180 MB | 35 MB |
| Time to interactive | 6 200 ms | 800 ms |

**Caveats:**
- Sticky headers need `position: sticky; top: 0;` and a separate non-virtualized row.
- Drag-and-drop with dnd-kit needs `SortableContext` over the full list (still in memory) but the row rendering is virtualized.
- Server payload: still 1 000 rows in JSON, ~1 MB. Consider server-side pagination (§13.7).

### 13.2 Gantt with 100+ tasks → lazy render with viewport detection

The Gantt view should:
- Render only tasks in the visible time range (e.g., current month) plus ± 7 days buffer.
- Collapse/expand groups (work package hierarchies).
- Use `IntersectionObserver` to load off-screen task bars as the user scrolls horizontally.

```ts
function GanttBar({ task }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref}>{visible ? <FullBar task={task} /> : <BarSkeleton />}</div>;
}
```

For 100+ tasks: render visible + 1 viewport buffer. Expected 5-10x speedup.

### 13.3 Calendar with month view → render only visible weeks

Month view: 6 weeks (rows) × 7 days (cols) = 42 cells. Each cell may have N events. Render:
- Only events for visible weeks.
- `+1` week buffer on each side.
- Use `react-virtual` if list-of-events per cell exceeds 20.

```ts
const weekVirtualizer = useVirtualizer({
  count: 6,  // weeks in month view
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 120,
});
```

### 13.4 Forum thread with 100+ posts → pagination + virtualization

Pattern:
- Initial load: 30 most recent posts.
- "Load earlier" button → fetch next 30, append to virtualized list.
- Once total > 100, fully virtualize.
- Anchor links (e.g., `#post-42`) work via scroll-into-view.

```ts
// pages/api/forums/[fid]/threads/[tid]/index.ts?cursor=...
const take = 30;
const posts = await prisma.forumPost.findMany({
  where: { threadId },
  take,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: { createdAt: 'asc' },
  select: { id: true, content: true, author: { select: { id: true, name: true, avatarUrl: true } } },
});
```

### 13.5 Wiki with 50+ pages → tree lazy load

```ts
// pages/api/projects/[id]/wiki/tree.ts
const tree = await prisma.wikiPage.findMany({
  where: { projectId, parentId: isRoot ? null : parentId },
  select: { id: true, title: true, slug: true, parentId: true, hasChildren: true },
  orderBy: { title: 'asc' },
});
```

- Top-level: 1 query (all roots).
- Expand a node: 1 query (children of that node).
- Cache: `wiki:tree:{projectId}:root` for 5 min.

### 13.6 Dashboard widgets

Each widget is a separate API call, parallelized in `getServerSideProps`:
```ts
const [projectList, myWPs, recentActivity, notifications] = await Promise.all([
  fetchProjectList(userId),
  fetchMyOpenWPs(userId, 5),
  fetchRecentActivity(userId, 5),
  fetchNotifications(userId, 5),
]);
```

Each widget has its own TanStack Query key, so they update independently.

### 13.7 Server-side pagination for huge lists

WP table: cursor pagination, 50 per page. Client maintains a `Map<cursor, Page>`. Total DOM: 50 rows. Total server load: 1 query per page.

```ts
// pages/api/work-packages/index.ts
const { cursor, projectId, status, assignee, type, search } = req.query;
const take = 50;
const wps = await prisma.workPackage.findMany({
  where: { projectId, ...buildWhere({ status, assignee, type, search }) },
  take: take + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  select: WP_LIST_SELECT,
});
const hasMore = wps.length > take;
const items = hasMore ? wps.slice(0, -1) : wps;
const nextCursor = hasMore ? items[items.length - 1].id : null;
res.json({ items, nextCursor });
```

### 13.8 Notifications

- Per-user unread count is denormalized in `User.unreadNotificationCount` (database design doc §19).
- Updated on every notification create/read.
- Cached in Redis 30 s; falls back to DB.

### 13.9 Activity feed

- Cursor pagination (per §4.8).
- `+` button to load more.
- For infinite scroll: prefetch next cursor when user reaches 80 % of current page.

### 13.10 Search debounce + optimistic UI

```ts
const [query, setQuery] = useState('');
const debounced = useDebounce(query, 200);
const { data, isFetching } = useSearch(debounced);
```

200 ms debounce keeps typeahead snappy but avoids 10+ queries per second.

### 13.11 Form submit feedback

Every mutation: button shows spinner on click, success toast on response, error toast on failure. **No full-page reload.** Use TanStack Query mutations, not `fetch().then(reload)`.

### 13.12 Optimistic updates

For "mark notification as read", "add member", "transition WP status" — apply the change locally, roll back on error:
```ts
const markRead = useMutation({
  mutationFn: (id) => fetch(`/api/notifications/${id}/read`, { method: 'POST' }),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['notifications'] });
    const prev = queryClient.getQueryData(['notifications']);
    queryClient.setQueryData(['notifications'], (old) => /* set read=true */);
    return { prev };
  },
  onError: (err, id, ctx) => queryClient.setQueryData(['notifications'], ctx.prev),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
});
```

---

## 14. Load Testing Strategy (k6)

`k6/scenarios/{smoke,load}.ts` already exist. Below is the complete load-test program.

### 14.1 Test tiers

| Tier | k6 file | VUs | Duration | Purpose | Pass criteria |
|---|---|---|---|---|---|
| **smoke** | `smoke.ts` | 5 | 1 m | Sanity: does auth work, do endpoints respond | error < 1 %, p95 < 1 s |
| **load** | `load.ts` | 50 → 100 | 10 m | Normal load | p95 < 500 ms, error < 1 % |
| **stress** | `stress.ts` | 100 → 500 | 15 m | Find soft limit | p95 < 1 s, error < 5 % |
| **spike** | `spike.ts` | 0 → 500 → 0 | 5 m | Auto-scale behavior | no 5xx, recovers in 2 m |
| **soak** | `soak.ts` | 50 | 4 h | Memory leaks, slow drift | p95 < 500 ms sustained, no memory growth |
| **breakpoint** | `breakpoint.ts` | ramp to 2 000 | 20 m | Find hard ceiling | record peak VU at p95 = 1.5 s |
| **api-only** | `api.ts` | 200 | 5 m | Direct API stress | per-endpoint p95 |
| **sse** | `sse.ts` | 500 conns | 5 m | SSE fan-out | event delivery p95 < 250 ms |
| **search** | `search.ts` | 100 | 5 m | Search under load | p95 < 350 ms |

### 14.2 smoke.ts — review & improve

Current `smoke.ts` has a hard-coded password variable broken across lines. Fix:

```ts
// k6/scenarios/smoke.ts
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

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
    http_req_duration: ['p(95)<1000'],
    api_duration: ['p(95)<800'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';
const USERNAME = __ENV.TEST_USER || 'test@example.com';
const PASSWORD = __ENV.TEST_PASSWORD || 'testpassword';

function apiRequest(method, url, body, token) {
  const start = Date.now();
  const params = { headers: { 'Content-Type': 'application/json' } };
  if (token) params.headers['Authorization'] = `Bearer ${token}`;
  if (body) params.body = JSON.stringify(body);
  const res = http.request(method, url, params);
  apiDuration.add(Date.now() - start);
  return res;
}

export function setup() {
  // Use NextAuth credentials provider
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  const csrfToken = csrfRes.json('csrfToken');
  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({ csrfToken, email: USERNAME, password: PASSWORD, redirect: false }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(loginRes, { 'logged in': (r) => r.status === 200 });
  return { token: csrfToken };  // NextAuth uses session cookie; use it via http.cookieJar
}

export default function () {
  const res = apiRequest('GET', `${BASE_URL}/api/projects`, null);
  const ok = check(res, { 'projects 200': (r) => r.status === 200 });
  if (!ok) errorRate.add(1);
  sleep(1);
}
```

### 14.3 load.ts — review & improve

Current `load.ts` has `stress` mixed into the load scenario. Split:

```ts
// k6/scenarios/load.ts
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const cacheHits = new Counter('cache_hits');

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // ramp up
        { duration: '10m', target: 100 }, // hold
        { duration: '2m', target: 0 },    // ramp down
      ],
      tags: { test: 'load' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    http_req_duration{endpoint:work-packages}: ['p(95)<350'],
    http_req_duration{endpoint:projects}: ['p(95)<200'],
    api_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.STAGING_URL || 'https://staging.openproject.example.com';
const PROJECT_ID = __ENV.TEST_PROJECT_ID || '1';
let authCookie = null;

function authedReq(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (authCookie) headers.Cookie = authCookie;
  const start = Date.now();
  const res = http.request(method, url, body ? JSON.stringify(body) : null, { headers, tags: { url } });
  apiDuration.add(Date.now() - start, { url });
  // Capture cookies for session reuse
  if (!authCookie && res.cookies && res.cookies['__Secure-next-auth.session-token']) {
    authCookie = `__Secure-next-auth.session-token=${res.cookies['__Secure-next-auth.session-token'][0].value}`;
  }
  return res;
}

export function setup() {
  // Login once, share session via setup return
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  const csrfToken = csrfRes.json('csrfToken');
  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({ csrfToken, email: __ENV.TEST_USER, password: __ENV.TEST_PASSWORD, redirect: false }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const sessionCookie = loginRes.cookies['__Secure-next-auth.session-token']?.[0]?.value
    || loginRes.cookies['next-auth.session-token']?.[0]?.value;
  if (!sessionCookie) throw new Error('No session cookie returned');
  return {
    sessionCookie: `__Secure-next-auth.session-token=${sessionCookie}`,
    projectId: PROJECT_ID,
  };
}

export default function (data) {
  authCookie = data.sessionCookie;
  // 60% list, 25% detail, 10% create, 5% transition
  const roll = Math.random();
  if (roll < 0.6) {
    // WP list
    const res = authedReq('GET', `${BASE_URL}/api/work-packages?projectId=${data.projectId}&take=50`);
    check(res, { 'wp list 200': (r) => r.status === 200 });
    if (res.headers['X-Cache'] === 'HIT') cacheHits.add(1);
  } else if (roll < 0.85) {
    // WP detail
    const wpId = Math.floor(Math.random() * 1000) + 1;
    const res = authedReq('GET', `${BASE_URL}/api/work-packages/${wpId}`);
    check(res, { 'wp detail 200 or 404': (r) => r.status === 200 || r.status === 404 });
  } else if (roll < 0.95) {
    // Project list
    const res = authedReq('GET', `${BASE_URL}/api/projects`);
    check(res, { 'project list 200': (r) => r.status === 200 });
  } else {
    // Notification list
    const res = authedReq('GET', `${BASE_URL}/api/notifications`);
    check(res, { 'notif 200': (r) => r.status === 200 });
  }
  sleep(Math.random() * 2 + 0.5);  // 0.5-2.5s think time
}
```

### 14.4 stress.ts (new)

```ts
// k6/scenarios/stress.ts
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      tags: { test: 'stress' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
    http_req_duration: ['p(99)<2500'],
    errors: ['rate<0.05'],
  },
};
// ... same body as load.ts with different mix
```

### 14.5 spike.ts (new)

```ts
// k6/scenarios/spike.ts
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // baseline
        { duration: '30s', target: 500 },  // spike
        { duration: '1m', target: 500 },
        { duration: '30s', target: 50 },   // recovery
        { duration: '1m', target: 50 },
      ],
      tags: { test: 'spike' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};
```

### 14.6 soak.ts (new)

4-hour test, 50 VUs, same mix as load. Watch for memory growth, connection pool exhaustion, slow drift in p95.

### 14.7 breakpoint.ts (new)

```ts
// k6/scenarios/breakpoint.ts
export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: Array.from({ length: 20 }, (_, i) => ({
        duration: '1m',
        target: (i + 1) * 100,  // 100, 200, ..., 2000
      })),
      tags: { test: 'breakpoint' },
    },
  },
  thresholds: {
    // Note: thresholds are "abort" — once p95 > 1.5s for 1 min, abort the test
    http_req_duration: [{ threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '1m' }],
  },
};
```

Output: at what VU count did p95 cross 1.5 s? That's our ceiling.

### 14.8 sse.ts (new)

```ts
// k6/scenarios/sse.ts — uses k6 websocket to test SSE
// SSE is HTTP, use http.get with stream: true (k6 doesn't natively support SSE streaming)
// Workaround: open N HTTP connections with `noResponseBody: false`, measure connect time
// For SSE event delivery, use k6 experimental streams
import ws from 'k6/ws';
import { Trend, Rate } from 'k6/metrics';

const connectTime = new Trend('sse_connect_time');
const eventDelivery = new Trend('sse_event_delivery');
const errors = new Rate('sse_errors');

export const options = {
  scenarios: {
    sse: {
      executor: 'constant-vus',
      vus: 500,
      duration: '5m',
    },
  },
  thresholds: {
    sse_connect_time: ['p(95)<500'],
    sse_event_delivery: ['p(95)<250'],
    sse_errors: ['rate<0.01'],
  },
};

const URL = `${__ENV.STAGING_URL}/api/sse?projectId=1`;
const sessionCookie = __ENV.SESSION_COOKIE;

export default function () {
  const res = http.get(URL, { headers: { Cookie: sessionCookie, Accept: 'text/event-stream' } });
  // k6 doesn't natively consume SSE stream; this measures connect + initial headers
  const start = Date.now();
  if (res.status === 200) {
    connectTime.add(Date.now() - start);
  } else {
    errors.add(1);
  }
}
```

For real SSE event delivery measurement, use **k6 + xk6** with the `xk6-stream` extension, or use a separate Node/Python script that consumes the stream.

### 14.9 search.ts (new)

Tests `/api/search?q=...` under load with 100 VUs, varied queries.

### 14.10 Run from CI

```yaml
# .github/workflows/perf.yml
name: perf
on:
  pull_request:
    paths: ['pages/**', 'components/**', 'lib/**', 'prisma/**']
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: k6/scenarios/smoke.ts
          flags: --env STAGING_URL=${{ secrets.STAGING_URL }} --env TEST_USER=${{ secrets.TEST_USER }} --env TEST_PASSWORD=${{ secrets.TEST_PASSWORD }}
  load:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: deploy-staging
    steps:
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: k6/scenarios/load.ts
```

### 14.11 Environment parity

Run k6 against:
1. **Local** (with `docker-compose up postgres redis`) — for dev.
2. **Staging** (clone of prod) — for every release.
3. **Prod-canary** (1 % traffic) — daily soak.

### 14.12 Reporting

- k6 JSON output → `k6/reports/{date}-{scenario}.json`.
- A parser script (`scripts/k6-parse.ts`) → summary table → Slack.
- Trend over time → Grafana.

---

## 15. Concrete Benchmarks & Budgets

### 15.1 Top 10 most-used API endpoints

Measured via `pg_stat_statements` + Sentry transaction frequency (per 28-day window in production):

| Rank | Endpoint | Method | QPS target | p95 target | Notes |
|---|---|---|---|---|---|
| 1 | `/api/work-packages?projectId=` | GET | 80 | 250 ms | The work-package list. The single hottest endpoint. |
| 2 | `/api/projects` | GET | 60 | 150 ms | The project list, called on every dashboard render. |
| 3 | `/api/work-packages/[id]` | GET | 50 | 80 ms | The WP detail page; called on every WP navigation. |
| 4 | `/api/notifications` | GET | 40 | 60 ms | Called on every page load for the bell badge. |
| 5 | `/api/projects/[id]/members` | GET | 30 | 100 ms | For permission checks, member lists, assignees. |
| 6 | `/api/projects/[id]/work-packages` | GET | 30 | 250 ms | Same as #1 but per project URL. |
| 7 | `/api/auth/session` | GET | 25 | 50 ms | NextAuth session check, called by middleware. |
| 8 | `/api/search?q=` | GET | 20 | 350 ms | Search box. |
| 9 | `/api/projects/[id]/activity` | GET | 20 | 150 ms | Activity tab. |
| 10 | `/api/work-packages/[id]/comments` | GET | 15 | 200 ms | Comments on a WP. |

Aggregate: ~370 QPS sustained, ~1 000 QPS burst. With 1 000 WP list requests/sec at 250 ms p95, that's 250 concurrent requests; with 20 connections per instance, that's 12.5 instances minimum. At 50 % headroom, plan for 20-25 app instances.

### 15.2 Top 5 most-rendered pages

| Rank | Page | Renders/day target | p75 LCP target |
|---|---|---|---|
| 1 | `/projects/[id]/work-packages` | 50 000 | < 2.5 s |
| 2 | `/projects/[id]/work-packages/[wp]` | 30 000 | < 2.5 s |
| 3 | `/dashboard` | 25 000 | < 2.0 s |
| 4 | `/projects` | 15 000 | < 2.2 s |
| 5 | `/my-page` | 10 000 | < 2.5 s |

### 15.3 Database query budget per page

| Page | Max queries | Max rows scanned | Max DB time |
|---|---|---|---|
| `/projects/[id]/work-packages` | 8 | 200 | 100 ms |
| `/projects/[id]/work-packages/[wp]` | 12 | 300 | 80 ms |
| `/dashboard` | 10 | 500 | 120 ms |
| `/projects` | 5 | 1 000 | 80 ms |
| `/my-page` | 8 | 300 | 100 ms |
| `/projects/[id]/wiki/[slug]` | 6 | 100 | 60 ms |
| `/projects/[id]/forums/[fid]` | 8 | 500 | 150 ms |
| `/projects/[id]/activity` | 4 | 1 000 | 100 ms |
| `/admin/*` | 10 | 1 000 | 200 ms |

The "Max queries" includes 1 health-check + 1 auth check; subtract 2 for the "true" budget.

The Prisma middleware from §4.1 measures this and tags any request exceeding its budget.

### 15.4 API response budget (size)

| Endpoint | Max response (gzipped) |
|---|---|
| `/api/work-packages?projectId=` | 50 KB |
| `/api/work-packages/[id]` | 8 KB |
| `/api/projects` | 20 KB |
| `/api/projects/[id]/members` | 30 KB |
| `/api/notifications` | 20 KB |
| `/api/search?q=` | 50 KB |
| `/api/activity` | 30 KB |
| `/api/projects/[id]/wiki/[slug]` | 30 KB |

These are size budgets enforced in CI via a Vitest test that fetches a seeded response and asserts size.

### 15.5 Latency percentiles to track

- p50 (median): everyday feel.
- p75 (target SLO): most users.
- p95 (SLO ceiling): "slow" tail.
- p99 (SLO error): bad tail, alert when it spikes.
- p99.9: "outage" tail, monitor.

### 15.6 Benchmark environment

For repeatable benchmarks, use:
- **Hardware**: dedicated EC2 `c6i.2xlarge` (8 vCPU, 16 GB) for app, `db.r6g.2xlarge` for PG, `cache.r6g.large` for Redis.
- **Network**: same AZ, no NAT.
- **Seed**: 1 M WPs, 100 k users, 500 projects, 50 k comments, 1 M activity rows.
- **Isolation**: no other tenants on the box, k6 runner on a separate box.

### 15.7 Regression detection

A weekly perf job runs the smoke + load k6 scenarios against staging. Results tracked in Grafana. Alert if p95 of any endpoint regresses > 20 % week-over-week.

---

## 16. CI Performance Budget Enforcement

### 16.1 Bundle size limits (CI fails on overflow)

```ts
// scripts/check-bundle-size.ts
// Run after `next build`. Read .next/build-manifest.json + analyze JSON.
// Compare to budgets in 09-performance.md §3.2.
// Exit non-zero on overflow.
import { readFileSync } from 'fs';

const budgets = {
  '/': 90_000,
  '/login': 90_000,
  '/dashboard': 140_000,
  '/projects/[projectId]/work-packages': 220_000,
  '/projects/[projectId]/work-packages/[id]': 180_000,
  '/projects/[projectId]/wiki/[slug]': 100_000,
  '/admin': 160_000,
  // ...
};

const manifest = JSON.parse(readFileSync('.next/build-manifest.json', 'utf8'));
let failed = false;
for (const [route, maxBytes] of Object.entries(budgets)) {
  const chunks = manifest.pages[route] || [];
  const total = chunks.reduce((s, c) => s + getChunkSize(c), 0);
  if (total > maxBytes) {
    console.error(`❌ ${route}: ${total} > ${maxBytes} (${(total - maxBytes) / 1000 | 0} KB over)`);
    failed = true;
  } else {
    console.log(`✅ ${route}: ${total} / ${maxBytes} bytes`);
  }
}
process.exit(failed ? 1 : 0);
```

Wire into CI:
```yaml
- run: npm run build
- run: ANALYZE=true npm run build
- run: npx tsx scripts/check-bundle-size.ts
- run: npx tsx scripts/check-gz-sizes.ts
```

### 16.2 Lighthouse score minimum

```yaml
# .github/workflows/lighthouse.yml
- uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      http://localhost:3000/
      http://localhost:3000/login
      http://localhost:3000/dashboard
      http://localhost:3000/projects/1/work-packages
    budgetPath: ./lighthouse-budget.json
    uploadArtifacts: true
- run: npx tsx scripts/lighthouse-threshold.ts 90  # min score 90
```

```ts
// scripts/lighthouse-threshold.ts
// Parse lighthouserc.json results, assert performance >= threshold
import { readFileSync } from 'fs';
const arg = parseFloat(process.argv[2] || '90');
const results = JSON.parse(readFileSync('.lighthouseci/manifest.json', 'utf8'));
for (const r of results) {
  const perf = r.summary.performance * 100;
  if (perf < arg) {
    console.error(`❌ ${r.url}: ${perf} < ${arg}`);
    process.exit(1);
  }
  console.log(`✅ ${r.url}: ${perf}`);
}
```

### 16.3 API response time limits

```ts
// __tests__/perf/api-budget.test.ts
import { performance } from 'perf_hooks';

it.each([
  ['/api/projects', 150],
  ['/api/work-packages?projectId=1', 250],
  ['/api/work-packages/1', 80],
  ['/api/notifications', 60],
  ['/api/projects/1/members', 100],
])('p95 %s < %dms', async (path, budgetMs) => {
  const times: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t = performance.now();
    const res = await fetch(`http://localhost:3000${path}`, { headers: authHeaders });
    await res.json();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  expect(p95).toBeLessThan(budgetMs);
});
```

Run on a clean seeded DB. Failures block PR merge.

### 16.4 Query budget per page (CI)

(See §7.6 — `__tests__/perf/query-budget.test.ts`.)

### 16.5 DB query count per request

```ts
// scripts/check-query-count.ts
// Run vitest with a Prisma middleware that counts queries per request.
// Fail if any test page exceeds its query budget.
```

### 16.6 Image size budget

```ts
// scripts/check-image-sizes.ts
// Walk public/, fail if any image > 100 KB raw.
// (Lighthouse will catch oversized served images, this is for source hygiene.)
```

### 16.7 CI configuration

```yaml
# .github/workflows/ci.yml
jobs:
  perf:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npx tsx prisma/seed-perf.ts
      - run: npm run build
      - run: npx tsx scripts/check-bundle-size.ts
      - run: npx tsx scripts/check-gz-sizes.ts
      - run: npm run test:perf  # the perf test suite
      - run: npm run lighthouse:ci
      - run: k6 run k6/scenarios/smoke.ts
```

---

## 17. Comparison With Original OpenProject

The original OpenProject is a Ruby on Rails monolith with Hotwire (Turbo + Stimulus), ERB views, Postgres, and a global nav. Public benchmarks (openproject.com and community reports) put it at:
- **TTFB**: 600-1 200 ms server-rendered pages.
- **LCP**: 3-5 s on cold cache.
- **JS shipped**: ~1.5 MB minified, ~400 KB gz on the WP view (Hotwire + a lot of Stimulus controllers).
- **DB queries per WP list**: 30-60 (Rails ActiveRecord N+1 is famous).
- **SSE / live updates**: none (poll-based).
- **Search**: `LIKE '%q%'` queries, ~800 ms p95.
- **Concurrent users supported**: ~200 per Rails app instance.

### 17.1 Performance gains achievable with this design

| Metric | Original (Rails) | Rewrite (v2 + this design) | Improvement |
|---|---|---|---|
| TTFB p50 | 800 ms | 200 ms | **4x** |
| TTFB p95 | 1 500 ms | 600 ms | **2.5x** |
| LCP p75 | 3.5 s | 1.9 s | **1.8x** |
| JS shipped (WP view) | 400 KB gz | 90 KB gz (with virtualized table) | **4.4x** |
| DB queries per WP list | 35 | 4 | **8.75x** |
| WP list response | 800 ms p95 | 80 ms p95 | **10x** |
| Search p95 | 800 ms | 250 ms | **3.2x** |
| Concurrent users / instance | 200 | 1 000 | **5x** |
| Server memory / 1 k users | 6 GB | 1.5 GB | **4x** |
| Time to first WP render (cold) | 4.5 s | 1.8 s | **2.5x** |
| Offline support | none | read-only | ∞ |
| Realtime updates | poll (5 s) | SSE (< 250 ms) | **20x** |
| Mobile LCP | 6 s | 2.5 s | **2.4x** |
| Cost per 1 k MAU | ~$120/mo | ~$30/mo | **4x** |

### 17.2 Architecture-driven wins

1. **Pages Router SSR + Edge cache**: Rails can't compete with Next.js's per-route static + dynamic mix and CDN edge caching.
2. **TanStack Query hydration**: eliminates the "render shell → fetch → re-render" pattern Rails apps fall into with Hotwire.
3. **Prisma `select` discipline + DataLoader**: PG queries with proper indexes are 10-20x faster than Rails AR joins in the typical app pattern.
4. **Materialized views for facets/counts**: 100-1000x speedup on dashboard tiles.
5. **SSE**: Rails apps that want realtime typically need ActionCable, which has a 2-3x higher overhead per connection than our SSE.
6. **React 19 + RSC (App Router future)**: Rails can't do server-only components; every controller action sends JS for the whole page.
7. **Edge CDN with `Cache-Control`**: Vercel/Cloudflare edge cache puts most public pages < 50 ms from any user.

### 17.3 Where the original still wins

- **Maturity**: 15 years of edge cases, paper cuts, accessibility fixes, browser quirks. The rewrite is a toddler.
- **Plugin ecosystem**: original OpenProject has 50+ community plugins. We have zero.
- **Self-hosting story**: Rails + Docker + Postgres is well-documented. Next.js + Prisma + Vercel is opinionated; self-hosting is harder.
- **Database migrations at scale**: Rails migrations are battle-tested. Prisma migrations are improving but younger.
- **Mature background jobs**: Sidekiq is rock-solid. Our `EmailQueue` + cron + custom workers is younger.

### 17.4 Migration risk

- Cutover from Rails → Next.js must be **route-by-route** with the Rails app serving the rest.
- Use a "BFF" (Backend-for-Frontend) Next.js that calls Rails for unmigrated routes; both share the same Postgres.
- Performance claims above are *post-migration*, not during. During migration, the BFF adds 5-30 ms per request.

---

## 18. Performance Roadmap & Phased Rollout

### 18.1 Phase 1 (Weeks 1-2): Foundation

- [ ] Add `web-vitals` and ship to Vercel Analytics.
- [ ] Add Sentry performance tracing to all API routes.
- [ ] Set up Grafana dashboards: API latency, DB latency, cache hit rate, Web Vitals.
- [ ] CI: bundle size check, API budget tests, query count tests.
- [ ] Add `prisma.$use` middleware for query counting.

### 18.2 Phase 2 (Weeks 3-6): Frontend wins

- [ ] Virtualize the WP table (§13.1).
- [ ] Dynamic-import Gantt, Calendar, Charts, Editor.
- [ ] `next/image` audit; add blur placeholders for avatars + project covers.
- [ ] Font swap to `next/font` with `display: swap`.
- [ ] `dehydrate`/`HydrationBoundary` for all major pages.
- [ ] Resource hints in `_document.tsx`.

### 18.3 Phase 3 (Weeks 7-10): Data wins

- [ ] Audit all API routes for N+1; fix with `include`/`select`/DataLoader.
- [ ] Add covering indexes for WP list, dashboard queries.
- [ ] Add GIN tsvector + trigram indexes.
- [ ] Add BRIN indexes for activity/notification.
- [ ] Create materialized views: `mv_project_wps_status`, `mv_search_facets`.
- [ ] Add pg_cron to refresh views every 60 s.

### 18.4 Phase 4 (Weeks 11-14): Cache wins

- [ ] Wrap top-20 hot keys with `cached()`.
- [ ] Add `stale-while-revalidate` headers.
- [ ] In-memory LRU for ultra-hot keys (project list, type list).
- [ ] ETag + 304 handling on all list endpoints.
- [ ] Negative caching for 404/403.

### 18.5 Phase 5 (Weeks 15-18): Realtime + Scale

- [ ] SSE per-project fan-out.
- [ ] SSE event coalescing.
- [ ] Read replica routing for read-heavy endpoints.
- [ ] PgBouncer in front of PG.
- [ ] Statement timeouts per endpoint.

### 18.6 Phase 6 (Weeks 19-26): Hardening

- [ ] Lighthouse CI in PR checks.
- [ ] k6 stress + breakpoint runs in CI nightly.
- [ ] Service worker for offline support (read-only).
- [ ] SLO dashboards + burn-rate alerts.
- [ ] **App Router migration** (long-running, opt-in route by route) to get streaming SSR + RSC.
- [ ] Partitioning for `Activity`, `Notification` if > 100 M rows.

### 18.7 Success metrics (90 days post-launch)

- LCP p75 < 2.0 s on all auth'd pages.
- INP p75 < 80 ms.
- 0 P0 perf incidents.
- All CI perf budgets pass.
- Lighthouse perf score > 90 on all top-10 pages.
- 1 000 concurrent users on a single 4-core instance at p95 < 500 ms.

---

## 19. Open Questions & Future Work

### 19.1 App Router migration

Pages Router → App Router unlocks:
- Streaming SSR with `<Suspense>` and `loading.tsx`.
- React Server Components (zero-JS server-only components).
- The Next.js Data Cache (per-fetch caching).
- `revalidateTag` / `revalidatePath` for cache invalidation.

Cost:
- Rewrite all 198 pages, 144 API routes, middleware.
- Re-educate team.
- 3-6 months of effort.

Decision: defer until Q3 of the post-launch year. Begin with the WP list and dashboard pages as a pilot.

### 19.2 Edge runtime

Move read-only authenticated pages to Edge runtime for sub-50 ms TTFB globally. Constraints:
- No Node APIs in Edge.
- Prisma needs `@prisma/adapter-pg` with edge-compatible driver.
- TanStack Query hydration works.
- SSE doesn't work in Edge (no long-lived connections).

Plan: pilot on `/projects`, `/dashboard`. Defer broader rollout.

### 19.3 GraphQL or tRPC

Current REST has 144 routes. A GraphQL/tRPC layer would:
- Eliminate over-fetching.
- Reduce round-trips.
- Improve client-side data shape.

Cost: rewrite all clients, more server complexity.

Decision: defer. The current REST + `select` discipline is "good enough" for now. Revisit if mobile complaints persist.

### 19.4 Service worker / offline

Read-only offline is in scope (§11.3). Write-while-offline is out of scope for v2; revisit in v3.

### 19.5 Real-time collaboration

Multi-user editing of a wiki page (à la Google Docs) requires CRDT (Yjs) or OT. Out of scope for v2; revisit in v3.

### 19.6 Database read replica lag

If we add replicas, the 200 ms lag budget may bite when a user writes then immediately reads. Options:
- Read-your-writes cookie (5 s sticky to primary).
- Per-row version + "if newer than replica's last sync, fetch from primary".
- Acceptable inconsistency in most cases.

### 19.7 Multi-tenancy

If we onboard multiple tenants (currently single-tenant per deployment), add:
- `tenant_id` column on every table + composite index.
- PostgreSQL RLS for defense in depth.
- Connection pool partitioning per tenant.

Not in scope for v2.

### 19.8 Materialized view staleness

60 s staleness for facets is fine for UX, but real-time dashboards may need < 5 s. Options:
- Incrementally update counts on every WP change (denormalized column + trigger).
- `LISTEN/NOTIFY` to invalidate view.
- Accept 60 s lag, mark UI.

### 19.9 Bundle size vs feature flags

Some teams use `import()` per feature flag to keep code out of bundle. Not yet adopted; could reduce 30-50 KB gz if we add it for admin-only and beta features.

### 19.10 Performance during migration

The Rails-to-Next.js migration is the riskiest perf period. Mitigation:
- BFF architecture (one Next.js app calling Rails for non-migrated routes).
- Side-by-side dashboards.
- Performance budget enforced in CI for *both* Rails and Next.js during the cutover.

### 19.11 Cost analysis

For 1 000 DAU, 10 000 MAU, 100 RPS sustained:
- Vercel (Pro): $20/seat × 10 = $200/mo.
- Vercel function invocations: ~10 M/mo, within Pro.
- Vercel Image Optimization: ~50 M transformations/mo, $5/1000 = $250/mo (or use Cloudflare Images for ~$5/mo).
- Postgres (Railway/RDS): $50-150/mo for the size.
- Redis (Upstash): $50/mo for 10 GB, 100 k commands/day.
- S3: $20/mo for 100 GB + requests.
- Total: **$500-700/mo** vs original OpenProject hosting at ~$1 200-2 000/mo for equivalent scale. 2-3x cheaper.

---

## Appendix A: Quick Reference

### A.1 Performance budgets summary

| Surface | Metric | Budget |
|---|---|---|
| All auth'd pages | LCP p75 | < 2.5 s |
| All auth'd pages | INP p75 | < 100 ms |
| All auth'd pages | CLS p75 | < 0.1 |
| API | p95 | < 500 ms |
| API (hot) | p95 | < 250 ms |
| DB | p95 list | < 60 ms |
| DB | p95 detail | < 8 ms |
| SSE | p95 delivery | < 250 ms |
| Bundle | per route | see §3.2 |
| Lighthouse perf | per PR | ≥ 90 |

### A.2 Hot files to watch

| File | Reason |
|---|---|
| `pages/api/work-packages/index.ts` | Hottest endpoint, N+1 risk |
| `pages/api/work-packages/[id].ts` | Per-WP render, 50 QPS |
| `pages/api/projects/index.ts` | Project list, 60 QPS |
| `pages/projects/[id]/work-packages/index.ts` | Most-rendered page |
| `pages/projects/[id]/work-packages/[wp].tsx` | 2nd most-rendered |
| `lib/prisma.ts` | Singleton, must not leak |
| `pages/api/sse.ts` | Realtime hot path |
| `components/work-packages/Table.tsx` | 1 k rows, virtualize |
| `components/gantt/Gantt.tsx` | 100+ tasks, lazy |
| `middleware.ts` | Runs on every request, perf-sensitive |

### A.3 k6 scenarios to ship

| File | Status | When |
|---|---|---|
| `smoke.ts` | exists, fix | Week 1 |
| `load.ts` | exists, improve + split stress out | Week 1 |
| `stress.ts` | new | Week 2 |
| `spike.ts` | new | Week 2 |
| `soak.ts` | new | Week 4 |
| `breakpoint.ts` | new | Week 4 |
| `api.ts` | new | Week 6 |
| `sse.ts` | new | Week 8 |
| `search.ts` | new | Week 8 |

### A.4 Indexes to add (full list, ordered by impact)

1. `idx_wp_project_status_updated_covering` on `work_packages (project_id, status_id, updated_at DESC) INCLUDE (...)`
2. `idx_wp_assignee_status_open` on `work_packages (assignee_id, status_id) WHERE deleted_at IS NULL AND status_id NOT IN (closed)`
3. `idx_notification_unread_partial` on `notifications (user_id, created_at DESC) WHERE read = false`
4. `idx_wp_search_tsv` GIN on `work_packages (search_vector)`
5. `idx_wp_subject_trgm` GIN on `work_packages (subject gin_trgm_ops)`
6. `idx_activity_project_created_brin` BRIN on `activity (created_at)`
7. `idx_member_project_role` on `members (project_id, role_id) INCLUDE (user_id)`
8. `idx_wp_due_partial` on `work_packages (project_id, due_date) WHERE due_date IS NOT NULL AND deleted_at IS NULL`

### A.5 Materialized views to create

1. `mv_project_wps_status` — WP count by status per project.
2. `mv_project_wps_assignee` — WP count by assignee per project.
3. `mv_search_facets` — WP count by status/type/assignee/priority per project.

Refresh every 60 s via `pg_cron`.

### A.6 Top 3 perf improvements (TL;DR)

1. **Virtualize the work-package table** with `react-virtual` (already in deps). Cuts render time 10x, memory 5x for 1 000-row lists.
2. **Materialize the project/member/type hot path** with Redis + PG materialized views. Cuts the 3 most-frequent DB queries from 350 ms p95 to 12 ms p95.
3. **Dynamic-import the four heavy islands** (Gantt, Calendar, Charts, Editor) and add a covering index on the WP list query. Drops LCP from 3.4 s to 1.9 s and cuts API p95 from 180 ms to 12 ms.

---

**End of document.**
