# OpenProject Rewrite — Frontend Architecture Overhaul (v2)

**Author:** Senior Frontend Architecture Expert
**Target:** Next.js 15.5.15 (Pages Router) · React 19.1.0 · TypeScript 5
**Date:** 2026-06-06
**Status:** Design (no code changes yet)
**Reviewers:** Tech Lead, Frontend Lead, DX Lead

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Guiding Principles](#3-guiding-principles)
4. [Folder Structure Refactor](#4-folder-structure-refactor)
5. [Component Patterns](#5-component-patterns)
6. [State Management Strategy](#6-state-management-strategy)
7. [Data Fetching Patterns](#7-data-fetching-patterns)
8. [Routing Strategy](#8-routing-strategy)
9. [Performance Optimization](#9-performance-optimization)
10. [Realtime Architecture](#10-realtime-architecture)
11. [Forms](#11-forms)
12. [Tables](#12-tables)
13. [Charts, Gantt & Calendar](#13-charts-gantt--calendar)
14. [Rich-Text Editor](#14-rich-text-editor)
15. [TypeScript Strict Mode Strategy](#15-typescript-strict-mode-strategy)
16. [Testing Strategy](#16-testing-strategy)
17. [Dependency Recommendations](#17-dependency-recommendations)
18. [Migration Plan](#18-migration-plan)
19. [Concrete Code Examples](#19-concrete-code-examples)
20. [Top 3 Architectural Changes — Summary](#20-top-3-architectural-changes--summary)
21. [Appendix A: Linting & Code Quality Gates](#appendix-a-linting--code-quality-gates)
22. [Appendix B: Error Catalogue & UX Patterns](#appendix-b-error-catalogue--ux-patterns)
23. [Appendix C: Decision Log](#appendix-c-decision-log)

---

## 1. Executive Summary

OpenProject Rewrite is currently a 92 % feature-complete Next.js 15 Pages-Router app with 54 page files, 144 API routes, 56 Prisma models, and ~133 React components. The frontend is **structurally healthy but organisationally flat** — every hook, store, and type lives in a top-level directory, and the `components/` tree is already grouped by feature (good) but exposes raw primitives directly to pages (bad).

This document proposes a **feature-modular frontend architecture** that:

- **Co-locates** everything a feature needs (UI, hooks, types, server actions, store slice, tests) under `src/features/<feature>/` so deletion is a one-folder affair.
- **Promotes TanStack Query to a first-class data layer** with a strict query-key factory, mutation conventions, and a global error bus.
- **Splits Zustand into thin, sliced stores** (one per concern) with persist + devtools + selector optimisation, rather than the current god-store.
- **Adds type-safe URL state** via `nuqs` so filters, sort, pagination, and active tabs survive page reloads and are shareable.
- **Standardises forms** on `react-hook-form` + `zod` (zod is already a dep, RHF is not).
- **Introduces a feature-flag + codemod migration path** so the new architecture can land module-by-module without breaking the 92 % of pages that already work.
- **Locks down TypeScript strict mode** end-to-end, with `prisma generate` -> `zod` -> `react-hook-form` as the type pipeline.
- **Adds `@tanstack/react-table`** as the table primitive (you already have `@tanstack/react-virtual`), **Tiptap** for the rich-text editor (Wiki, Forum, News, Documents, Comments), and **@hookform/resolvers** for the form-validation glue.

We will keep **Pages Router** (per AGENTS.md and the team rule), keep **Tailwind v4** + **Radix UI**, and keep the existing SSE infrastructure.

The migration is staged over **4 sprints** behind a single `NEXT_PUBLIC_ARCH_V2=1` flag; pages can be flipped to the new architecture one route group at a time.

---

## 2. Current State Audit

### 2.1 Inventory (verified 2026-06-06)

| Area | Path | Count | Status |
|---|---|---:|---|
| Page files | `pages/**/*.tsx` | 54 | Good. Includes 21 in `pages/projects/[projectId]/` subroutes. |
| API routes | `pages/api/**` | 37 top-level (144 with subroutes) | Healthy. RESTful, zod-validated. |
| Prisma models | `prisma/schema.prisma` | 56 | Mature. Includes Wiki, Forum, Document, Meeting (Phase 4). |
| Components | `components/**/*.tsx` | 133 | Already grouped by feature. **But** no co-location with hooks/types. |
| Hooks | `hooks/use-*.ts` | 41 | Flat. Mixed data hooks and UI hooks. |
| Stores | `stores/ui-store.ts` | 1 | Single god-store. No persist, no devtools middleware. |
| Types | `types/*.ts` | 13 | One file per domain. Not consumed via a barrel. |
| Lib | `lib/*.ts` | 28 dirs/files | Mixed: API helpers, prisma, auth, exporters, gantt, etc. |
| Tests | `__tests__/`, `src/test/` | (folder exists) | Vitest + RTL + Playwright. No per-feature colocated tests. |
| Middleware | `middleware.ts` | 1 file | Coarse: only `/dashboard` + `/projects` are protected. No RBAC. |

### 2.2 Strengths

1. **Feature-grouped `components/`** (e.g. `components/work-packages/{board,table,gantt,calendar,detail,query}`) — we should preserve this mental model.
2. **Centralised `queries/queryKeys.ts`** is a real factory pattern with `as const`. Excellent foundation.
3. **TanStack Query already wired** in `_app.tsx` with sane defaults (5 min stale, no refetch-on-focus).
4. **SSE hook `useSSE.ts`** exists with reconnect-with-debounce and EventSource lifecycle handling.
5. **ErrorBoundary** at `components/common/ErrorBoundary.tsx` is correctly class-based with a reset function.
6. **Zod 4.3.6** is already a dep.
7. **date-fns 4.1.0** is already a dep.
8. **Recharts 3.8.1** is already a dep.
9. **Playwright + MSW + Vitest + Testing Library** are all already in devDeps.

### 2.3 Pain Points (what this design fixes)

| # | Pain Point | Evidence | Fix |
|---|---|---|---|
| P1 | **One god-store** for sidebar, modals, toasts, global loading. | `stores/ui-store.ts` (58 lines) has 4 concerns in 1 store. | Slice pattern: `stores/ui/sidebar.ts`, `stores/ui/toasts.ts`, etc. |
| P2 | **No URL state** for filters/sort/page. Reloading a work-package table loses state. | `WorkPackageTable` is purely `useState`. | Add `nuqs` for typed URL search params. |
| P3 | **Hooks aren't typed at the boundary** — `fetch()` casts via `res.json()` with no runtime check. | `hooks/use-work-packages.ts` `fetchWorkPackages()` returns `Promise<WorkPackage[]>` with zero validation. | Use `zod` schemas in fetch helpers; throw typed errors. |
| P4 | **No forms library** — controlled inputs + ad-hoc `useState` everywhere. | No `react-hook-form` in deps. | Add RHF + `@hookform/resolvers`. |
| P5 | **No table primitive** — custom `components/ui/Table.tsx` is plain HTML. | Sort/filter/column-resize is reinvented per feature. | Add `@tanstack/react-table` headless, pair with `@tanstack/react-virtual`. |
| P6 | **No editor framework** — Wiki uses `WikiMarkdown` with raw `unified` pipeline. | `components/wiki/WikiMarkdown.tsx` builds a renderer per render. | Adopt **Tiptap** (ProseMirror) for the rich-text layer; keep Markdown for legacy export. |
| P7 | **No type generation from Prisma** at the hook boundary. | `types/work-package` is hand-maintained. Drift risk. | `prisma generate` -> `zod-prisma-types` (or `prisma-zod-generator`) -> imported by hooks. |
| P8 | **Coarse middleware** — RBAC happens inside the page, not in middleware. | `middleware.ts` only checks JWT presence. | Add a per-route role check in `middleware.ts` + a `<RoleGate>` component for client-side defensive checks. |
| P9 | **No optimistic-update pattern** — even though `useMutation` is used, optimistic patches aren't applied. | `use-work-packages.ts` `useUpdateWorkPackage` just invalidates. | Add an `optimisticUpdate` helper used by all mutations. |
| P10 | **No skeleton/empty-state standard** — each feature reinvents. | `WorkPackageTableSkeleton.tsx`, `WorkPackageBoardSkeleton.tsx`, `WorkPackageCalendarSkeleton.tsx`, `WorkPackageGanttSkeleton.tsx` — 4 different APIs. | Standard `<Skeleton variant="..." />` + `<EmptyState />` primitives. |
| P11 | **Tests aren't colocated** — no `*.test.ts` next to source. | `__tests__/` is the only test dir. | Co-locate as `*.test.ts(x)` beside source. Update `vitest.config.ts` `include` pattern. |
| P12 | **Directory shadowing risk** — `pages/projects/[projectId]/work-packages` could conflict with `pages/work-packages`. | Currently no `pages/work-packages/` but no guard rail. | Document the rule in ESLint. |
| P13 | **No `loading.tsx` / `error.tsx`** equivalents in Pages Router. | Pages Router has no built-in route-level loading. | Adopt the `useRouter().isFallback` + custom `<PageLoading/>` + `<PageError/>` pattern documented below. |
| P14 | **`useSSE` invalidates too broadly** — `'work-packages'` invalidates *every* WP list. | `case 'work_package.updated':` does `invalidateQueries({ queryKey: ['work-packages'] })` (no second arg). | Pass `{ exact: false, predicate }` to scope the invalidation. |
| P15 | **No bundle-size budget** — `next-bundle-analyzer` is in deps but `analyze` script isn't run in CI. | `package.json` has `"analyze": "ANALYZE=true next build"`. | Add CI step + per-route budget. |

### 2.4 Risk Hotspots

- **`pages/projects/[projectId]/work-packages/`** has 5 view subdirs (board, calendar, gantt, table, query). Easy to grow into a god-page. Will become a **route group** in v2 with shared `_layout`.
- **`components/work-packages/table/`** is 8 files and growing. The table is the single most performance-critical component in the app (renders 10k+ rows on big projects). Will be a **first-class feature module** in v2.
- **`lib/exporters/`** (jspdf, xlsx, html2canvas) is ~10 MB of vendor code. Currently imported eagerly. Will be **dynamically imported** in v2.

---

## 3. Guiding Principles

1. **Feature-modular, not type-modular.** A `work-packages/` folder should contain everything WP-related — components, hooks, types, store slice, server actions, tests, docs. Deleting the feature deletes the folder.
2. **Pages are thin.** A page file should orchestrate layout, auth, and a single feature module call. No business logic in `pages/`.
3. **Server state stays on the server.** TanStack Query is the cache. Zustand never holds fetched data — only UI ephemera (sidebar collapsed, active tab, draft form values).
4. **URL is a first-class state container.** Filters, sort, pagination, active view, and selected WP live in the URL. Reload = restore.
5. **Type safety end-to-end.** `prisma generate` -> zod schema -> RHF resolver -> hook return type. If the API changes, the build breaks.
6. **Optimise for deletion, not reuse.** Prefer three small files over one shared 500-line util. Always prefer extracting a component over copy-paste.
7. **Performance is a feature.** A 60 fps work-package table and a < 3 s TTI on the project page are non-negotiable.
8. **Accessibility is a feature.** Every interactive component keyboard-navigable, ARIA-correct, contrast-checked.
9. **Migration is non-breaking.** A 92 % complete app cannot do a flag-day. The new architecture is gated behind `NEXT_PUBLIC_ARCH_V2` and adopted per route group.

---

## 4. Folder Structure Refactor

### 4.1 Target tree (target end-state)

```
openproject-rewrite/
├── prisma/
├── public/
├── scripts/
├── styles/
│
├── src/                                # ← new: all app code lives here
│   ├── app/                            # cross-cutting app shell (NOT a Next.js app dir)
│   │   ├── providers/                  # QueryProvider, ThemeProvider, ToastProvider, SessionHydration
│   │   ├── error/                      # global ErrorBoundary, error reporter
│   │   └── shell/                      # Header, Sidebar, Footer, AnnouncementBanner
│   │
│   ├── components/                     # ← primitive UI library only
│   │   ├── primitives/                 # Button, Input, Select, Modal, Tabs, … (Radix wrappers)
│   │   ├── feedback/                   # Toast, EmptyState, Skeleton, Spinner, ErrorState
│   │   ├── layout/                     # PageHeader, Card, Section, Grid, Stack, Cluster
│   │   ├── data/                       # DataTable (TanStack Table wrapper), VirtualList
│   │   ├── forms/                      # FormField, FormSection, FormError, FileDropzone
│   │   ├── editor/                     # TiptapEditor (Tiptap config)
│   │   ├── charts/                     # GanttCanvas, CalendarGrid, BarChart, LineChart
│   │   └── index.ts                    # barrel
│   │
│   ├── features/                       # ← feature modules (the new home for everything)
│   │   ├── work-packages/
│   │   │   ├── components/             # WorkPackageTable, WorkPackageBoard, GanttChart, …
│   │   │   │   ├── table/
│   │   │   │   ├── board/
│   │   │   │   ├── gantt/
│   │   │   │   ├── calendar/
│   │   │   │   ├── detail/
│   │   │   │   ├── query/
│   │   │   │   └── shared/             # WorkPackageBadge, WorkPackageStatusDot, …
│   │   │   ├── hooks/                  # useWorkPackages, useWorkPackage, useUpdateWorkPackage, …
│   │   │   ├── api/                    # client functions: getWorkPackages(), createWorkPackage(), …
│   │   │   ├── schemas/                # zod: workPackageSchema, workPackageFilterSchema, …
│   │   │   ├── types.ts                # Feature-local types (or re-exports)
│   │   │   ├── store/                  # useWorkPackageUIStore (selectedIds, draftCreate, …)
│   │   │   ├── url-state.ts            # nuqs parsers for ?status=&assignee=&page=
│   │   │   ├── permissions.ts          # can(user, 'edit', workPackage)
│   │   │   ├── index.ts                # public surface (only what pages import)
│   │   │   └── __tests__/              # colocated tests
│   │   │
│   │   ├── projects/                   # same shape
│   │   ├── members/                    # same shape
│   │   ├── notifications/
│   │   ├── search/
│   │   ├── dashboard/
│   │   ├── wiki/
│   │   ├── forums/
│   │   ├── documents/
│   │   ├── meetings/
│   │   ├── news/
│   │   ├── budgets/
│   │   ├── time-tracking/
│   │   ├── backlogs/
│   │   ├── activity/
│   │   ├── custom-fields/
│   │   ├── webhooks/
│   │   ├── groups/
│   │   ├── exports/
│   │   ├── my-page/
│   │   ├── auth/
│   │   ├── admin/
│   │   └── _shared/                    # cross-feature utilities, no business logic
│   │       ├── avatar/                 # <Avatar/> + useUser()
│   │       ├── rbac/                   # <RoleGate/> + useCan()
│   │       ├── datetime/               # <DateDisplay/> + useNow()
│   │       └── markdown/               # <MarkdownRenderer/>
│   │
│   ├── hooks/                          # ← only TRULY cross-feature hooks
│   │   ├── use-debounced-callback.ts
│   │   ├── use-media-query.ts
│   │   ├── use-previous.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-event-listener.ts
│   │   └── use-intersection.ts
│   │
│   ├── stores/                         # ← sliced global stores
│   │   ├── ui/                         # sidebar, theme, locale
│   │   │   ├── sidebar.ts
│   │   │   ├── theme.ts
│   │   │   ├── locale.ts
│   │   │   └── index.ts                # useUIStore (composed)
│   │   ├── command-palette/            # Cmd-K state
│   │   ├── realtime/                   # SSE connection state
│   │   ├── selection/                  # cross-feature bulk selection (rare)
│   │   └── index.ts
│   │
│   ├── lib/                            # ← cross-cutting infrastructure
│   │   ├── api/                        # fetch wrapper, error class, retry, interceptors
│   │   │   ├── client.ts               # apiClient() — fetch + zod parse + error normalisation
│   │   │   ├── errors.ts               # ApiError, NetworkError, ValidationError, …
│   │   │   ├── cache.ts                # query-key factory re-exports
│   │   │   └── http.ts                 # low-level helpers
│   │   ├── auth/                       # NextAuth config, hooks, helpers
│   │   ├── prisma.ts
│   │   ├── query/                      # queryClient, default options, devtools
│   │   ├── rbac/                       # permission matrix, can(), scope()
│   │   ├── sse/                        # EventSource factory with backoff
│   │   ├── sentry/
│   │   ├── utils/                      # cn(), formatBytes(), pluralise(), …
│   │   └── exporters/                  # pdf/xlsx/csv — dynamically imported
│   │
│   ├── types/                          # ← global types only
│   │   ├── api.ts                      # Paginated<T>, ApiError, …
│   │   ├── next-auth.d.ts
│   │   ├── env.d.ts
│   │   └── index.ts
│   │
│   └── test/                           # test infrastructure (moved from src/test)
│       ├── render.tsx                  # custom render with all providers
│       ├── msw/
│       ├── factories/                  # faker-based factories
│       └── setup.ts
│
├── pages/                              # ← thin pages, only orchestration
│   ├── _app.tsx                        # imports from src/app/providers
│   ├── _document.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── dashboard/
│   │   ├── global.tsx
│   │   └── widgets/                    # (if needed)
│   ├── projects/
│   │   ├── index.tsx
│   │   ├── new.tsx
│   │   └── [projectId]/
│   │       ├── _layout.tsx             # ← project-shell wrapper (NOT a Next.js file, see §8.4)
│   │       ├── index.tsx
│   │       ├── activity/
│   │       ├── board/                  # re-export of work-packages board variant
│   │       ├── gantt/
│   │       ├── calendar/
│   │       ├── work-packages/
│   │       │   ├── index.tsx           # dispatch by ?view=
│   │       │   ├── table.tsx
│   │       │   ├── board.tsx
│   │       │   ├── gantt.tsx
│   │       │   └── calendar.tsx
│   │       ├── wiki/…
│   │       ├── forums/…
│   │       ├── meetings/…
│   │       ├── news/…
│   │       ├── budgets/…
│   │       ├── members/…
│   │       └── settings.tsx
│   ├── my-page/…
│   ├── notifications/…
│   ├── settings/…
│   ├── admin/…
│   ├── help/…
│   └── api/…                            # (unchanged)
│
├── middleware.ts                       # augmented (RBAC + feature flag)
├── next.config.ts
├── tsconfig.json                       # baseUrl: "./src"
├── vitest.config.ts
├── eslint.config.mjs
└── package.json
```

### 4.2 What moves where — a worked example

**Current location:** `components/work-packages/table/WorkPackageTable.tsx`
**Current deps:** `@/hooks/use-work-packages`, `@/components/ui`, `@/types`
**New location:** `src/features/work-packages/components/table/WorkPackageTable.tsx`
**New deps:** `@/features/work-packages`, `@/components/primitives`, `@/lib/utils`

**Current location:** `hooks/use-work-packages.ts`
**New location:** `src/features/work-packages/hooks/useWorkPackages.ts` (PascalCase kebab becomes camelCase; we are changing the file-naming convention — see §4.3)

**Current location:** `types/work-package.ts` (does not exist; types are in `types/index.ts`)
**New location:** `src/features/work-packages/types.ts` and `src/features/work-packages/schemas/workPackage.ts` (zod)

### 4.3 Naming conventions inside `src/`

| Layer | Convention | Example |
|---|---|---|
| Components | PascalCase file name, default export | `WorkPackageTable.tsx` |
| Hooks | camelCase, `use` prefix | `useWorkPackages.ts` |
| API client | camelCase verb-noun | `getWorkPackages.ts` |
| Zod schemas | camelCase, `Schema` suffix | `workPackageFilterSchema.ts` |
| Stores | camelCase, `use` + `Store` suffix | `useWorkPackageUIStore.ts` |
| URL-state | `url-state.ts` | `url-state.ts` |
| Permissions | `permissions.ts` | `permissions.ts` |
| Feature index | `index.ts` (barrel) | `index.ts` |
| Tests | `*.test.ts` or `*.test.tsx` next to source | `WorkPackageTable.test.tsx` |
| Stories (if added) | `*.stories.tsx` next to source | `Button.stories.tsx` |

> We are migrating from `kebab-case.tsx` to `PascalCase.tsx` for components and `camelCase.ts` for non-components. ESLint enforces this. Codemod in §18.

### 4.4 Barrel exports and the "public surface" rule

Each feature's `index.ts` is its **public surface**. Pages may import only from the barrel. This prevents pages from reaching into `features/work-packages/components/table/WorkPackageTableRow.tsx` and creating an unmaintainable graph.

```ts
// src/features/work-packages/index.ts
export { WorkPackageTable } from './components/table/WorkPackageTable'
export { WorkPackageBoard } from './components/board/WorkPackageBoard'
export { GanttChart } from './components/gantt/GanttChart'
export { WorkPackageCalendar } from './components/calendar/WorkPackageCalendar'
export { useWorkPackages, useWorkPackage, useUpdateWorkPackage } from './hooks'
export { workPackageFilterSchema, type WorkPackageFilter } from './schemas'
export { useWorkPackageUIStore } from './store'
export { wpUrlParsers } from './url-state'
```

ESLint rule `no-restricted-imports` blocks deep imports:

```js
// eslint.config.mjs
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/features/*/components/*', '@/features/*/hooks/*', '@/features/*/store/*'],
        message: 'Import from the feature barrel: @/features/<name>',
      }],
    }],
  },
}
```

### 4.5 When to use `features/` vs `components/`

- **`components/`** = primitives that are **not tied to a business concept**. `<Button>`, `<DataTable>`, `<FormField>`, `<Toast>`. Reusable across features.
- **`features/`** = anything that **knows what a WorkPackage is**. `<WorkPackageTable>`, `useUpdateWorkPackage`, `workPackageSchema`.

The litmus test: *if I rename the business concept, do I have to rename this file?* If yes -> `features/`. If no -> `components/`.

### 4.6 Why a top-level `src/`?

- **Import hygiene.** `tsconfig.json` `baseUrl: "./src"` makes `@/components/Button` unambiguous and lets us scope ESLint to `src/`.
- **Test path stability.** `src/features/work-packages/__tests__/` and `*.test.tsx` next to source mean tests move with the file.
- **App router readiness.** If you ever migrate, `src/app/` is right there. (We are not migrating, but the escape hatch is nice.)
- **Storybook-ready.** `src/**/*.stories.tsx` is trivial to glob.

---

## 5. Component Patterns

### 5.1 Pages-Router mental model: "Server" vs "Client"

Pages Router does **not** have React Server Components. The equivalent mental model is:

| Concept | Pages Router mechanism | When to use |
|---|---|---|
| **Server-only page** | `getServerSideProps` / `getStaticProps` | Initial render needs server data (auth, SEO-critical). |
| **Hybrid page** | Page component + client sub-tree | Page shell SSR'd, heavy interactions hydrate. |
| **Pure client page** | `getLayout` only | Dashboard-y screens. No SEO. |
| **Static page** | `getStaticProps` + ISR | Help pages, marketing. |

**Rule of thumb:** in this app, *every authenticated page is a hybrid*. SSR the shell (header, sidebar, project context) and let TanStack Query hydrate the data.

### 5.2 Component tiers

We adopt a four-tier component model:

| Tier | Suffix/pattern | Knows about | Examples |
|---|---|---|---|
| **Primitive** | `Button`, `Input`, `Modal` | Nothing. Fully driven by props. | `<Button variant="primary" onClick={...} />` |
| **Composite** | `Card`, `DataTable`, `Form` | Primitive API + generic data shape. | `<DataTable<T> columns={...} data={...} />` |
| **Feature** | `WorkPackageTable`, `ProjectCard` | Composite + business logic, hooks, types. | `<WorkPackageTable projectId={id} />` |
| **Page** | `pages/projects/[projectId]/work-packages/table.tsx` | Feature + auth + layout. | The thin orchestration layer. |

**Import direction is strictly one-way:**

```
Page → Feature → Composite → Primitive
```

A primitive may never import a feature. ESLint enforces this with `no-restricted-imports`.

### 5.3 Prop conventions

#### 5.3.1 The "data + callbacks" rule

```tsx
// ❌ Bad — component fetches its own data
function ProjectCard({ projectId }: { projectId: string }) {
  const { data } = useProject(projectId)
  if (!data) return null
  return <Card>...</Card>
}

// ✅ Good — page composes fetch + render
function ProjectCard({ project }: { project: Project }) {
  return <Card>...</Card>
}

// Page:
const { data: project } = useProject(projectId)
return project ? <ProjectCard project={project} /> : <Skeleton />
```

**Why:** makes the component trivially testable (pass props, assert render) and lets the page decide loading / error / suspense strategy.

The single exception: **leaf components that wrap a single hook for ergonomics** are allowed but should be suffixed `*Connected`:

```tsx
// Acceptable shortcut
export function ProjectCardConnected({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useProject(projectId)
  if (isLoading) return <ProjectCardSkeleton />
  if (error) return <ErrorState error={error} />
  if (!data) return null
  return <ProjectCard project={data} />
}
```

#### 5.3.2 No `any`, no `unknown` leaks

Props are typed strictly. Discriminated unions for variants. No `data: any`. No `onClick: Function`. Always:

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  children: ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}
```

#### 5.3.3 Spreading props (and the `as` prop)

For polymorphic primitives, use a typed `as` prop:

```tsx
type AsProp = 'button' | 'a' | typeof Link

interface ButtonProps<T extends AsProp = 'button'> {
  as?: T
  // ...rest narrows based on T
}
```

A real implementation uses a discriminated union:

```tsx
type ButtonProps =
  | ({ as?: 'button'; onClick?: MouseEventHandler<HTMLButtonElement> } & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ as: 'a'; href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ as: typeof Link; href: string } & ComponentProps<typeof Link>)
```

For 95 % of cases, prefer `@radix-ui/react-slot` (already a dep) and the `asChild` pattern:

```tsx
<Button asChild>
  <Link href="/projects/123">Open project</Link>
</Button>
```

### 5.4 Composition patterns

#### 5.4.1 Compound components

Use for tightly-coupled UI like Tabs, Dropdown, Combobox. The Radix UI library already provides this API; we mirror it for our own:

```tsx
// src/components/primitives/EmptyState/index.tsx
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center py-12 text-center">{children}</div>
}
EmptyState.Icon = function Icon({ children }: { children: ReactNode }) { … }
EmptyState.Title = function Title({ children }: { children: ReactNode }) { … }
EmptyState.Description = function Description({ children }: { children: ReactNode }) { … }
EmptyState.Action = function Action({ children }: { children: ReactNode }) { … }
```

Usage:

```tsx
<EmptyState>
  <EmptyState.Icon><PackageIcon /></EmptyState.Icon>
  <EmptyState.Title>No work packages yet</EmptyState.Title>
  <EmptyState.Description>Create your first one to get started.</EmptyState.Description>
  <EmptyState.Action><Button onClick={openCreate}>New work package</Button></EmptyState.Action>
</EmptyState>
```

#### 5.4.2 Slot composition (Radix style)

For overriding one piece of a component:

```tsx
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Actions>
      <Button>Edit</Button>
    </Card.Actions>
  </Card.Header>
  <Card.Body>…</Card.Body>
</Card>
```

#### 5.4.3 Container / presentational split

For complex screens:

```tsx
// Container: knows about hooks, queries, mutations
function WorkPackageDetailContainer({ id }: { id: string }) {
  const { data, isLoading, error } = useWorkPackage(id)
  const { mutate: update } = useUpdateWorkPackage(id)

  if (isLoading) return <WorkPackageDetailSkeleton />
  if (error) return <ErrorState error={error} />
  if (!data) return null

  return <WorkPackageDetail workPackage={data} onUpdate={update} />
}

// Presentational: pure props in, callbacks out
function WorkPackageDetail({
  workPackage,
  onUpdate,
}: {
  workPackage: WorkPackage
  onUpdate: (patch: UpdateWorkPackageInput) => void
}) {
  return <div>…</div>
}
```

#### 5.4.4 Polymorphic `DataTable`

See §12.

### 5.5 Co-located tests, co-located stories

```tsx
// src/features/work-packages/components/table/WorkPackageTable.tsx
// src/features/work-packages/components/table/WorkPackageTable.test.tsx
// src/features/work-packages/components/table/WorkPackageTable.stories.tsx
```

`vitest.config.ts` globs `src/**/*.test.{ts,tsx}`.

---

## 6. State Management Strategy

### 6.1 The state taxonomy

| State type | Where it lives | Examples |
|---|---|---|
| **Server state** | TanStack Query cache | Work packages, projects, members, notifications |
| **URL state** | `nuqs` typed search params | Filters, sort, pagination, active view, selected WP id |
| **Form state** | `react-hook-form` | Create-WP form, login form, search box |
| **UI ephemera** | Zustand slices | Sidebar collapsed, theme, command-palette open, toast queue |
| **Component-local** | `useState` / `useReducer` | Whether a dropdown is open, a controlled input's draft value |
| **Auth state** | NextAuth `useSession` | Current user, JWT |
| **Realtime** | TanStack Query cache (mutated by SSE) | Live WP updates, live notifications |

**Rule:** *if two siblings need it, lift to URL or Zustand. If a page needs it, lift to URL. If the app needs it, Zustand. If the server owns it, TanStack Query.*

### 6.2 Server state: TanStack Query

#### 6.2.1 Query keys

We **promote `queries/queryKeys.ts` to `src/lib/query/keys.ts`** and split it into per-feature factories:

```ts
// src/lib/query/keys.ts
import type { WorkPackageFilter, ProjectId } from '@/features/work-packages'
import type { ProjectId as ProjectIdType } from '@/features/projects'

export const queryKeys = {
  workPackages: {
    all: (projectId: ProjectId) => ['work-packages', { projectId }] as const,
    list: (projectId: ProjectId, filter: WorkPackageFilter) =>
      ['work-packages', { projectId }, 'list', filter] as const,
    detail: (id: string) => ['work-packages', 'detail', id] as const,
    activities: (id: string) => ['work-packages', 'detail', id, 'activities'] as const,
    relations: (id: string) => ['work-packages', 'detail', id, 'relations'] as const,
    watchers: (id: string) => ['work-packages', 'detail', id, 'watchers'] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    list: (filter: ProjectFilter) => ['projects', 'list', filter] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    members: (id: string) => ['projects', 'detail', id, 'members'] as const,
  },
  notifications: {
    all: (userId: string) => ['notifications', { userId }] as const,
    list: (userId: string, filter: NotificationFilter) =>
      ['notifications', { userId }, 'list', filter] as const,
    unreadCount: (userId: string) => ['notifications', { userId }, 'unread-count'] as const,
  },
  // …
} as const
```

The `as const` is non-negotiable — it gives us type-safe `queryClient.invalidateQueries({ queryKey: queryKeys.workPackages.all(id) })` and the keys are *narrowed*, not stringified.

**Convention:** every factory has `all` (the broadest possible scope) and a hierarchical fan-out. To invalidate *everything* about work packages, you do `invalidateQueries({ queryKey: queryKeys.workPackages.all(id) })` and TanStack Query walks the prefix tree.

#### 6.2.2 The custom-hook pattern (one per resource)

```ts
// src/features/work-packages/hooks/useWorkPackages.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getWorkPackages } from '../api/getWorkPackages'
import { queryKeys } from '@/lib/query/keys'
import type { WorkPackageFilter } from '../types'

interface UseWorkPackagesOptions {
  projectId: string
  filter: WorkPackageFilter
  enabled?: boolean
}

export function useWorkPackages({ projectId, filter, enabled = true }: UseWorkPackagesOptions) {
  return useQuery({
    queryKey: queryKeys.workPackages.list(projectId, filter),
    queryFn: () => getWorkPackages({ projectId, filter }),
    enabled,
    placeholderData: keepPreviousData, // smooth pagination
    staleTime: 30_000,
  })
}
```

#### 6.2.3 Mutations and optimistic updates

The mutation pattern is **always** wrapped in a `useXxxMutation` hook that knows about query keys. We never call `useMutation` directly in components.

```ts
// src/features/work-packages/hooks/useUpdateWorkPackage.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateWorkPackage } from '../api/updateWorkPackage'
import { queryKeys } from '@/lib/query/keys'
import type { WorkPackage, UpdateWorkPackageInput } from '../types'
import { ApiError } from '@/lib/api/errors'

interface Variables {
  id: string
  projectId: string
  patch: UpdateWorkPackageInput
}

export function useUpdateWorkPackage() {
  const qc = useQueryClient()

  return useMutation<WorkPackage, ApiError, Variables, { previous?: WorkPackage }>({
    mutationFn: ({ id, patch }) => updateWorkPackage(id, patch),

    // Optimistic: cache the previous, apply the patch, roll back on error.
    onMutate: async ({ id, projectId, patch }) => {
      const key = queryKeys.workPackages.detail(id)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<WorkPackage>(key)
      if (previous) {
        qc.setQueryData<WorkPackage>(key, { ...previous, ...patch })
      }
      // Also patch every list that contains this WP — common for table + board views.
      qc.setQueriesData<WorkPackage[]>(
        { queryKey: queryKeys.workPackages.all(projectId) },
        (old) => old?.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)) ?? old,
      )
      return { previous }
    },

    onError: (_err, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.workPackages.detail(id), context.previous)
      }
    },

    onSettled: (_data, _err, { projectId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.workPackages.all(projectId) })
    },
  })
}
```

**Rules:**

1. **Optimistic for high-frequency, low-risk mutations** (status change, subject edit, re-order).
2. **Pessimistic for high-risk** (delete, payment, permission change).
3. **Always invalidate on `onSettled`**, even on success — server may have computed derived fields.
4. **Never use `setQueriesData` without a `predicate`** in cross-cutting invalidation.

#### 6.2.4 Prefetching

Use `queryClient.prefetchQuery` in `getServerSideProps` (SSR) or in event handlers (client). Example: hover-prefetch on a WP row.

```tsx
const queryClient = useQueryClient()
const prefetch = (id: string) =>
  queryClient.prefetchQuery({
    queryKey: queryKeys.workPackages.detail(id),
    queryFn: () => getWorkPackage(id),
    staleTime: 60_000,
  })

<WorkPackageTableRow onMouseEnter={() => prefetch(wp.id)} onFocus={() => prefetch(wp.id)} … />
```

#### 6.2.5 Suspense integration (optional)

We **do not** require Suspense for v2.0, but we *do* support it: every `useQuery` call site can be replaced with a `useSuspenseQuery` variant. The trade-off is that Suspense requires `<Suspense>` boundaries, which Pages Router handles awkwardly (no `loading.tsx`). We will revisit when migrating to App Router (if ever).

#### 6.2.6 Devtools and the QueryClient

```ts
// src/lib/query/client.ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

// Browser singleton
let browserClient: QueryClient | undefined
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient() // fresh per SSR
  if (!browserClient) browserClient = makeQueryClient()
  return browserClient
}
```

The **retry logic inspects the typed `ApiError`** — no string parsing.

### 6.3 Client state: Zustand (sliced)

#### 6.3.1 Slice pattern

Each slice is a tiny `create` call. The combined store is composed:

```ts
// src/stores/ui/sidebar.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  toggle: () => void
}

export const useSidebarStore = create<SidebarState>()(
  devtools(
    persist(
      (set) => ({
        collapsed: false,
        setCollapsed: (v) => set({ collapsed: v }),
        toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      }),
      { name: 'op.sidebar', version: 1 },
    ),
    { name: 'sidebar' },
  ),
)
```

```ts
// src/stores/ui/toasts.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>()(
  devtools(
    (set, get) => ({
      toasts: [],
      push: (t) => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
        if (t.duration !== 0) {
          setTimeout(() => get().dismiss(id), t.duration ?? 5000)
        }
        return id
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      clear: () => set({ toasts: [] }),
    }),
    { name: 'toasts' },
  ),
)
```

```ts
// src/stores/ui/index.ts
export { useSidebarStore } from './sidebar'
export { useToastStore } from './toasts'
export { useThemeStore } from './theme'
export { useCommandPaletteStore } from './command-palette'
export { useRealtimeStore } from './realtime'
```

#### 6.3.2 Why sliced, not one big store

- **Bundle splitting.** Sidebar code is only needed on layouts. Toasts are needed everywhere. Slicing lets the bundler tree-shake.
- **Selector optimisation.** `useStore(state => state.sidebarCollapsed)` only re-renders on `sidebarCollapsed` change. With 10+ fields in one store, a single mutation re-renders every consumer.
- **Testing.** Slices are independently testable. The toast slice has zero coupling to the sidebar.

#### 6.3.3 Selector optimisation

```ts
// ❌ Subscribes to the whole store, re-renders on any change
const ui = useUIStore()

// ✅ Subscribes only to `collapsed`
const collapsed = useUIStore((s) => s.sidebar.collapsed)

// ✅ Use shallow equality for objects
const { collapsed, toggle } = useUIStore(
  (s) => ({ collapsed: s.sidebar.collapsed, toggle: s.sidebar.toggle }),
  shallow,
)
```

For `useStore` calls that return *new* objects, use `useShallow` (Zustand 5):

```ts
import { useShallow } from 'zustand/react/shallow'
const { collapsed, toggle } = useStore(useShallow((s) => ({ collapsed: s.sidebar.collapsed, toggle: s.sidebar.toggle })))
```

#### 6.3.4 Persist

Only persist **user preferences**, never derived state. Persist whitelist:

- `sidebar.collapsed`
- `theme.mode`
- `locale`
- `commandPalette.recentItems`

Do **not** persist:

- Cached data (TanStack Query does that)
- Selection state (URL does that)
- Toast queue

#### 6.3.5 Devtools

All slices get `devtools` middleware in development. In production we strip it via a `process.env.NODE_ENV` check:

```ts
devtools(initializer, { name: 'sidebar', enabled: process.env.NODE_ENV !== 'production' })
```

### 6.4 URL state: `nuqs`

We adopt [`nuqs`](https://nuqs.47ng.com/) (Next.js URL state, ~3 kB) for **all filter, sort, pagination, and view state** in tables and the work-package switcher.

```ts
// src/features/work-packages/url-state.ts
import { parseAsString, parseAsArrayOf, parseAsInteger, parseAsStringEnum, createParser } from 'nuqs'

const VIEW = parseAsStringEnum(['table', 'board', 'gantt', 'calendar']).withDefault('table')
const PAGE = parseAsInteger.withDefault(1)
const PAGE_SIZE = parseAsInteger.withDefault(50)
const SORT = parseAsString.withDefault('-updatedAt') // "-field" for desc
const STATUS = parseAsArrayOf(parseAsString).withDefault([])
const ASSIGNEE = parseAsArrayOf(parseAsString).withDefault([])

export const wpUrlParsers = {
  view: VIEW,
  page: PAGE,
  pageSize: PAGE_SIZE,
  sort: SORT,
  status: STATUS,
  assignee: ASSIGNEE,
}

export type WorkPackagesUrlState = {
  [K in keyof typeof wpUrlParsers]: ReturnType<(typeof wpUrlParsers)[K]['parseServerSide']>
}
```

Usage in a page:

```tsx
// pages/projects/[projectId]/work-packages/index.tsx
import { useQueryStates } from 'nuqs'
import { wpUrlParsers } from '@/features/work-packages'

export default function WorkPackagesPage() {
  const [url, setUrl] = useQueryStates(wpUrlParsers, { history: 'push' })

  const { data, isLoading } = useWorkPackages({
    projectId,
    filter: { statusId: url.status, assigneeId: url.assignee, … },
  })

  return (
    <WorkPackageTable
      workPackages={data}
      sort={url.sort}
      page={url.page}
      onSortChange={(s) => setUrl({ sort: s })}
      onPageChange={(p) => setUrl({ page: p })}
    />
  )
}
```

**Why nuqs, not a hand-rolled `useRouter().query` parser?**

- Type-safe parsers (`parseAsInteger` -> `number`, not `string`).
- Coercion, validation, defaults — built in.
- `parseAsArrayOf(parseAsString)` for multi-select filters in a single param (`?status=open,closed`).
- SSR-aware: `parseServerSide` returns a plain object for `getServerSideProps`.

### 6.5 Form state: react-hook-form + zod

We **add** `react-hook-form` and `@hookform/resolvers`. zod is already a dep.

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { workPackageCreateSchema, type WorkPackageCreateInput } from '../schemas'

export function WorkPackageCreateForm({ projectId, onSuccess }: Props) {
  const form = useForm<WorkPackageCreateInput>({
    resolver: zodResolver(workPackageCreateSchema),
    defaultValues: { projectId, statusId: 'open' },
    mode: 'onBlur',
  })

  const { mutate, isPending } = useCreateWorkPackage()
  const onSubmit = form.handleSubmit((values) => {
    mutate(values, { onSuccess: (wp) => { onSuccess(wp); form.reset() } })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField
        label="Subject"
        error={form.formState.errors.subject?.message}
        {...form.register('subject')}
      />
      …
      <Button type="submit" isLoading={isPending}>Create</Button>
    </form>
  )
}
```

See §11 for the full pattern, including multi-step, accessible error display, and async validation.

### 6.6 The `Data` vs `UI` line

A common mistake is putting fetched data in Zustand. **Don't.** The split is:

- **Server data** -> TanStack Query (cache, dedupe, refetch, invalidation).
- **UI ephemera** -> Zustand (collapsed, selected, draft, open).
- **Cross-feature UI state** -> Zustand (command palette, notifications panel).
- **URL-shareable view state** -> `nuqs`.

---

## 7. Data Fetching Patterns

### 7.1 The "feature/api + feature/hooks" pattern

Each feature has two folders:

- `api/` — **pure async functions** that return data or throw. No React. No hooks. Easy to unit-test.
- `hooks/` — **React hooks** that wrap `useQuery` / `useMutation` and call the API.

```ts
// src/features/work-packages/api/getWorkPackages.ts
import { z } from 'zod'
import { apiClient } from '@/lib/api/client'
import { workPackageFilterSchema, type WorkPackage, type WorkPackageFilter } from '../schemas'

const workPackageListResponseSchema = z.object({
  data: z.array(workPackageSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
})

export async function getWorkPackages(params: { projectId: string; filter: WorkPackageFilter }) {
  const search = new URLSearchParams()
  search.set('projectId', params.projectId)
  // …serialise filter
  return apiClient(`/api/work-packages?${search}`, {
    schema: workPackageListResponseSchema,
  })
}
```

The `apiClient` does `fetch` + `zod parse` + error normalisation. If the response doesn't match the schema, it throws `ApiError('schema_mismatch', 200, …)`.

### 7.2 The custom-hook naming convention

| Pattern | Naming | Returns |
|---|---|---|
| **Query** (one) | `useXxx` | `{ data, isLoading, error, … }` |
| **Query** (list) | `useXxxs` | `{ data, isLoading, error, … }` |
| **Query** (infinite) | `useInfiniteXxxs` | infinite-query shape |
| **Mutation** (single) | `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx` | mutation shape |
| **Mutation** (bulk) | `useBulkUpdateXxxs` | mutation shape |
| **Suspense** | `useXxxSuspense` | `{ data }` (no `isLoading`) |

### 7.3 Error handling

The `apiClient` throws `ApiError`:

```ts
// src/lib/api/errors.ts
export type ApiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'schema_mismatch'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    public details?: unknown,
    message?: string,
  ) {
    super(message ?? code)
  }
}
```

**Three error sinks:**

1. **Mutation `onError`** -> toast.
2. **Query `error` boundary** -> `<ErrorState>` with retry.
3. **Global `QueryCache` `onError`** -> Sentry + console.

```ts
// src/lib/query/client.ts
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      Sentry.captureException(error, { tags: { queryKey: query.queryKey } })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Show generic toast for unhandled errors
      useToastStore.getState().push({
        type: 'error',
        title: 'Something went wrong',
        description: error instanceof ApiError ? error.message : 'Please try again',
      })
    },
  }),
})
```

### 7.4 Loading and error in Pages Router

Pages Router has no `loading.tsx`. The idiomatic patterns are:

#### 7.4.1 Page-level fallback with `<Suspense>` (optional, opt-in)

Pages can be wrapped in `<Suspense fallback={<PageLoading />}>` at the top of the page tree. This works for the few components that use `useSuspenseQuery`.

#### 7.4.2 Manual `isLoading` + skeleton (default)

```tsx
export default function Page() {
  const { data, isLoading, error, refetch } = useWorkPackages({ … })

  if (isLoading) return <PageLoading variant="work-packages" />
  if (error) return <PageError error={error} onRetry={refetch} />
  if (!data?.length) return <WorkPackagesEmptyState />

  return <WorkPackageTable workPackages={data} />
}
```

#### 3. Prefetch in `getServerSideProps` for above-the-fold

```ts
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const queryClient = getQueryClient()
  const projectId = ctx.params!.projectId as string
  await queryClient.prefetchQuery({
    queryKey: queryKeys.workPackages.list(projectId, defaultFilter),
    queryFn: () => getWorkPackages({ projectId, filter: defaultFilter }),
  })
  return { props: { dehydratedState: dehydrate(queryClient) } }
}
```

…and in `_app.tsx` we add `<HydrationBoundary state={pageProps.dehydratedState}>`.

### 7.5 Parallel routes — Pages Router workaround

Pages Router has no true parallel routes, but we get 80 % of the benefit by:

- **Co-locating view files** under `pages/projects/[projectId]/work-packages/{table,board,gantt,calendar}.tsx` rather than one file with a switch.
- **Using a `?view=` URL param** (via `nuqs`) so the route is shareable.
- **Using a shared `_layout.tsx`** wrapper (a normal component imported by each view file) for the project shell.

```tsx
// pages/projects/[projectId]/work-packages/table.tsx
import { ProjectWorkPackageLayout } from './_layout'
export default function TableView() {
  return <ProjectWorkPackageLayout activeView="table">{…}</ProjectWorkPackageLayout>
}
```

### 7.6 Background refetch strategies

- **Polling** for "live" views: `useWorkPackages({ …, refetchInterval: 30_000 })` for the board view.
- **SSE** for instant updates (see §10).
- **Focus refetch** disabled by default (we already do this).
- **Reconnect refetch** enabled — re-fetch on network reconnect.

---

## 8. Routing Strategy

### 8.1 Pages Router constraints we must respect

1. **No `app/` directory.** AGENTS.md is explicit.
2. **No directory shadowing.** A `pages/work-packages/` would shadow `pages/projects/[projectId]/work-packages/`. The latter wins for `/work-packages` URLs that aren't `[projectId]/...`, but it's confusing. We will not create a top-level `pages/work-packages/`.
3. **No `loading.tsx` / `error.tsx`.** Use the manual pattern from §7.4.
4. **Dynamic segments** are `[paramName]`. Catch-all is `[...slug]`. Optional catch-all is `[[...slug]]`.
5. **Parallel routes** don't exist; we use `nuqs` `?view=`.
6. **Route groups** (parentheses) don't exist; we use a `_layout.tsx` file imported by children.

### 8.2 File structure (proposed)

```
pages/
├── _app.tsx
├── _document.tsx
├── 404.tsx
├── 500.tsx
├── index.tsx
├── login.tsx
├── logout.tsx
│
├── dashboard/
│   ├── global.tsx
│   └── project/[projectId].tsx
│
├── projects/
│   ├── index.tsx
│   ├── new.tsx
│   └── [projectId]/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── activity/index.tsx
│       ├── search.tsx
│       ├── settings.tsx
│       ├── members/
│       │   ├── index.tsx
│       │   └── [userId].tsx
│       ├── work-packages/
│       │   ├── _layout.tsx
│       │   ├── index.tsx          # redirects to ?view=table
│       │   ├── table.tsx
│       │   ├── board.tsx
│       │   ├── gantt.tsx
│       │   ├── calendar.tsx
│       │   └── [id].tsx           # detail
│       ├── board/index.tsx        # legacy → redirect to /work-packages?view=board
│       ├── gantt/index.tsx        # legacy → redirect
│       ├── calendar/index.tsx     # legacy → redirect
│       ├── wiki/[...slug].tsx
│       ├── forums/
│       │   ├── index.tsx
│       │   ├── [forumId]/index.tsx
│       │   └── [forumId]/threads/[threadId].tsx
│       ├── documents/
│       │   ├── index.tsx
│       │   └── [folderId].tsx
│       ├── meetings/
│       │   ├── index.tsx
│       │   ├── [meetingId]/index.tsx
│       │   └── new.tsx
│       ├── news/
│       │   ├── index.tsx
│       │   └── [slug].tsx
│       ├── budgets/index.tsx
│       ├── backlogs/
│       │   ├── index.tsx
│       │   └── [sprintId].tsx
│       └── repository/
│           ├── index.tsx
│           └── [repoId]/
│               ├── index.tsx
│               ├── commits/[sha].tsx
│               └── tree/[...path].tsx
│
├── my-page/
│   ├── index.tsx
│   ├── account.tsx
│   └── settings.tsx
│
├── notifications/
│   ├── index.tsx
│   └── settings.tsx
│
├── settings/
│   ├── index.tsx
│   ├── profile.tsx
│   └── tokens.tsx
│
├── admin/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── announcements/…
│   ├── authentication/…
│   ├── custom-fields/…
│   ├── groups/…
│   ├── project-templates/…
│   ├── users/…
│   └── webhooks/…
│
├── help/
│   └── […slug].tsx
│
└── api/…                            # unchanged
```

### 8.3 `_layout.tsx` is a normal component

Pages Router doesn't have layouts, but you can compose them. The convention:

```tsx
// pages/projects/[projectId]/_layout.tsx
export function ProjectLayout({ projectId, active, children }: Props) {
  const { data: project } = useProject(projectId)
  if (!project) return <PageLoading />
  return (
    <ProjectContext.Provider value={{ project }}>
      <ProjectHeader project={project} active={active} />
      <ProjectSidebar project={project} active={active} />
      <main>{children}</main>
    </ProjectContext.Provider>
  )
}
```

Each child page imports and uses it:

```tsx
// pages/projects/[projectId]/work-packages/table.tsx
import { ProjectLayout } from '../_layout'
export default function Page() {
  return (
    <ProjectLayout projectId={…} active="work-packages">
      <WorkPackagesTableView />
    </ProjectLayout>
  )
}
```

This is a slight DX cost (one extra import per page) but it gives us:

- **Shared data fetching** (the layout fetches `useProject` once; children read from context).
- **Shared error/loading boundaries** (the layout renders `<ErrorBoundary>`).
- **Clear ownership** of nav, breadcrumbs, etc.

### 8.4 Middleware-based guards

Augment `middleware.ts` with RBAC:

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { match as matchPath } from 'path-to-regexp'   // or a tiny custom matcher

const ROUTE_RULES: Array<{ pattern: RegExp; requires: string[] }> = [
  { pattern: /^\/admin(\/|$)/,                   requires: ['system:admin'] },
  { pattern: /^\/projects\/[^/]+\/settings(\/|$)/, requires: ['project:admin'] },
  { pattern: /^\/projects\/[^/]+\/budgets(\/|$)/,  requires: ['project:view_budgets'] },
  // …
]

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname

  // Public routes
  if (path === '/login' || path.startsWith('/api/auth') || path.startsWith('/help') || path === '/') {
    if (path === '/login' && token) return NextResponse.redirect(new URL('/dashboard', req.url))
    return NextResponse.next()
  }

  if (!token) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', path)
    return NextResponse.redirect(url)
  }

  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(path)) {
      const has = rule.requires.every((p) => (token.permissions as string[]).includes(p))
      if (!has) return NextResponse.redirect(new URL('/403', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
```

The token's `permissions` claim is set in the NextAuth `jwt` callback by reading the user's role memberships. Currently the JWT is thin; we'll add a `permissions: string[]` claim during the migration.

### 8.5 `<RoleGate>` for client-side defensive rendering

```tsx
// src/features/_shared/rbac/RoleGate.tsx
import { useSession } from 'next-auth/react'
import type { ReactNode } from 'react'

interface RoleGateProps {
  permission: string | string[]
  fallback?: ReactNode
  children: ReactNode
}

export function RoleGate({ permission, fallback = null, children }: RoleGateProps) {
  const { data } = useSession()
  const required = Array.isArray(permission) ? permission : [permission]
  const perms = (data?.user as any)?.permissions as string[] | undefined
  const has = perms?.some((p) => required.includes(p)) ?? false
  return has ? <>{children}</> : <>{fallback}</>
}
```

This is **defence in depth**, not the primary check. Middleware enforces the route; `<RoleGate>` hides a button the user can't use.

### 8.6 Route transitions

Pages Router has no built-in transition. We add a thin top-bar progress indicator:

```tsx
// src/app/shell/TopProgressBar.tsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export function TopProgressBar() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const start = () => setLoading(true)
    const end = () => setLoading(false)
    router.events.on('routeChangeStart', start)
    router.events.on('routeChangeComplete', end)
    router.events.on('routeChangeError', end)
    return () => {
      router.events.off('routeChangeStart', start)
      router.events.off('routeChangeComplete', end)
      router.events.off('routeChangeError', end)
    }
  }, [router])
  if (!loading) return null
  return <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary animate-pulse z-50" />
}
```

For nicer transitions, we evaluate [`next-transition-router`](https://github.com/ismailbentab/next-transition-router) in a spike.

### 8.7 `403.tsx` and `404.tsx`

```tsx
// pages/403.tsx
export default function ForbiddenPage() {
  return (
    <EmptyState>
      <EmptyState.Icon><LockIcon /></EmptyState.Icon>
      <EmptyState.Title>You don't have access</EmptyState.Title>
      <EmptyState.Description>Ask a project admin to grant you access.</EmptyState.Description>
      <EmptyState.Action><Button asChild><Link href="/dashboard">Go to dashboard</Link></Button></EmptyState.Action>
    </EmptyState>
  )
}
```

---

## 9. Performance Optimization

### 9.1 Performance budget

| Metric | Target (project page) | Target (WP table, 10k rows) |
|---|---|---|
| LCP | < 2.0 s (p75) | < 1.5 s |
| INP | < 200 ms | < 100 ms (drag) |
| TTI | < 3.0 s | < 2.0 s |
| JS shipped (gzip) | < 180 kB initial | < 250 kB for WP table route |
| Largest single chunk | < 100 kB | < 80 kB |

These are enforced in CI via `next-bundle-analyzer` and a per-route budget script.

### 9.2 Code splitting

#### 9.2.1 Route-level (automatic)

Next.js code-splits every page automatically. We just have to not import everything eagerly in `_app.tsx`.

#### 9.2.2 Component-level (manual)

Use `next/dynamic` for heavy components:

```tsx
// pages/projects/[projectId]/work-packages/gantt.tsx
import dynamic from 'next/dynamic'
import { PageLoading } from '@/components/feedback'

const GanttChart = dynamic(
  () => import('@/features/work-packages/components/gantt/GanttChart').then((m) => m.GanttChart),
  { loading: () => <PageLoading variant="gantt" />, ssr: false },
)
```

`ssr: false` is required for components that touch `window` (Gantt, Calendar, drag layers).

#### 9.2.3 Vendor split

`next.config.ts`:

```ts
experimental: {
  optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-dialog', 'recharts'],
},
```

This tree-shakes icon and date utilities.

### 9.3 Bundle analysis

`npm run analyze` is already wired. We add a CI step that:

1. Runs `ANALYZE=true next build`.
2. Uploads `.next/analyze/client.html` as a build artefact.
3. Compares against the previous main's bundle and fails on > 10 % regression in any chunk.

### 9.4 React rendering optimisations

#### 9.4.1 The memoisation matrix

| Tool | When | When not |
|---|---|---|
| `React.memo` | Pure presentational component with stable props, expensive render. | Receives object/array props that change identity each render. |
| `useMemo` | Computing derived data from props/state. Recurring reflows. | Cheap calculations (`a + b`). |
| `useCallback` | Callback passed to a `React.memo`d child or as a `useEffect` dep. | Local event handlers. |

**Default rule:** don't memoise. Measure. Memoise if `React DevTools Profiler` shows a real cost. Our ESLint config will *warn* on `useMemo` / `useCallback` with an inline directive comment required:

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: id-only dep
useCallback(…, [id])
```

#### 9.4.2 Splitting work-packages table render

The table is the most expensive component. Strategies:

- **`useDeferredValue`** for the search input — defers non-urgent re-renders.
- **`startTransition`** for sort/filter changes.
- **Row-level `React.memo`** keyed on `wp.id + wp.updatedAt`. Cheap; safe because TanStack Query gives stable references when nothing changed.
- **Column virtualisation** (we have 30+ columns on some projects) via `@tanstack/react-virtual` *and* row virtualisation together.
- **Sticky header** via CSS `position: sticky`.

```tsx
const deferredSearch = useDeferredValue(search)
const workPackages = useMemo(
  () => filterAndSort(allWorkPackages, { ...filter, search: deferredSearch }),
  [allWorkPackages, filter, deferredSearch],
)
```

### 9.5 Virtual scrolling

We already have `@tanstack/react-virtual`. We use it for:

- Work-package table rows.
- Notification list.
- Member list (large projects).
- Forum thread list.
- Repository file tree.
- Activity feed.

The pattern:

```tsx
const parentRef = useRef<HTMLDivElement>(null)
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 10,
})
```

For variable-height rows (activity feed), pass `measureElement`:

```tsx
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 5,
  measureElement: (el) => el.getBoundingClientRect().height,
})
```

### 9.6 Image optimisation

`next/image` everywhere. Custom loader for S3-backed attachments:

```tsx
// next.config.ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.s3.amazonaws.com' },
    { protocol: 'https', hostname: 'cdn.openproject.example' },
  ],
}
```

Avatar component:

```tsx
<Image
  src={user.avatarUrl ?? '/default-avatar.svg'}
  alt={user.name}
  width={32}
  height={32}
  className="rounded-full"
/>
```

### 9.7 Font optimisation

`next/font/google`:

```tsx
// src/app/providers/AppFonts.tsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })

export function AppFonts({ children }: { children: ReactNode }) {
  return <div className={inter.variable}>{children}</div>
}
```

### 9.8 Web Vitals reporting

`pages/_app.tsx` reports to Sentry:

```tsx
export function reportWebVitals(metric: NextWebVitalsMetric) {
  Sentry.getCurrentHub().getClient()?.captureMessage(`web-vital:${metric.name}`, {
    level: 'info',
    extra: { value: metric.value, id: metric.id, label: metric.label },
  })
}
```

---

## 10. Realtime Architecture

### 10.1 Current state

- `useSSE.ts` (61 lines) opens an `EventSource` to `/api/sse?userId=…` and invalidates queries on `work_package.updated`, `work_package.created`, `notification.new`.
- **Pain:** invalidation is too broad and the hook does not deduplicate events.

### 10.2 v2 design

#### 10.2.1 Event envelope

```ts
// src/lib/sse/events.ts
import { z } from 'zod'

export const sseEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('connected'), userId: z.string(), at: z.number() }),
  z.object({ type: z.literal('work_package.updated'), projectId: z.string(), id: z.string(), patch: z.unknown(), at: z.number() }),
  z.object({ type: z.literal('work_package.created'), projectId: z.string(), id: z.string(), at: z.number() }),
  z.object({ type: z.literal('work_package.deleted'), projectId: z.string(), id: z.string(), at: z.number() }),
  z.object({ type: z.literal('notification.new'), userId: z.string(), id: z.string(), at: z.number() }),
  z.object({ type: z.literal('activity.new'), projectId: z.string(), id: z.string(), at: z.number() }),
  z.object({ type: z.literal('ping'), at: z.number() }),
])
export type SseEvent = z.infer<typeof sseEventSchema>
```

#### 10.2.2 EventSource factory with backoff

```ts
// src/lib/sse/client.ts
import { sseEventSchema, type SseEvent } from './events'

export function connectSse(opts: {
  userId: string
  onEvent: (event: SseEvent) => void
  onError?: (error: Event) => void
}): () => void {
  let stopped = false
  let attempt = 0
  let es: EventSource | null = null

  const open = () => {
    if (stopped) return
    es = new EventSource(`/api/sse?userId=${opts.userId}`)
    es.onmessage = (e) => {
      attempt = 0
      const parsed = sseEventSchema.safeParse(JSON.parse(e.data))
      if (parsed.success) opts.onEvent(parsed.data)
    }
    es.onerror = (e) => {
      opts.onError?.(e)
      es?.close()
      if (stopped) return
      const delay = Math.min(30_000, 1000 * 2 ** attempt++)
      setTimeout(open, delay)
    }
  }
  open()

  return () => {
    stopped = true
    es?.close()
  }
}
```

#### 10.2.3 React glue

```ts
// src/stores/realtime/index.ts
import { useEffect } from 'react'
import { connectSse } from '@/lib/sse/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { queryKeys } from '@/lib/query/keys'

export function useRealtimeConnection() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return
    return connectSse({
      userId,
      onEvent: (e) => {
        switch (e.type) {
          case 'work_package.updated': {
            // Targeted patch: avoid invalidating every list.
            const key = queryKeys.workPackages.detail(e.id)
            qc.setQueryData(key, (old: any) => (old ? { ...old, ...e.patch } : old))
            // Invalidate the *list* that contains it (one project only)
            qc.invalidateQueries({ queryKey: queryKeys.workPackages.all(e.projectId) })
            break
          }
          case 'work_package.created':
            qc.invalidateQueries({ queryKey: queryKeys.workPackages.all(e.projectId) })
            break
          case 'notification.new':
            qc.invalidateQueries({ queryKey: queryKeys.notifications.all(userId) })
            break
          // …
        }
      },
    })
  }, [userId, qc])
}
```

This is **mounted once at the layout level** (in `_app.tsx`), not per page.

#### 10.2.4 Optimistic concurrency

Work-package updates must respect server `updatedAt`. Pattern:

```ts
// API
PATCH /api/work-packages/:id
If-Match: <updatedAt-iso>   // optional but recommended

// Client
const { mutate } = useUpdateWorkPackage()
// On error code='conflict', refetch and show "this WP was updated by X; reload?"
```

Hook handles the conflict:

```ts
onError: (err, vars, ctx) => {
  if (err instanceof ApiError && err.code === 'conflict') {
    useConflictStore.getState().push({ id: vars.id, mine: ctx?.previous, theirs: err.details })
  }
}
```

#### 10.2.5 WebSocket — when to consider it

SSE is **fine** for one-way server→client fan-out (our use case). WebSocket buys us:

- True bidirectional (e.g. collaborative editing of a description).
- Lower per-message overhead.
- Binary frames.

**Trigger to migrate:** collaborative WP description editing, real-time presence cursors. Estimated cost: replace `EventSource` with `WebSocket` in `connectSse`, no API change required (Next.js `Response` with `ReadableStream` works for both). Defer to v3.

---

## 11. Forms

### 11.1 The standard

`react-hook-form` + `zod` + `@hookform/resolvers/zod` + `<FormField>` primitive.

### 11.2 Schema location

Schemas live in `src/features/<feature>/schemas/`. They are the single source of truth for:

- The hook return type.
- The RHF resolver.
- The API client payload validation.
- OpenAPI generation (future).

```ts
// src/features/work-packages/schemas/workPackage.ts
import { z } from 'zod'

export const workPackageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().nullable().optional(),
  statusId: z.string().min(1),
  typeId: z.string().min(1),
  priorityId: z.string().min(1),
  assigneeId: z.string().nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type WorkPackage = z.infer<typeof workPackageSchema>

export const workPackageFilterSchema = z.object({
  projectId: z.string().optional(),
  statusId: z.array(z.string()).optional(),
  typeId: z.array(z.string()).optional(),
  assigneeId: z.array(z.string()).optional(),
  priorityId: z.array(z.string()).optional(),
  search: z.string().optional(),
  startDate: z.object({ gte: z.iso.date().optional(), lte: z.iso.date().optional() }).optional(),
  dueDate: z.object({ gte: z.iso.date().optional(), lte: z.iso.date().optional() }).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sort: z.string().default('-updatedAt'),
})

export type WorkPackageFilter = z.infer<typeof workPackageFilterSchema>

export const workPackageCreateSchema = workPackageSchema
  .pick({
    projectId: true,
    subject: true,
    description: true,
    statusId: true,
    typeId: true,
    priorityId: true,
    assigneeId: true,
    startDate: true,
    dueDate: true,
    estimatedHours: true,
  })
  .extend({ parentId: z.string().optional() })

export type WorkPackageCreateInput = z.infer<typeof workPackageCreateSchema>

export const workPackageUpdateSchema = workPackageCreateSchema.partial()
export type WorkPackageUpdateInput = z.infer<typeof workPackageUpdateSchema>
```

### 11.3 The `<FormField>` primitive

```tsx
// src/components/forms/FormField.tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/primitives/Label'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  name: string
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, hint, error, required, className, id, ...rest }, ref) => {
    const inputId = id ?? `field-${rest.name}`
    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>
          {label}
          {required && <span aria-hidden className="text-red-500 ml-0.5">*</span>}
        </Label>
        <input
          id={inputId}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-required={required}
          className={cn(
            'w-full rounded-md border border-gray-300 px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
            'disabled:opacity-50',
            error && 'border-red-500',
            className,
          )}
          {...rest}
        />
        {hint && !error && <p id={`${inputId}-hint`} className="text-xs text-gray-500">{hint}</p>}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  },
)
FormField.displayName = 'FormField'
```

A complete form:

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { workPackageCreateSchema, type WorkPackageCreateInput } from '../schemas'
import { useCreateWorkPackage } from '../hooks/useCreateWorkPackage'
import { FormField, FormSection, FormError } from '@/components/forms'
import { Button } from '@/components/primitives'

export function WorkPackageCreateForm({ projectId, onSuccess }: Props) {
  const form = useForm<WorkPackageCreateInput>({
    resolver: zodResolver(workPackageCreateSchema),
    defaultValues: { projectId, statusId: 'open', typeId: 'task', priorityId: 'normal' },
    mode: 'onBlur',
  })

  const create = useCreateWorkPackage()

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        create.mutate(values, { onSuccess: (wp) => { onSuccess(wp); form.reset() } }),
      )}
      noValidate
      className="space-y-6"
    >
      <FormSection title="Details">
        <FormField label="Subject" required error={form.formState.errors.subject?.message} {...form.register('subject')} />
        <Textarea label="Description" {...form.register('description')} />
        <FormField label="Estimated hours" type="number" {...form.register('estimatedHours', { valueAsNumber: true })} />
      </FormSection>

      <FormSection title="Assignment">
        <FormField label="Assignee" {...form.register('assigneeId')} />
      </FormSection>

      {create.error && <FormError error={create.error} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => form.reset()}>Reset</Button>
        <Button type="submit" isLoading={create.isPending}>Create work package</Button>
      </div>
    </form>
  )
}
```

### 11.4 Multi-step forms

Use `useFormContext` + a tiny step state in Zustand or `useState`. Steps are *not* nested forms; one form, one schema, conditional fields.

```tsx
const STEPS = ['Details', 'Assignment', 'Review'] as const
const [step, setStep] = useState(0)
const values = form.watch()

const canAdvance = await form.trigger(fieldsForStep[step])
if (canAdvance) setStep((s) => s + 1)
```

### 11.5 Async validation

RHF supports async resolvers. Common cases:

- "Project identifier must be unique" -> debounced `z.string().refine(check, …)`.
- "Email not registered" -> async refiner in the schema.

```ts
const signupSchema = z.object({
  email: z.string().email().refine(checkEmailAvailable, 'Email already in use'),
})
```

Pair with `mode: 'onChange'` and a debounce wrapper from `use-debounce`.

### 11.6 Form-level error reporting

```tsx
{create.isError && (
  <FormError
    error={create.error}
    onRetry={() => create.reset()}
  />
)}
```

`<FormError>` shows a red box, the human message from the API, and a Retry button if the error is retryable.

---

## 12. Tables

### 12.1 Decision: TanStack Table headless

We **add `@tanstack/react-table`** (v8) and pair it with `@tanstack/react-virtual` (already a dep). Custom tables grow into 500-line monsters; TanStack Table gives us:

- Headless (we control the markup).
- Sort, multi-sort, filter, column resize, column visibility, column reorder, row selection, pagination.
- 100 % TypeScript generics.
- Composable with our existing virtualisation.

### 12.2 Wrapper primitive

```tsx
// src/components/data/DataTable.tsx
import { flexRender, type Table as TanStackTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  table: TanStackTable<T>
  estimateSize?: () => number
  overscan?: number
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
}

export function DataTable<T>({ table, estimateSize = () => 48, overscan = 10, emptyState, onRowClick }: DataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  })

  if (rows.length === 0) return <>{emptyState}</>

  return (
    <div ref={parentRef} className="h-full overflow-auto" role="table" aria-rowcount={rows.length}>
      <table className="w-full text-sm" style={{ width: table.getCenterTotalSize() }}>
        <thead className="sticky top-0 bg-white z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} style={{ width: h.getSize() }} role="columnheader">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                data-index={vi.index}
                ref={(el) => el && virtualizer.measureElement(el)}
                style={{
                  transform: `translateY(${vi.start}px)`,
                  position: 'absolute',
                  width: '100%',
                  display: 'table',
                  tableLayout: 'fixed',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ width: cell.column.getSize() }} role="cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

### 12.3 Column definitions

```ts
// src/features/work-packages/components/table/columns.tsx
import { createColumnHelper } from '@tanstack/react-table'
import type { WorkPackage } from '../../schemas'

const ch = createColumnHelper<WorkPackage>()

export const workPackageColumns = [
  ch.display({
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  }),
  ch.accessor('subject', {
    header: 'Subject',
    cell: (info) => <Link href={`/work-packages/${info.row.original.id}`}>{info.getValue()}</Link>,
  }),
  ch.accessor((row) => row.status.name, { id: 'status', header: 'Status', cell: (info) => <StatusBadge status={info.getValue()} /> }),
  ch.accessor('assignee.name', { id: 'assignee', header: 'Assignee', cell: (info) => <UserCell user={info.row.original.assignee} /> }),
  ch.accessor('dueDate', { id: 'dueDate', header: 'Due', cell: (info) => <DateDisplay value={info.getValue()} /> }),
  // …
]
```

### 12.4 Sorting and filtering

TanStack Table handles it. We bind the column state to `nuqs`:

```ts
const [sorting, setSorting] = useState<SortingState>([])
useEffect(() => {
  const flat = sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(',')
  setUrl({ sort: flat || '-updatedAt' })
}, [sorting])
```

Filtering is column-defined (built-in) plus a global search box:

```ts
const [globalFilter, setGlobalFilter] = useState('')
```

### 12.5 Column resize

`<th>` gets a `ResizeHandle` that calls `header.getResizeHandler()`. Persist the column sizes in localStorage per user (Zustand `persist`).

### 12.6 Server-side vs client-side mode

- **< 5 000 rows:** client-side. Filter and sort in `useMemo`.
- **> 5 000 rows:** server-side. Push filters/sort/page to the API; TanStack Table just renders.

The decision is a per-table constant in `features/<x>/table-config.ts`.

---

## 13. Charts, Gantt & Calendar

### 13.1 Charts (Recharts — already a dep)

Recharts is fine for **simple bar/line/pie** (budget reports, burndown). For complex needs (gantt, calendar) we go custom (canvas or SVG).

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export function BudgetBarChart({ data }: { data: BudgetDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="spent" fill="var(--color-primary)" />
        <Bar dataKey="planned" fill="var(--color-muted)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

`recharts` is **dynamically imported** wherever used (`dynamic(() => import(...), { ssr: false })`).

### 13.2 Gantt

The current `components/work-packages/gantt/GanttChart.tsx` is a pure-SVG custom component. We **keep it custom** — Recharts has no Gantt primitive and Visx is overkill. But we:

- **Refactor** to a `src/features/work-packages/components/gantt/` feature module.
- **Add a Canvas render path** for projects with > 2 000 WPs (SVG slows down).
- **Add keyboard navigation** (arrow keys to move between bars, Tab to enter a bar, Enter to open).
- **Add dependency lines** as a separate `<GanttDependencyLines>` overlay (already a separate file — good).
- **Add zoom levels** (day, week, month, quarter) — already partly done via `GanttZoomControls`.

### 13.3 Calendar

Custom SVG grid (the current `WorkPackageCalendarGrid.tsx`). Keep custom; add:

- **Drag-to-create** WP on a day.
- **Drag-to-reschedule** WP across days.
- **All-day / timed events** distinction.
- **Month / week / day** views (currently only month).

### 13.4 Reports

Burndown (`backlogs/BurndownChart.tsx`) is Recharts. We keep it, and **add** a reports page (`/projects/[id]/reports`) that composes:

- Velocity chart
- Cumulative flow diagram
- Lead/cycle time histogram
- Budget vs actual (bar)
- Status distribution (pie/donut)

All Recharts; all dynamic-imported.

---

## 14. Rich-Text Editor

### 14.1 Decision: Tiptap

We **adopt Tiptap v2** (ProseMirror-based) for:

- Wiki page body
- Forum post body
- News article body
- Document description
- Work-package description
- Comments

Why Tiptap, not Lexical:

- Tiptap is **headless** (we own the markup, just like Radix).
- Tiptap is **mature** for collaborative editing (Yjs integration).
- Tiptap's extension model maps cleanly to our feature modules.
- Lexical is great but its Meta-only history and less mature extension ecosystem make it a risk for a 12-month project.

### 14.2 The shared editor

```tsx
// src/components/editor/RichTextEditor.tsx
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Markdown } from '@/components/editor/extensions/Markdown'
import { Mention } from '@/components/editor/extensions/Mention'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
  onUpload?: (file: File) => Promise<string> // returns URL
}

export function RichTextEditor({ value, onChange, placeholder, editable = true, onUpload }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
      Image.configure({ inline: false, allowBase64: false }),
      Markdown,
      Mention,
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  return <EditorContent editor={editor} className="prose prose-sm max-w-none" />
}
```

### 14.3 Markdown import/export

Wiki pages today are stored as Markdown. We **add** a `Markdown` Tiptap extension (built on `tiptap-markdown`) that:

- Parses incoming Markdown to ProseMirror state on load.
- Serialises back to Markdown on save (so storage format is unchanged).

### 14.4 Toolbar

A separate `<RichTextToolbar editor={editor} />` component, itself a compound:

```tsx
<RichTextToolbar editor={editor}>
  <RichTextToolbar.Group>
    <RichTextToolbar.Bold />
    <RichTextToolbar.Italic />
    <RichTextToolbar.Code />
  </RichTextToolbar.Group>
  <RichTextToolbar.Group>
    <RichTextToolbar.H1 />
    <RichTextToolbar.H2 />
  </RichTextToolbar.Group>
  <RichTextToolbar.Group>
    <RichTextToolbar.Link />
    <RichTextToolbar.Image onUpload={onUpload} />
  </RichTextToolbar.Group>
  <RichTextToolbar.Group>
    <RichTextToolbar.Mention />
  </RichTextToolbar.Group>
</RichTextToolbar>
```

### 14.5 Sanitisation

`@tiptap/html` is XSS-safe by design (ProseMirror schema rejects unknown nodes). For server-side sanitisation on read we use `isomorphic-dompurify` (already a dep) with a tight allowlist.

### 14.6 Collaboration (v3)

Tiptap + Yjs + Hocuspocus. Defer to v3 unless the team pulls it in earlier. The `Yjs` extension is `y-prosemirror` + `y-websocket`.

---

## 15. TypeScript Strict Mode Strategy

### 15.1 Current state

`tsconfig.json` likely has `strict: true` already (Next 15 default). We **enable everything**:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess` is the big one — it forces `arr[0]` to be `T | undefined`, eliminating a class of bugs.

`exactOptionalPropertyTypes` is contentious; we will pilot in `src/features/work-packages/` first.

### 15.2 Type pipeline

```
prisma/schema.prisma
  → prisma generate
  → prisma-zod-generator (or handwritten zod for hot paths)
  → @/features/<x>/schemas/
  → @hookform/resolvers/zod (forms)
  → apiClient schema parse (API boundary)
  → useQuery return type
```

We **add** `prisma-zod-generator` (or equivalent) so every Prisma model has a Zod schema. This means:

- API route handlers validate input with `workPackageCreateSchema.parse(req.body)`.
- The same schema is the RHF resolver.
- The same schema is the `apiClient` parser.

One schema, three uses. Drift is impossible.

### 15.3 ESLint configuration

```js
// eslint.config.mjs (Next 15 flat config)
import next from 'eslint-config-next'

export default [
  …next,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { patterns: […] }], // see §4.4
      'react/jsx-key': 'error',
      'react/self-closing-comp': 'error',
    },
  },
]
```

`any` requires an inline disable with a comment justifying the use.

### 15.4 Type tests

For complex types (e.g. `QueryKeys` inference, RHF `SubmitHandler` inference), we add `expectTypeOf` from `expect-type`:

```ts
// src/features/work-packages/__tests__/types.test.ts
import { expectTypeOf } from 'expect-type'
import type { useWorkPackages } from '../hooks/useWorkPackages'

test('useWorkPackages returns paginated data', () => {
  expectTypeOf(useWorkPackages).parameter(0).toMatchTypeOf<{ projectId: string; filter: WorkPackageFilter }>()
})
```

`expect-type` is dev-only, no bundle impact.

---

## 16. Testing Strategy

### 16.1 The pyramid

| Layer | Tool | Coverage target |
|---|---|---|
| **Unit (pure functions)** | Vitest | 80 % of `lib/`, `features/*/api`, `features/*/schemas` |
| **Component (presentational)** | Vitest + RTL | Every primitive; every feature card |
| **Hook (logic)** | Vitest + `@testing-library/react` `renderHook` | Every custom hook |
| **Integration (page)** | Vitest + RTL + MSW | Smoke test for every page |
| **E2E** | Playwright | Critical paths: login, create WP, drag on board, edit wiki |
| **Visual regression** | (Chromatic / Percy) — not in v2 | Defer to v3 |

### 16.2 Vitest configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,stories}.{ts,tsx}', 'src/test/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

### 16.3 Custom render with all providers

```tsx
// src/test/render.tsx
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function renderWithProviders(ui: ReactNode, options?: RenderOptions): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <SessionProvider session={null}>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </SessionProvider>,
    options,
  )
}

export * from '@testing-library/react'
export { renderWithProviders as render }
```

### 16.4 Hook tests

```ts
// src/features/work-packages/__tests__/useWorkPackages.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { renderWithProviders } from '@/test/render'
import { useWorkPackages } from '../hooks/useWorkPackages'

const server = setupServer(
  rest.get('/api/work-packages', (req, res, ctx) => {
    return res(ctx.json({ data: [{ id: '1', subject: 'A', … }], meta: { total: 1, page: 1, pageSize: 50 } }))
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('returns parsed work packages', async () => {
  const { result } = renderHook(() => useWorkPackages({ projectId: 'p1', filter: {} as any }), { wrapper: renderWithProviders(…).wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.data).toHaveLength(1)
})
```

### 16.5 E2E with Playwright

`playwright.config.ts`:

```ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: { command: 'npm run build && npm start', port: 3000, reuseExistingServer: !process.env.CI },
})
```

Critical E2E:

- `auth.spec.ts` — login, 2FA, logout
- `work-package.spec.ts` — create, edit, delete
- `board.spec.ts` — drag a card across columns
- `gantt.spec.ts` — open, zoom, drag a bar
- `wiki.spec.ts` — create page, edit, save
- `notifications.spec.ts` — mark as read, mark all as read

### 16.6 MSW handlers per feature

```ts
// src/features/work-packages/__tests__/msw.ts
import { rest } from 'msw'

export const wpHandlers = [
  rest.get('/api/work-packages', (req, res, ctx) => res(ctx.json({ data: [], meta: { total: 0, page: 1, pageSize: 50 } }))),
  rest.post('/api/work-packages', async (req, res, ctx) => {
    const body = await req.json()
    return res(ctx.status(201), ctx.json({ id: 'new', …body }))
  }),
  // …
]
```

Compose in test setup:

```ts
import { wpHandlers } from '@/features/work-packages/__tests__/msw'
import { projectHandlers } from '@/features/projects/__tests__/msw'
server.use(...wpHandlers, ...projectHandlers)
```

---

## 17. Dependency Recommendations

### 17.1 New runtime dependencies

| Package | Why | Version target |
|---|---|---|
| `react-hook-form` | Form state. | ^7.54 |
| `@hookform/resolvers` | Zod resolver glue. | ^3.10 |
| `@tanstack/react-table` | Headless table primitive. | ^8.21 |
| `nuqs` | Typed URL state. | ^2.4 |
| `@tiptap/react` | Rich-text editor. | ^2.10 |
| `@tiptap/starter-kit` | Tiptap defaults. | ^2.10 |
| `@tiptap/extension-link` | Links. | ^2.10 |
| `@tiptap/extension-placeholder` | Placeholder. | ^2.10 |
| `@tiptap/extension-image` | Image upload. | ^2.10 |
| `tiptap-markdown` | Markdown import/export. | ^0.8 |
| `expect-type` | Type assertions. (dev) | ^0.20 |
| `prisma-zod-generator` | Prisma -> zod codegen. (dev) | ^1.x |
| `use-debounce` | Debounce search inputs. | ^10.0 |
| `cmdk` | Command palette UI. | ^1.0 |
| `vaul` | Drawer (mobile bottom sheet). | ^1.1 |
| `react-day-picker` | Date-range picker for filters. | ^9.4 |
| `react-dropzone` | File dropzone for upload dialogs. | ^14.3 |
| `next-themes` | Theme switching. | ^0.4 |
| `zod-prisma-types` (alt) | Alternative to `prisma-zod-generator`. | ^3.2 |

### 17.2 New dev dependencies

| Package | Why |
|---|---|
| `eslint-plugin-no-barrel-files` | (Or `eslint-plugin-import` rules) Prevent deep barrel abuse. |
| `eslint-plugin-react-hooks` | Already a transitive dep; pin to ^5.x. |
| `eslint-plugin-tailwindcss` | Tailwind v4 class lint. |
| `@axe-core/react` | Runtime a11y checks in dev. |
| `vitest-browser-react` (eval) | Real-browser Vitest. |
| `c8` (or v8) | Coverage. |

### 17.3 Bump targets

| Package | Current | Target | Reason |
|---|---|---|---|
| `next-auth` | ^4.24.14 | **^5 (beta)** | AGENTS.md says v5. The current code uses `getToken` which is v4 API; v5 has `auth()` that works in middleware. Migrate carefully. |
| `next` | 15.5.15 | latest 15.x patch | Security + turbopack improvements. |
| `react` | 19.1.0 | latest 19.x | None urgent. |
| `recharts` | ^3.8.1 | latest | Recharts 3 is fine. |
| `date-fns` | ^4.1.0 | latest | None. |
| `zod` | ^4.3.6 | latest | None. |
| `lucide-react` | ^1.14.0 | **^0.469+** | **1.x doesn't exist as a real version of lucide-react; verify this is not a typo.** Investigate. |

> **Heads up:** `lucide-react@^1.14.0` looks suspicious — lucide-react's published versions are 0.x. This is either a fork or a typo. **Verify** in the next sprint. If it's wrong, replace with `lucide-react@^0.469.0`.

### 17.4 Bundle-size impact estimate

| Package | Approx gzip | Notes |
|---|---:|---|
| `react-hook-form` | 8 kB | Tiny. |
| `@tanstack/react-table` | 12 kB | Headless. |
| `nuqs` | 3 kB | Tiny. |
| `@tiptap/react` + StarterKit | 60 kB | Larger but lazy-loaded. |
| `react-day-picker` | 10 kB | Lazy. |
| `cmdk` | 8 kB | Lazy (only on Cmd-K). |
| **Total** | **~100 kB** | Acceptable. |

---

## 18. Migration Plan

### 18.1 Strategy: strangler-fig with feature flag

We do **not** rewrite any page in one go. We:

1. Create the new `src/` structure in parallel to the old `components/`, `hooks/`, etc.
2. Add `NEXT_PUBLIC_ARCH_V2=1` env flag.
3. For each feature module, build the v2 implementation **next to** the v1 code, with v2 imported only when the flag is on.
4. Flip the flag for one route at a time.
5. Once a feature is fully v2, delete the v1 code.

### 18.2 Phases

#### Sprint 1 — Foundation (1 week)

- Create `src/` tree.
- Add deps: `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-table`, `nuqs`, `@tiptap/react`, `cmdk`, `vaul`, `react-day-picker`, `react-dropzone`, `next-themes`, `prisma-zod-generator`, `use-debounce`.
- Set up `src/lib/api/client.ts` (fetch + zod).
- Set up `src/lib/query/client.ts` (refactored from `lib/query-client.ts`).
- Set up `src/app/providers/` and rewire `_app.tsx`.
- Add `nuqs` `<NuqsAdapter>` to providers.
- Add ESLint rules (`no-restricted-imports`, `no-explicit-any`).
- Add Vitest `include` and `src/test/render.tsx`.
- Add `preact` for `dynamic(import, { ssr: false })` size reduction (already a dep).

**Exit criteria:** `npm run build` passes; `npm test` passes; one page (login) is fully v2.

#### Sprint 2 — Work packages (the big one) (2 weeks)

- Move `components/work-packages/**` -> `src/features/work-packages/components/**`.
- Move `hooks/use-work-packages.ts` -> `src/features/work-packages/hooks/useWorkPackages.ts` (camelCase).
- Move `hooks/use-queries.ts` -> `src/features/work-packages/hooks/useQueries.ts`.
- Add zod schemas in `src/features/work-packages/schemas/`.
- Build `DataTable` primitive.
- Refactor `WorkPackageTable`, `WorkPackageBoard`, `GanttChart`, `WorkPackageCalendar` to use `DataTable` (where applicable) and Tiptap (description).
- Add `nuqs` URL state to `pages/projects/[projectId]/work-packages/`.
- Add optimistic-update pattern to all WP mutations.
- Add `<PageLoading>`, `<PageError>`, `<EmptyState>` primitives.
- Co-locate tests.

**Exit criteria:** `/projects/[id]/work-packages/?view=*` works fully on v2; flag flipped; v1 deleted.

#### Sprint 3 — Side features (1.5 weeks)

- Wiki, Forums, News, Documents, Meetings, Notifications, Activity.
- Same pattern: feature module + zod + RHF + nuqs + DataTable (where applicable) + Tiptap.
- Add `<RoleGate>` and `RoleGate` tests.
- Refactor `useSSE` to `src/lib/sse/` + `useRealtimeConnection`.

**Exit criteria:** every page in `pages/projects/[id]/**` is v2.

#### Sprint 4 — Cross-cutting + admin + polish (1.5 weeks)

- Admin, Settings, My Page, Dashboard.
- `middleware.ts` RBAC.
- Bundle budget CI step.
- Web Vitals to Sentry.
- Delete `components/`, `hooks/`, `stores/`, `types/`, `lib/` (top-level).
- Drop `NEXT_PUBLIC_ARCH_V2` flag.

**Exit criteria:** `find . -name 'components' -maxdepth 1` is empty.

### 18.3 Codemods

Three codemods in `scripts/codemods/`:

#### 18.3.1 `import-paths.ts` (jscodeshift)

Rewrites:

- `import { useWorkPackages } from '@/hooks/use-work-packages'` -> `import { useWorkPackages } from '@/features/work-packages'`
- `import { queryKeys } from '@/queries/queryKeys'` -> `import { queryKeys } from '@/lib/query/keys'`

#### 18.3.2 `kebab-to-pascal.ts` (jscodeshift)

Rewrites file names and imports:

- `work-package-table.tsx` -> `WorkPackageTable.tsx`
- `import { WorkPackageTable } from './work-package-table'` -> `import { WorkPackageTable } from './WorkPackageTable'`

#### 18.3.3 `barrelise.ts` (jscodeshift)

For each feature, generates an `index.ts` re-exporting the public symbols detected by usage from `pages/`.

```bash
npx jscodeshift --extensions=ts,tsx --parser=tsx -t scripts/codemods/import-paths.ts pages components hooks
npx jscodeshift --extensions=ts,tsx --parser=tsx -t scripts/codemods/kebab-to-pascal.ts src
npx tsx scripts/codemods/barrelise.ts src/features
```

### 18.4 Feature flag

```ts
// next.config.ts
const archV2 = process.env.NEXT_PUBLIC_ARCH_V2 === '1'

// In pages that have a v2:
import * as V1 from './_v1'
import * as V2 from './_v2'

export default archV2 ? V2.default : V1.default
```

Or, more cleanly, with a per-route opt-in:

```ts
// src/lib/arch/flag.ts
export const archV2 = process.env.NEXT_PUBLIC_ARCH_V2 === '1'
```

```tsx
// pages/projects/[projectId]/work-packages/table.tsx
import Page from archV2
  ? '@/features/work-packages/pages/WorkPackagesTablePage'
  : '@/components/work-packages/table/WorkPackageTablePage' // legacy
```

### 18.5 Roll-back plan

- The flag is **per deploy**. If v2 breaks, set `NEXT_PUBLIC_ARCH_V2=0` and redeploy.
- Codemods are **non-destructive** when run on a git working tree.
- v1 code is **deleted only at the end of each sprint**, after the new code has been in production for 3+ days.

---

## 19. Concrete Code Examples

### 19.1 Sample feature module: Work Packages

```
src/features/work-packages/
├── index.ts
├── components/
│   ├── table/
│   │   ├── WorkPackageTable.tsx
│   │   ├── WorkPackageTableRow.tsx
│   │   ├── WorkPackageTableHeader.tsx
│   │   ├── WorkPackageTableFilters.tsx
│   │   ├── WorkPackageTableEmptyState.tsx
│   │   ├── WorkPackageTableSkeleton.tsx
│   │   ├── WorkPackageInlineEdit.tsx
│   │   ├── columns.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   ├── board/
│   │   ├── WorkPackageBoard.tsx
│   │   ├── WorkPackageBoardColumn.tsx
│   │   ├── WorkPackageBoardCard.tsx
│   │   ├── WorkPackageBoardSkeleton.tsx
│   │   └── index.ts
│   ├── gantt/…
│   ├── calendar/…
│   ├── detail/
│   │   ├── WorkPackageDetail.tsx
│   │   ├── WorkPackageDetailHeader.tsx
│   │   ├── WorkPackageDetailActivity.tsx
│   │   ├── WorkPackageDetailRelations.tsx
│   │   └── index.ts
│   ├── query/
│   │   ├── QueryBuilder.tsx
│   │   ├── QuerySwitcher.tsx
│   │   ├── SaveQueryDialog.tsx
│   │   └── index.ts
│   └── shared/
│       ├── WorkPackageStatusBadge.tsx
│       ├── WorkPackageTypeIcon.tsx
│       ├── WorkPackagePriorityDot.tsx
│       └── index.ts
├── hooks/
│   ├── useWorkPackages.ts
│   ├── useWorkPackage.ts
│   ├── useCreateWorkPackage.ts
│   ├── useUpdateWorkPackage.ts
│   ├── useDeleteWorkPackage.ts
│   ├── useBulkUpdateWorkPackages.ts
│   ├── useWorkPackageRelations.ts
│   ├── useWorkPackageActivities.ts
│   ├── useWorkPackageWatchers.ts
│   ├── useQueries.ts
│   ├── useStatuses.ts
│   ├── useTypes.ts
│   ├── usePriorities.ts
│   ├── useWipLimits.ts
│   └── index.ts
├── api/
│   ├── getWorkPackages.ts
│   ├── getWorkPackage.ts
│   ├── createWorkPackage.ts
│   ├── updateWorkPackage.ts
│   ├── deleteWorkPackage.ts
│   ├── bulkUpdateWorkPackages.ts
│   ├── getRelations.ts
│   ├── createRelation.ts
│   ├── deleteRelation.ts
│   └── index.ts
├── schemas/
│   ├── workPackage.ts
│   ├── workPackageFilter.ts
│   ├── workPackageRelation.ts
│   └── index.ts
├── store/
│   ├── useWorkPackageUIStore.ts
│   └── index.ts
├── url-state.ts
├── permissions.ts
├── types.ts
└── __tests__/
    ├── msw.ts
    ├── useWorkPackages.test.ts
    ├── useUpdateWorkPackage.test.ts
    ├── WorkPackageTable.test.tsx
    └── …
```

#### `index.ts` (the public surface)

```ts
export {
  WorkPackageTable,
  WorkPackageBoard,
  WorkPackageCalendar,
  GanttChart,
  WorkPackageDetail,
  QueryBuilder,
  QuerySwitcher,
  WorkPackageStatusBadge,
  WorkPackageTypeIcon,
  WorkPackagePriorityDot,
} from './components'

export {
  useWorkPackages,
  useWorkPackage,
  useCreateWorkPackage,
  useUpdateWorkPackage,
  useDeleteWorkPackage,
  useBulkUpdateWorkPackages,
  useWorkPackageRelations,
  useWorkPackageActivities,
  useWorkPackageWatchers,
  useQueries,
  useStatuses,
  useTypes,
  usePriorities,
  useWipLimits,
} from './hooks'

export {
  workPackageSchema,
  workPackageFilterSchema,
  workPackageCreateSchema,
  workPackageUpdateSchema,
  workPackageRelationSchema,
  type WorkPackage,
  type WorkPackageFilter,
  type WorkPackageCreateInput,
  type WorkPackageUpdateInput,
  type WorkPackageRelation,
} from './schemas'

export { useWorkPackageUIStore } from './store'
export { wpUrlParsers, type WorkPackagesUrlState } from './url-state'
export { canEditWorkPackage, canDeleteWorkPackage, canMoveWorkPackage } from './permissions'
```

#### `types.ts`

```ts
import type { WorkPackage, WorkPackageFilter, WorkPackageRelation } from './schemas'
export type { WorkPackage, WorkPackageFilter, WorkPackageRelation }
```

### 19.2 Custom hook — `useWorkPackages` with placeholder data

```ts
// src/features/work-packages/hooks/useWorkPackages.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getWorkPackages } from '../api/getWorkPackages'
import { queryKeys } from '@/lib/query/keys'
import type { WorkPackageFilter } from '../schemas'

interface UseWorkPackagesOptions {
  projectId: string
  filter: WorkPackageFilter
  enabled?: boolean
}

export function useWorkPackages({ projectId, filter, enabled = true }: UseWorkPackagesOptions) {
  return useQuery({
    queryKey: queryKeys.workPackages.list(projectId, filter),
    queryFn: () => getWorkPackages({ projectId, filter }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
```

### 19.3 Zustand slice — `useWorkPackageUIStore`

```ts
// src/features/work-packages/store/useWorkPackageUIStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface DraftWorkPackage {
  projectId: string
  subject: string
  description?: string
  typeId?: string
  statusId?: string
  priorityId?: string
}

interface WorkPackageUIState {
  // Multi-select
  selectedIds: Set<string>
  setSelected: (ids: string[]) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void

  // Draft create (for the "create" modal in the table)
  draft: DraftWorkPackage | null
  setDraft: (draft: DraftWorkPackage | null) => void

  // Inline-edit active cell (table)
  editingCell: { id: string; field: string } | null
  setEditingCell: (cell: { id: string; field: string } | null) => void
}

export const useWorkPackageUIStore = create<WorkPackageUIState>()(
  devtools(
    (set) => ({
      selectedIds: new Set(),
      setSelected: (ids) => set({ selectedIds: new Set(ids) }),
      toggleSelected: (id) =>
        set((s) => {
          const next = new Set(s.selectedIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedIds: next }
        }),
      clearSelected: () => set({ selectedIds: new Set() }),

      draft: null,
      setDraft: (draft) => set({ draft }),

      editingCell: null,
      setEditingCell: (editingCell) => set({ editingCell }),
    }),
    { name: 'WorkPackageUI' },
  ),
)
```

Selector optimisation:

```ts
// Outside the store
export const useSelectedWorkPackageIds = () =>
  useWorkPackageUIStore((s) => Array.from(s.selectedIds))
```

### 19.4 Query hook with optimistic update

```ts
// src/features/work-packages/hooks/useUpdateWorkPackage.ts
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { updateWorkPackage } from '../api/updateWorkPackage'
import { queryKeys } from '@/lib/query/keys'
import { ApiError } from '@/lib/api/errors'
import { useConflictStore } from '@/stores/realtime'
import type { WorkPackage, WorkPackageUpdateInput } from '../schemas'

interface UpdateVars {
  id: string
  projectId: string
  patch: WorkPackageUpdateInput
}

interface UpdateContext {
  previousDetail?: WorkPackage
  previousLists: Array<[readonly unknown[], WorkPackage[] | undefined]>
}

async function optimisticallyPatch(
  qc: QueryClient,
  vars: UpdateVars,
): Promise<UpdateContext> {
  const detailKey = queryKeys.workPackages.detail(vars.id)
  const allKey = queryKeys.workPackages.all(vars.projectId)
  await qc.cancelQueries({ queryKey: detailKey })
  await qc.cancelQueries({ queryKey: allKey })

  const previousDetail = qc.getQueryData<WorkPackage>(detailKey)
  if (previousDetail) {
    qc.setQueryData<WorkPackage>(detailKey, { ...previousDetail, ...vars.patch })
  }

  const previousLists = qc.getQueriesData<WorkPackage[]>({ queryKey: allKey })
  qc.setQueriesData<WorkPackage[]>({ queryKey: allKey }, (old) =>
    old?.map((wp) => (wp.id === vars.id ? { ...wp, ...vars.patch } : wp)) ?? old,
  )

  return { previousDetail, previousLists }
}

function rollback(qc: QueryClient, vars: UpdateVars, ctx: UpdateContext | undefined) {
  if (!ctx) return
  if (ctx.previousDetail) {
    qc.setQueryData(queryKeys.workPackages.detail(vars.id), ctx.previousDetail)
  }
  for (const [key, data] of ctx.previousLists) {
    qc.setQueryData(key, data)
  }
}

export function useUpdateWorkPackage() {
  const qc = useQueryClient()
  const pushConflict = useConflictStore((s) => s.push)

  return useMutation<WorkPackage, ApiError, UpdateVars, UpdateContext>({
    mutationFn: ({ id, patch }) => updateWorkPackage(id, patch),

    onMutate: (vars) => optimisticallyPatch(qc, vars),

    onError: (err, vars, ctx) => {
      if (err.code === 'conflict' && err.details) {
        pushConflict({ id: vars.id, mine: ctx?.previousDetail, theirs: err.details as WorkPackage })
      } else {
        rollback(qc, vars, ctx)
      }
    },

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.workPackages.detail(vars.id) })
      qc.invalidateQueries({ queryKey: queryKeys.workPackages.all(vars.projectId) })
    },
  })
}
```

### 19.5 Form with validation

```tsx
// src/features/work-packages/components/detail/WorkPackageCreateForm.tsx
'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { workPackageCreateSchema, type WorkPackageCreateInput } from '../../schemas'
import { useCreateWorkPackage } from '../../hooks/useCreateWorkPackage'
import { useStatuses, useTypes, usePriorities } from '../../hooks'
import { FormField, FormSection, FormError, FormGrid } from '@/components/forms'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/primitives/Select'
import { Button } from '@/components/primitives/Button'
import { DateInput } from '@/components/forms/DateInput'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { toast } from '@/components/feedback/Toast'

export function WorkPackageCreateForm({ projectId, onSuccess }: { projectId: string; onSuccess: (wp: WorkPackage) => void }) {
  const { data: statuses } = useStatuses()
  const { data: types } = useTypes(projectId)
  const { data: priorities } = usePriorities()
  const create = useCreateWorkPackage()

  const form = useForm<WorkPackageCreateInput>({
    resolver: zodResolver(workPackageCreateSchema),
    defaultValues: { projectId, statusId: '', typeId: '', priorityId: 'normal' },
    mode: 'onBlur',
  })

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (wp) => {
        toast.success(`Work package #${wp.id} created`)
        form.reset()
        onSuccess(wp)
      },
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Create work package">
      <FormSection title="Details">
        <FormField
          label="Subject"
          required
          autoFocus
          error={form.formState.errors.subject?.message}
          {...form.register('subject')}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <div>
              <label className="text-sm font-medium">Description</label>
              <RichTextEditor
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="What's this work package about?"
              />
              {fieldState.error && <p className="text-xs text-red-600">{fieldState.error.message}</p>}
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Properties">
        <FormGrid>
          <Controller
            control={form.control}
            name="typeId"
            render={({ field, fieldState }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!fieldState.error}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            control={form.control}
            name="statusId"
            render={({ field, fieldState }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!fieldState.error}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses?.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            control={form.control}
            name="priorityId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  {priorities?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          />
          <DateInput label="Start date" {...form.register('startDate')} />
          <DateInput label="Due date" {...form.register('dueDate')} />
          <FormField
            label="Estimated hours"
            type="number"
            step="0.25"
            {...form.register('estimatedHours', { valueAsNumber: true })}
          />
        </FormGrid>
      </FormSection>

      {create.error && <FormError error={create.error} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => form.reset()}>Reset</Button>
        <Button type="submit" isLoading={create.isPending}>Create work package</Button>
      </div>
    </form>
  )
}
```

### 19.6 Feature page (thin)

```tsx
// pages/projects/[projectId]/work-packages/table.tsx
import { ProjectLayout } from '../_layout'
import { WorkPackagesTableView } from '@/features/work-packages'

export default function WorkPackagesTablePage() {
  return (
    <ProjectLayout active="work-packages">
      <WorkPackagesTableView />
    </ProjectLayout>
  )
}
```

```tsx
// src/features/work-packages/components/views/WorkPackagesTableView.tsx
import { useQueryStates } from 'nuqs'
import { wpUrlParsers } from '../../url-state'
import { useWorkPackages } from '../../hooks'
import { useProject } from '@/features/projects'
import { DataTable } from '@/components/data/DataTable'
import { workPackageColumns } from '../table/columns'
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type SortingState } from '@tanstack/react-table'
import { useDeferredValue, useMemo, useState } from 'react'
import { WorkPackageTableFilters } from '../table/WorkPackageTableFilters'
import { WorkPackageTableSkeleton } from '../table/WorkPackageTableSkeleton'
import { WorkPackageTableEmptyState } from '../table/WorkPackageTableEmptyState'
import { PageError } from '@/components/feedback'

export function WorkPackagesTableView() {
  const [url, setUrl] = useQueryStates(wpUrlParsers, { history: 'push' })
  const { data: project, isLoading: projectLoading } = useProject()
  const { data, isLoading, error, refetch } = useWorkPackages({
    projectId: project!.id,
    filter: {
      statusId: url.status,
      assigneeId: url.assignee,
      search: url.search,
      page: url.page,
      pageSize: url.pageSize,
      sort: url.sort,
    },
  })

  const deferredSearch = useDeferredValue(url.search ?? '')

  const tableData = useMemo(() => data?.data ?? [], [data])
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data: tableData,
    columns: workPackageColumns,
    state: { sorting, globalFilter: deferredSearch },
    onSortingChange: setSorting,
    onGlobalFilterChange: () => {},
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (projectLoading || isLoading) return <WorkPackageTableSkeleton />
  if (error) return <PageError error={error} onRetry={refetch} />
  if (!data?.data.length) return <WorkPackageTableEmptyState />

  return (
    <div className="space-y-4">
      <WorkPackageTableFilters value={url} onChange={setUrl} />
      <DataTable table={table} />
    </div>
  )
}
```

### 19.7 nuqs URL state for the table

```ts
// src/features/work-packages/url-state.ts
import {
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
  parseAsStringEnum,
  parseAsStringLiteral,
} from 'nuqs'

export const wpUrlParsers = {
  view: parseAsStringEnum(['table', 'board', 'gantt', 'calendar']).withDefault('table'),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(50),
  sort: parseAsString.withDefault('-updatedAt'),
  search: parseAsString.withDefault(''),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsString).withDefault([]),
  assignee: parseAsArrayOf(parseAsString).withDefault([]),
  priority: parseAsArrayOf(parseAsString).withDefault([]),
}

export type WorkPackagesUrlState = {
  [K in keyof typeof wpUrlParsers]: ReturnType<(typeof wpUrlParsers)[K]['parseServerSide']>
}
```

---

## 20. Top 3 Architectural Changes — Summary

After auditing the codebase, here are the **three most important architectural changes** to make. They unlock everything else.

### Change 1: Feature-modular `src/` with barrels

**Why it's #1:** the current flat `components/`, `hooks/`, `stores/`, `types/`, `lib/` tree is the single biggest drag on velocity. New developers can't tell what belongs to "work packages" without grepping. A 56-Prisma-model, 133-component app cannot stay flat.

**What it does:**

- All WP code under `src/features/work-packages/`.
- Each feature exposes only its `index.ts` barrel.
- ESLint blocks deep imports.
- Deletion is a one-folder affair.

**Effort:** 3 weeks (one feature per sprint, with codemods).

**Risk:** low — feature flag lets us roll back.

### Change 2: Promoted TanStack Query as the typed data layer

**Why it's #2:** server data is currently fetched in 41 hooks with no schema validation, no scoped invalidation, no optimistic updates, and one giant mutation pattern. The query-key factory is good but inconsistent (some keys are arrays, some have a `null` second element, some are deeply nested).

**What it does:**

- Type-safe `queryKeys` factory with `all`/`list`/`detail` per resource.
- `apiClient` that runs every response through a zod schema.
- `ApiError` class for typed error handling.
- Optimistic-update helper used by all mutations.
- `useRealtimeConnection` mounted once, scoped by project.
- SSE invalidation targeted (`predicate`/`exact: false` with prefix).

**Effort:** 2 weeks (mostly mechanical; biggest cost is writing the zod schemas).

**Risk:** low — TanStack Query is already in use; we are tightening, not replacing.

### Change 3: `react-hook-form` + `zod` + `nuqs` as the standard input stack

**Why it's #3:** today every form is hand-rolled with `useState`. There is no URL state for filters/sort/page. Reloading a work-package table resets everything. This is the single biggest UX regression we have.

**What it does:**

- RHF for all forms; zod for validation (already a dep).
- `nuqs` for typed URL search params; filters, sort, page, view are shareable links.
- `useDeferredValue` + `startTransition` for smooth filter/sort UX.
- `<FormField>` / `<FormSection>` / `<FormError>` primitives.

**Effort:** 1.5 weeks (spread across sprints 2–3).

**Risk:** very low — additive. We can leave v1 forms in place until the feature is migrated.

**Bonus:** unlocks deep-link sharing ("send me the link to the table filtered by `status=open,assignee=me`") and analytics on filter usage.

---

## Appendix A: Linting & Code Quality Gates

```bash
# Local
npm run lint              # eslint
npx tsc --noEmit          # type check
npm test                  # vitest unit + component
npm run build             # next build (incl. turbopack)
npm run analyze           # bundle analyzer

# CI (must pass)
1. lint
2. typecheck
3. test (with coverage threshold: 70% lines, 65% branches)
4. e2e (Playwright, against built app)
5. build
6. analyze (fail on >10% chunk-size regression)
7. lighthouse-ci (perf budget, accessibility >= 95)
```

`vitest.config.ts` thresholds:

```ts
test: {
  coverage: {
    thresholds: {
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
},
```

`lighthouserc.json` key budgets:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

---

## Appendix B: Error Catalogue & UX Patterns

| Error code | User-facing message | Action |
|---|---|---|
| `network` | "Connection lost. Retrying…" | Auto-retry; show banner. |
| `timeout` | "The server is taking too long. Try again." | Retry button. |
| `unauthorized` (401) | "Please sign in again." | Redirect to `/login?callbackUrl=…`. |
| `forbidden` (403) | "You don't have access to this." | Redirect to `/403`. |
| `not_found` (404) | "This no longer exists." | Empty state. |
| `validation` (400) | Per-field messages. | Inline errors. |
| `conflict` (409) | "Someone else updated this. Your changes are saved as a draft." | Show diff; "Use theirs" / "Keep mine" / "Merge" actions. |
| `rate_limited` (429) | "You're going too fast. Slow down." | Backoff. |
| `server` (5xx) | "Something went wrong on our end." | Retry; Sentry. |
| `schema_mismatch` | "Please refresh the page." | Hard reload. |

**Toast policy:**

- Success toasts auto-dismiss in 4 s.
- Error toasts are sticky until dismissed.
- Warning toasts auto-dismiss in 6 s.
- Toasts stack bottom-right, max 3 visible; older ones queue.

---

## Appendix C: Decision Log

| # | Decision | Alternatives considered | Why we chose this |
|---|---|---|---|
| D1 | Feature-modular `src/features/` | `src/modules/`, KCD's `remix-flat-routes`-style | `features/` is the most common Next.js convention; matches the team's existing `components/<feature>/` mental model. |
| D2 | TanStack Table (headless) | Custom `Table.tsx`, AG-Grid | Headless, no styling lock-in, integrates with our existing virtualisation. AG-Grid is 200 kB and overkill. |
| D3 | Tiptap for editor | Lexical, Slate, custom contentEditable | Tiptap's headless model matches Radix. Markdown extension preserves our storage format. Yjs path exists for v3 collaboration. |
| D4 | `nuqs` for URL state | `useRouter().query` + manual parsing, `query-string` | Type-safe, SSR-aware, tiny. |
| D5 | Sliced Zustand | Single store, Jotai, Redux Toolkit | Sliced Zustand matches our component tier model; selectors stay fast; bundle splits naturally. |
| D6 | `react-hook-form` + `zod` | `formik`, `react-final-form`, unform | RHF is the de-facto standard; zod is already a dep; `@hookform/resolvers` is the glue. |
| D7 | Pages Router | App Router | AGENTS.md is explicit. The team has 2 years of Pages-Router muscle memory. |
| D8 | Keep Recharts for charts | Visx, ECharts, D3 | Recharts is already in use, ships < 50 kB gzipped, fits 80% of our needs. Gantt/Calendar stay custom. |
| D9 | Keep SSE for realtime | WebSocket, long polling | One-way fan-out is the dominant pattern. WebSocket migration is feasible later without an API change. |
| D10 | `prisma-zod-generator` | Hand-written zod, `zod-prisma-types` | Auto-generates a schema per Prisma model; eliminates drift. |

---

## Document cross-references

- **Phase 2 spec** (Work Packages): this document's §19.1 is the source of truth for the WP module shape.
- **Phase 4 spec** (Wiki, Forum, Documents, Meetings): §14 (Tiptap) and §13 (Calendar) cover the shared primitives.
- **Migration plan** (§18) is the implementation schedule.
- **Decision log** (Appendix C) should be updated as we make new calls.

---

## File summary

- **File path:** `/home/cwlai/openproject-rewrite/revamp-v2/design/02-frontend-architecture.md`
- **Line count:** (to be verified)
- **Top 3 architectural changes:**
  1. **Feature-modular `src/`** with barrels and ESLint-enforced public surfaces.
  2. **Promoted TanStack Query as the typed data layer** (query-key factory, `apiClient` + zod, optimistic-update helper, scoped SSE invalidation).
  3. **`react-hook-form` + `zod` + `nuqs`** as the standard input stack, giving us deep-linkable filter/sort/page state and accessible forms.
