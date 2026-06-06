# OpenProject Rewrite — Testing & QA Strategy (v2)

**Version:** 2.0
**Status:** Approved for implementation
**Audience:** Engineers, QA, DevOps, Tech Leads
**Tech baseline:** Vitest 4.1.4, React Testing Library 16, MSW 2.14, Playwright 1.59, k6, Prisma 7, Next.js 15 (Pages Router)
**Last updated:** 2026-06-06

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Current State Audit](#2-current-state-audit)
3. [Testing Pyramid & Targets](#3-testing-pyramid--targets)
4. [Unit Testing (Vitest)](#4-unit-testing-vitest)
5. [Component Testing (RTL)](#5-component-testing-rtl)
6. [Hook Testing](#6-hook-testing)
7. [API Integration Testing](#7-api-integration-testing)
8. [End-to-End Testing (Playwright)](#8-end-to-end-testing-playwright)
9. [Critical User Journeys — Top 20](#9-critical-user-journeys--top-20)
10. [Visual Regression](#10-visual-regression)
11. [Performance Testing (k6)](#11-performance-testing-k6)
12. [Accessibility Testing](#12-accessibility-testing)
13. [Security Testing](#13-security-testing)
14. [Mutation Testing (Stryker)](#14-mutation-testing-stryker)
15. [Test Data Management](#15-test-data-management)
16. [CI/CD Integration](#16-cicd-integration)
17. [Test Debugging & Tooling](#17-test-debugging--tooling)
18. [Mock-Fiction Detection (Known Issue)](#18-mock-fiction-detection-known-issue)
19. [Migration Plan: feature-flow-http.js](#19-migration-plan-feature-flow-httpjs)
20. [Coverage Analysis & Gap Prioritization](#20-coverage-analysis--gap-prioritization)
21. [Tooling Catalog & Versions](#21-tooling-catalog--versions)
22. [Implementation Roadmap](#22-implementation-roadmap)
23. [Success Metrics & SLOs](#23-success-metrics--slos)
24. [Appendix: Templates & Examples](#24-appendix-templates--examples)

---

## 1. Vision & Principles

OpenProject Rewrite is a production-grade Next.js (Pages Router) recreation of OpenProject covering work packages, projects, wiki, forums, news, documents, meetings, time tracking, notifications, RBAC, 2FA, LDAP, and S3-backed attachments. A regression in any of these areas breaks real customer workflows, so testing must be **fast**, **deterministic**, **broad**, and **honest**.

### 1.1 Guiding Principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| P1 | **Test the contract, not the implementation** | Query components and APIs the way users and consumers do. No `instance.state`, no `data-testid` only selectors, no reaching into React internals. |
| P2 | **Fast feedback first** | Unit + integration tests on every save (watch mode < 5s). E2E and load on PR. No test that takes > 2s in the unit tier. |
| P3 | **Deterministic, not lucky** | No `setTimeout`, no network in unit tests, no shared global state, no flake budgets. If a test is flaky, fix or delete. |
| P4 | **Honest coverage** | Coverage is a *floor*, not a vanity metric. Mutation score is the *real* quality signal. |
| P5 | **No mock-fiction** | Mocks must represent real behavior. The known bug: `vi.hoisted()` + per-test override can encode stale UI states — fixed via shared handlers + per-test reset, not per-test rewrites. |
| P6 | **Pyramid-shaped** | 70% unit, 20% integration, 10% E2E. If a bug needs an E2E to catch, the underlying unit/integration gap is the actual defect. |
| P7 | **CI is the source of truth** | Local green ≠ merged. Required checks gate the merge. |
| P8 | **Test the unhappy path as much as the happy path** | Auth failures, RBAC denials, validation errors, race conditions, network errors, empty states, broken pagination — all first-class. |

### 1.2 What we are NOT doing

- ❌ Snapshot tests for non-static UI (table rows, board cards, Gantt bars, calendar cells)
- ❌ Testing library internals (no `container.firstChild` walks, no `findByType`)
- ❌ Mocking what we own (Prisma) at the SQL level for every test
- ❌ E2E tests for things unit tests can verify
- ❌ Coverage theater (100% lines on a file with 0% meaningful branch coverage)

### 1.3 Definition of Done (per PR)

A PR is shippable when:
1. `npm run typecheck` passes (zero `any` introduced without justification)
2. `npm run lint` passes (zero new warnings)
3. `npm run test` (Vitest unit + integration) passes, coverage deltas reviewed
4. E2E smoke (Playwright, ~5 critical journeys) passes
5. axe-core checks pass (zero serious/critical a11y issues introduced)
6. Mutation score on touched files ≥ 60% (when Stryker is wired)
7. Sentry error rate unchanged on staging deploy (post-deploy)

---

## 2. Current State Audit

### 2.1 Inventory of existing tests

```
__tests__/
├── api/                          # API unit tests (MSW + Prisma mock)
│   ├── auth/2fa.test.ts          (38 lines, 2FA API)
│   ├── documents-meetings-search.unit.test.ts (25 cases)
│   ├── forums.unit.test.ts       (16 cases)
│   ├── projects.unit.test.ts     (48 cases — heaviest coverage)
│   ├── routes-integration.test.ts (26 cases — needs dev server, excluded in CI)
│   ├── seed-lookup.test.ts       (14 cases)
│   ├── users/                    (empty placeholder)
│   ├── ldap/                     (empty placeholder)
│   ├── wiki.unit.test.ts         (8 cases — too thin)
│   └── work-packages.unit.test.ts (13 cases)
│
├── components/                   # React Testing Library component tests
│   ├── auth/2fa-setup-dialog.test.tsx
│   ├── backlogs/{BurndownChart,SprintBoard,SprintCard}.test.tsx
│   ├── my-page/my-page-widget.test.tsx
│   ├── notifications/{notification-bell,center,item}.test.tsx
│   ├── time-tracking/{log-time-dialog,time-entry-list}.test.tsx
│   ├── wiki/{wiki-components,wiki-editor,wiki-page-list,wiki-page-view,wiki-version-history}.test.tsx
│   ├── error-handling.test.tsx   (20 cases)
│   ├── ui-smoke.test.tsx         (28 cases — bare-bones smoke)
│   ├── work-packages-{board,calendar,detail,gantt,page,table,views}.test.tsx
│
├── hooks/
│   ├── use-hooks.test.tsx        (cross-cutting hooks)
│   └── use-queries.test.tsx      (TanStack Query hooks)
│
├── lib/
│   ├── 2fa/{backup-codes,totp,webauthn}.test.ts
│   ├── gantt-calculate.test.ts   (pure-function coverage)
│   ├── hooks/useBacklogs.test.tsx
│   ├── ldap/{client,group-map,sync}.test.ts
│   └── oauth.unit.test.ts
│
└── pages/
    └── project-settings.test.tsx (single page-level test)

src/test/
├── setup.ts                      # MSW lifecycle, cleanup hook
└── mocks/
    ├── server.ts                 # setupServer(...handlers)
    └── handlers.ts               # in-memory MSW MockDb
```

**Total:** 7,514+ lines of test code, 47 test files, ~600+ test cases.

### 2.2 Tooling already present

| Tool | Version | Status | Notes |
|------|---------|--------|-------|
| Vitest | 4.1.4 | ✅ In use | `vitest.config.ts` with jsdom, MSW setup |
| @testing-library/react | 16.3.2 | ✅ In use | render, screen, waitFor, userEvent |
| @testing-library/jest-dom | 6.9.1 | ✅ In use | matchers wired in setup.ts |
| @testing-library/user-event | 14.6.1 | ✅ In use | real-keyboard simulation |
| MSW | 2.14.2 | ✅ In use | Node + browser handlers, MockDb |
| Playwright | 1.59.1 | ⚠️ Partial | Only used for ad-hoc screenshot scripts |
| k6 | n/a | ✅ In use | `scenarios/load.ts`, `scenarios/smoke.ts` |
| next-test-api-route-handler | 5.0.4 | ✅ Available | Not yet used in tests |
| node-mocks-http | 1.17.2 | ✅ Available | Not yet used |
| @vitest/ui | 4.1.4 | ✅ Available | Not enabled by default |

### 2.3 Strengths of the existing setup

- **MSW is properly wired** with `setupServer` + `beforeAll/afterEach/afterAll` lifecycle and `resetMockDb()` for isolation. This is excellent.
- **Zod cuid format is respected** in mocks (`c${'0'.repeat(24)}${n}`) — avoids a common fake-data bug.
- **Prisma + Upstash Redis are mocked at module level** with `vi.mock` so route modules don't crash on import.
- **Component tests use `getByRole` / `getByLabelText` patterns** in several files — RTL best practice.
- **Hook tests exist** in `__tests__/hooks/` and `__tests__/lib/hooks/`.
- **Coverage of wiki components, backlogs, time-tracking, notifications is present** at the component level.

### 2.4 Gaps and known issues

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | **`__tests__/api/ldap/` and `users/` are empty directories** | High | No tests for the most security-critical surface |
| G2 | **`routes-integration.test.ts` is excluded in CI** (vitest.config exclude) | High | Comment says "Skipped in CI unless integration test flag is set" — flag is not set anywhere |
| G3 | **No Playwright config** (`playwright.config.ts` missing) | High | All E2E behavior is ad-hoc screenshot scripts |
| G4 | **No Page Object Models** | High | Screenshot scripts have selectors inlined |
| G5 | **No factories** (factory-bot / Fishery) | High | Test data is hand-rolled in each file |
| G6 | **No faker** for test data | Medium | IDs like `c${'0'.repeat(24)}${n}` are cute but unrealistic |
| G7 | **No axe-core integration** in component tests | High | A11y issues only caught by manual review |
| G8 | **No CI workflow** — `.github/workflows/` not present | Critical | No automated gate |
| G9 | **No Snyk / npm audit** in CI | High | Vulnerabilities slip in |
| G10 | **No OWASP ZAP baseline** | High | XSS / CSRF / injection not scanned |
| G11 | **No mutation testing** (Stryker) | Medium | Coverage ≠ quality |
| G12 | **No visual regression** (Chromatic/Percy) | Medium | UI drift not caught |
| G13 | **`feature-flow-http.js` is a manual script**, not a real test | High | Output is a console report, not a pass/fail gate |
| G14 | **Mock-fiction risk** in `__tests__/api/*.unit.test.ts` | Critical | `vi.hoisted()` + per-test overrides can encode stale UI bugs (e.g., field renamed in form, mock still returns old shape) |
| G15 | **No HTTP-level API tests against a real dev server** | High | `routes-integration.test.ts` exists but is excluded |
| G16 | **No contract tests** for Prisma queries | Medium | N+1 / index issues only caught in prod |
| G17 | **No performance budgets enforced** | Medium | k6 scripts exist but aren't part of required checks |
| G18 | **Single integration test file** for routes — many routes uncovered | High | `auth/2fa`, `work-packages/*` CRUD, RBAC variants, etc. |
| G19 | **No flaky-test quarantine workflow** | Medium | Flakes are hidden or fixed silently |
| G20 | **Coverage reporting not wired** to Codecov/SonarQube | High | Coverage invisible to team |
| G21 | **No Lighthouse / Core Web Vitals** in CI | Medium | Perf regressions slip in |
| G22 | **No structured test plan for wiki/forum flows** | Medium | UI tests exist; no full user-journey tests |

### 2.5 Quoted example of mock-fiction risk

In `__tests__/api/work-packages.unit.test.ts`, the Prisma mock returns:
```ts
{ id: cuid(1), subject: 'Test Task', description: null, /* ... */ }
```

If a UI form later renames `subject` → `title`, but a Zod schema change is made without updating the mock, the test still passes against the old shape, while real Prisma returns the new shape — the test goes green but the UI crashes. **Detection: every mock must be auto-validated against the real Zod schema on test run** (see §18).

---

## 3. Testing Pyramid & Targets

```
                         ▲
                        ╱ ╲
                       ╱   ╲          E2E (10%)      ~50 journeys, Playwright
                      ╱─────╲         Critical user flows, multi-step
                     ╱       ╲        Slow, ~2-5 min in CI
                    ╱─────────╲
                   ╱           ╲      Integration (20%)    ~200 cases
                  ╱             ╲     API routes + DB, RTL with providers
                 ╱               ╲    Real Prisma + test DB, ~30s in CI
                ╱─────────────────╲
               ╱                   ╲  Unit (70%)           ~1,500+ cases
              ╱                     ╲ Pure logic, hooks, utils, validators
             ╱                       ╲ Fast, <5s total
            ╱─────────────────────────╲
```

### 3.1 Volume targets

| Tier | Target % of cases | Target count | Median runtime | Where |
|------|--------------------|--------------|----------------|-------|
| Unit | 70% | 1,500+ | < 5s total | `__tests__/lib/`, `__tests__/hooks/`, `*.test.ts` colocated with source |
| Component | (rolled into integration) | — | — | `__tests__/components/` |
| API integration | 20% | ~200 | < 30s total | `__tests__/api/integration/`, `next-test-api-route-handler` + real Prisma test DB |
| E2E | 10% | 50 | < 5 min in CI | `e2e/` Playwright |
| Visual | 1% | ~30 baseline | < 2 min | `e2e/visual/` |
| Load | ad-hoc | 5 k6 scenarios | < 10 min nightly | `k6/scenarios/` |
| A11y | 5% | ~50 axe scans | < 30s | inline in component + E2E |

### 3.2 Coverage targets (line / branch)

| Module class | Lines | Branches | Functions | Statements |
|--------------|-------|----------|-----------|------------|
| `lib/` (pure logic) | 90% | 85% | 90% | 90% |
| `lib/auth.ts`, RBAC | 95% | 90% | 95% | 95% |
| API routes (`pages/api/**`) | 85% | 80% | 85% | 85% |
| Hooks (`hooks/`) | 85% | 80% | 90% | 85% |
| Zustand stores (`stores/`) | 90% | 85% | 90% | 90% |
| Components (`components/`) | 75% | 65% | 75% | 75% |
| Pages (`pages/`) | 60% | 50% | 65% | 60% |
| **Project-wide floor** | **80%** | **70%** | **80%** | **80%** |

Coverage thresholds are enforced in `vitest.config.ts` via `coverage.thresholds`; falling below fails CI.

### 3.3 What gets excluded from coverage

- `**/*.d.ts` (types)
- `**/*.config.{js,ts,mjs}` (config)
- `prisma/migrations/**` (auto-generated)
- `node_modules/**`
- Test files themselves
- One-off scripts in `scripts/` that are not exercised in tests

### 3.4 Mutation score target (when Stryker wired)

- **60% mutation score** on touched files in any PR
- **70%** on `lib/auth.ts`, RBAC, and security-sensitive code

---

## 4. Unit Testing (Vitest)

### 4.1 Configuration

`vitest.config.ts` (current + proposed additions):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env.test') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [
      '.next/**', 'node_modules/**',
      'e2e/**',                          // Playwright owns this
      '**/*.e2e.test.ts',                // explicit E2E marker
    ],
    env: {
      DATABASE_URL: process.env.DATABASE_URL
        || 'postgresql://cwlai@/openproject_rewrite_test?host=/var/run/postgresql&schema=public',
      NODE_ENV: 'test',
      NEXTAUTH_SECRET: 'test-secret-do-not-use-in-prod',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**', '.next/**', 'coverage/**',
        '**/*.d.ts', '**/*.config.{js,ts,mjs}',
        'prisma/migrations/**', 'scripts/**',
        'src/test/**', '__tests__/**', 'e2e/**',
      ],
      thresholds: {
        lines: 80, branches: 70, functions: 80, statements: 80,
        perFile: false,
        // Per-glob thresholds in CI via custom check
      },
      // Skip in watch mode for speed
      enabled: !process.env.VITEST_WATCH,
    },
    pool: 'threads',
    poolOptions: { threads: { singleThread: false } },
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    sequence: { shuffle: true, hooks: 'parallel' },
    passWithNoTests: false,
    reporters: process.env.CI
      ? ['default', 'github-actions', 'junit']
      : ['default', 'html'],
    outputFile: { junit: './coverage/junit.xml', html: './coverage/report.html' },
  },
})
```

### 4.2 Test structure: colocation vs. `__tests__/`

**Decision: Hybrid, weighted toward colocation.**

| File type | Location | Rationale |
|-----------|----------|-----------|
| Pure utility / lib / hook | **Colocated** `src/lib/date.ts` ↔ `src/lib/date.test.ts` | Discoverable when reading source. Standard Vite/Next convention. |
| Component | **Colocated** `src/components/Button.tsx` ↔ `src/components/Button.test.tsx` | Co-evolve with the component. |
| API route unit test (mocked) | **Colocated** `pages/api/projects/[id].ts` ↔ `pages/api/projects/[id].test.ts` | Tight coupling to handler signature. |
| API route **integration** (real DB) | `__tests__/api/integration/` | Cross-cutting: needs shared setup, fixtures, transaction rollback. |
| E2E | `e2e/` | Different runner (Playwright), different config. |
| Visual regression | `e2e/visual/` | Playwright snapshots. |
| Shared fixtures / factories | `__tests__/factories/` | Re-used across suites. |
| Shared MSW handlers | `src/test/mocks/handlers.ts` | Used by all suites. |
| Setup | `src/test/setup.ts` | Global. |

The existing `__tests__/{api,components,hooks,lib}/` tree stays for the **integration tier** and shared fixtures; the per-test-file logic for a unit test should be **moved next to its source** in a sweep. Migration plan: §22.

### 4.3 Naming conventions

- Files: `*.test.ts` (logic), `*.test.tsx` (with JSX)
- Top-level `describe(name, fn)`: noun — `describe('workPackageReducer')`
- Inner `it(name, fn)` or `test(name, fn)`: observable behavior — `it('marks work package as closed when status isClosed is true')`
- Use `it` (BDD style) for new code; legacy `test` is allowed
- Skip / todo: `it.skip` for known broken, `it.todo` for documented-not-implemented

### 4.4 Mocking strategy

| Need | Use | Avoid |
|------|-----|-------|
| Replace whole module | `vi.mock('module', factory)` | `jest.mock` (legacy) |
| Capture mocks for assertions | `vi.hoisted(() => ({ fn: vi.fn() }))` + reference in factory | Inline `vi.fn()` (timing bugs with hoisting) |
| Spy on a method | `vi.spyOn(obj, 'method')` | Rewriting the method |
| One-call stub | `vi.fn().mockResolvedValueOnce(x)` | Mocking whole module for one call |
| Time / Date | `vi.useFakeTimers()` + `vi.setSystemTime()` | Real `Date.now()` |
| Random / UUID | inject via `vi.mocked(faker)` | Calling `Math.random()` |
| fetch / HTTP | **MSW** (see §6) | `vi.spyOn(global, 'fetch')` |
| Prisma | `vi.mock('@/lib/prisma', factory)` for unit; **real test DB** for integration | Mocking the underlying `$queryRaw` for every test |
| NextAuth | `vi.mock('next-auth', factory)` returning `getServerSession` stub | Hitting real provider |
| Sentry | `vi.mock('@sentry/nextjs', factory)` no-oping `captureException` | Network calls in tests |

**The `vi.hoisted()` rule:**
- Variables used inside `vi.mock` factory must be hoisted via `vi.hoisted(() => …)`.
- This is the *only* safe way to share mock state between the hoisted factory and the test body.
- Per-test overrides of hoisted state are exactly the vector for **mock-fiction** — see §18.

### 4.5 What to test in unit tier

| Layer | Examples | What to cover |
|-------|----------|---------------|
| Pure utilities | `lib/date.ts`, `lib/string.ts`, `lib/cn.ts` | All branches, edge cases (empty, null, undefined, very large), invariant properties |
| Validators (Zod) | `lib/validators/work-package.ts` | Happy path, every error path, type narrowing, custom refinements |
| Reducers | `stores/ui-store.ts`, `stores/filter-store.ts` | Each action, initial state, idempotency |
| Auth helpers | `lib/auth.ts` (`isSystemAdmin`, `validatePassword`, `requireRole`) | Every role × resource matrix |
| RBAC predicate | `lib/rbac/can.ts` | Every (role, action, resource) combo |
| Hooks | `hooks/use-work-packages.ts` | Loading, success, error, refetch, optimistic update, stale-while-revalidate |
| API route handlers | `pages/api/projects/[id].ts` (with Prisma mocked) | Method dispatch, auth check, RBAC check, validation, error mapping, status codes |
| Crypto / hashing | `lib/crypto.ts` | Known vectors, edge cases, error paths |
| Formatters | `lib/format/duration.ts`, `lib/format/currency.ts` | Locale, negative, zero, very large, NaN/Infinity |
| Business logic | `services/notification-dispatcher.ts` | Every dispatch trigger, dedup, rate limit |

### 4.6 Anti-patterns to forbid (lint rules)

| Pattern | Why bad | Replacement |
|---------|---------|-------------|
| `expect(true).toBe(true)` | Tests nothing | Delete or assert specific behavior |
| `it('works', () => {})` | Empty test | Remove or `it.todo` |
| `vi.mock('react')` | Breaks RTL | Never mock React itself |
| Snapshot of dynamic UI | Re-baselines on every change | Assert specific elements / counts |
| `await new Promise(r => setTimeout(r, 50))` in tests | Slow + flakey | `waitFor` / `findBy` |
| `it.skip` merged to main | Hides failures | `it.todo` with linked issue, or fix |
| Conditional assertions (`if (x) expect(...)`) | Some code paths untested | Cover all paths or use `describe.skip` |
| Asserting on `console.log` output | Coupling to debug logs | Test the resulting state |

ESLint config additions (in `eslint.config.mjs`):
```js
'vitest/no-conditional-expect': 'error',
'vitest/expect-expect': ['error', { assertFunctionNames: ['expect*'] }],
'vitest/no-skipped-tests': 'warn',
'vitest/no-focused-tests': 'error',
'vitest/valid-title': ['error', { mustNotMatch: ['^works$', '^test$'] }],
```

### 4.7 Watch mode workflow

```bash
# Default loop
npm test

# UI mode (browser-based, time-travel)
npm run test:ui   # vitest --ui

# One file
npm test -- src/lib/date.test.ts

# Pattern
npm test -- -t "marks work package as closed"

# Coverage
npm run test:coverage
```

---

## 5. Component Testing (RTL)

### 5.1 Philosophy

- **Render the way the user sees it.** The component is a black box whose inputs are props + user events, whose outputs are the rendered DOM and callback invocations.
- **Prefer user-centric queries** (see 5.2).
- **No shallow rendering.** No enzyme. We test the real component tree with the real React reconciler.
- **Mock at the boundary, not in the middle.** Mock `fetch` (MSW), mock `next/router`, mock `next-auth` — but never mock `useState`.

### 5.2 Query priority (the RTL priority ladder)

```ts
// 1. Best: accessible to everyone, mirrors screen reader / keyboard nav
screen.getByRole('button', { name: /create project/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search projects/i)   // acceptable fallback
screen.getByText(/welcome back/i)                 // visible text
screen.getByDisplayValue('alice@example.com')     // form value

// 2. Acceptable for non-semantic elements
screen.getByAltText(/avatar of alice/i)

// 3. Last resort, never preferred
screen.getByTestId('project-card-123')

// 4. Forbidden (in this priority)
container.querySelector('.btn-primary')
container.firstChild
```

**Rule:** if you need `getByTestId`, the component is missing semantic markup. Fix the component, not the test.

### 5.3 Standard wrapper

`src/test/TestProviders.tsx` — a single wrapper that wires all providers tests need:

```tsx
import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { ThemeProvider } from 'next-themes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
})

export function TestProviders({ children, session = null }: {
  children: ReactNode
  session?: any
}) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

export function renderWithProviders(ui: React.ReactElement, options = {}) {
  return render(ui, { wrapper: TestProviders, ...options })
}
```

`renderWithProviders` is the default; `render` is only used in tightly scoped tests.

### 5.4 User event simulation

```tsx
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.click(screen.getByRole('button', { name: /save/i }))
await user.type(screen.getByLabelText(/title/i), 'New work package')
await user.tab()
await user.keyboard('{Enter}')
```

`userEvent.setup()` must be called once per test (not per `user.*`). This is the v14+ API.

### 5.5 Async patterns

```tsx
// Wait for an element to appear
const banner = await screen.findByRole('status')

// Wait for assertion to pass
await waitFor(() => {
  expect(screen.getByText(/saved/i)).toBeInTheDocument()
})

// Wait for query mutation to settle
await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(payload))

// Never do this:
await new Promise(r => setTimeout(r, 100))  // ❌

// Never do this either:
expect(container.querySelector('.spinner')).toBeNull()  // ❌
```

### 5.6 What to assert in component tests

For `<WorkPackageRow wp={...} onSelect={fn} />`:

| Aspect | Assertion |
|--------|-----------|
| Renders | `getByText(wp.subject)`, `getByRole('row')` |
| Status | Status icon is `data-status={wp.status}` or aria-label matches |
| Click | `await user.click(row)` then `expect(onSelect).toHaveBeenCalledWith(wp.id)` |
| Accessibility | `axe.run(container)` has 0 serious/critical violations |
| Error state | When hook returns error, error message appears |
| Loading state | When `isLoading`, skeleton shown, no row data |
| Empty state | When no data, empty state text shown |
| Long text | Truncated with ellipsis |

### 5.7 Snapshot tests — when to use

| Use | Don't use |
|-----|-----------|
| Static brand mark SVG | Table row content |
| Icon set baseline | Form with dynamic errors |
| Empty-state placeholder | Board card with work package data |
| Static docs page (markdown rendered to HTML) | Calendar with date math |
| Generated code (e.g., Prisma client types) | Anything that contains user data |

If a snapshot fails, **inspect the diff visually**, do not blindly update. Snapshots should be reviewed in the same way as code.

### 5.8 Mocking external dependencies in component tests

| Dependency | Mock strategy |
|------------|---------------|
| `next/router` | `vi.mock('next/router', () => ({ useRouter: () => mockRouter }))` — wrap in `vi.hoisted` |
| `next-auth` | MSW handler for `/api/auth/session` returning the desired session, OR `vi.mock('next-auth/react', factory)` |
| TanStack Query | `QueryClient` with `retry: false, gcTime: 0`; for tests that need specific query state, wrap with `setQueryData` |
| Zustand stores | Import the real store; reset with `useStore.setState(initial)` in `beforeEach` |
| `fetch` | **MSW** (see §6) |
| `IntersectionObserver`, `ResizeObserver` | jsdom polyfill in `setup.ts` |
| `matchMedia` | jsdom polyfill in `setup.ts` |
| `localStorage`, `sessionStorage` | jsdom built-in |
| `window.scrollTo` | `vi.fn()` in setup |
| HTML2Canvas / jsPDF | Stub via `vi.mock('html2canvas', () => ({ default: vi.fn() }))` |
| Recharts | Render `ResponsiveContainer` with fixed width/height in tests |
| Sentry | `vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))` |
| Upstash Redis / Ratelimit | `vi.mock` factories in API route tests |
| next/image | Pass `unoptimized` prop or stub in test |
| `dnd-kit` | Use real events; the library works in jsdom |

### 5.9 Component test template

```tsx
// src/components/WorkPackageRow.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { WorkPackageRow } from './WorkPackageRow'
import { buildWorkPackage } from '@/test/factories/work-package'

describe('<WorkPackageRow />', () => {
  const defaultProps = {
    wp: buildWorkPackage({ subject: 'Fix login bug' }),
    onSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the subject as accessible text', () => {
    renderWithProviders(<WorkPackageRow {...defaultProps} />)
    expect(screen.getByRole('row', { name: /fix login bug/i })).toBeInTheDocument()
  })

  it('invokes onSelect with the work package id when clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WorkPackageRow {...defaultProps} />)
    await user.click(screen.getByRole('row'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith(defaultProps.wp.id)
  })

  it('shows a closed-status icon when wp.status.isClosed is true', () => {
    const wp = buildWorkPackage({ isClosed: true })
    renderWithProviders(<WorkPackageRow {...defaultProps} wp={wp} />)
    expect(screen.getByLabelText(/closed/i)).toBeInTheDocument()
  })

  it('has no serious a11y violations', async () => {
    const { container } = renderWithProviders(<WorkPackageRow {...defaultProps} />)
    const results = await axe(container)
    const serious = results.violations.filter(v =>
      ['serious', 'critical'].includes(v.impact ?? '')
    )
    expect(serious).toEqual([])
  })
})
```

---

## 6. Hook Testing

### 6.1 The `renderHook` pattern

```tsx
// __tests__/hooks/use-work-packages.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestProviders } from '@/test/TestProviders'
import { useWorkPackages } from '@/hooks/use-work-packages'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

describe('useWorkPackages', () => {
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useWorkPackages('prj1'), {
      wrapper: TestProviders,
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('returns data on success', async () => {
    server.use(
      http.get('/api/projects/prj1/work-packages', () =>
        HttpResponse.json([{ id: 'wp1', subject: 'Test' }])
      )
    )
    const { result } = renderHook(() => useWorkPackages('prj1'), {
      wrapper: TestProviders,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('returns error state on 500', async () => {
    server.use(
      http.get('/api/projects/prj1/work-packages', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 })
      )
    )
    const { result } = renderHook(() => useWorkPackages('prj1'), {
      wrapper: TestProviders,
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })

  it('refetches on demand', async () => {
    const refetchSpy = vi.fn()
    server.use(
      http.get('/api/projects/prj1/work-packages', () => {
        refetchSpy()
        return HttpResponse.json([])
      })
    )
    const { result } = renderHook(() => useWorkPackages('prj1'), {
      wrapper: TestProviders,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    result.current.refetch()
    await waitFor(() => expect(refetchSpy).toHaveBeenCalledTimes(2))
  })
})
```

### 6.2 MSW (Mock Service Worker) — the recommended HTTP mock

**MSW is already installed (2.14.2) and used in `src/test/setup.ts` and `src/test/mocks/handlers.ts`.** This is correct and should be expanded.

Why MSW over alternatives:

| Alternative | Drawback |
|-------------|----------|
| `vi.spyOn(global, 'fetch')` | Brittle, doesn't handle `XMLHttpRequest`, can't share handlers |
| `nock` | Node-only, doesn't work for browser code |
| `msw` (chosen) | One handler tree for Node (vitest) and browser (component dev / storybook) — single source of truth |

### 6.3 Handler organization

```
src/test/mocks/
├── server.ts                     # setupServer(...handlers) for Node
├── browser.ts                    # setupWorker(...handlers) for browser/storybook
├── handlers/
│   ├── index.ts                  # exports combined array
│   ├── auth.ts                   # /api/auth/*
│   ├── projects.ts               # /api/projects/*
│   ├── work-packages.ts          # /api/projects/:id/work-packages/*
│   ├── wiki.ts
│   ├── forums.ts
│   ├── notifications.ts
│   ├── search.ts
│   ├── time-entries.ts
│   ├── users.ts
│   └── health.ts
├── MockDb.ts                     # in-memory data store
└── fixtures/
    ├── work-package.ts
    ├── project.ts
    ├── user.ts
    └── ...
```

Handlers are pure functions that read/write the in-memory `MockDb`. Tests can use `server.use(handlerOverride)` for per-test scenarios.

### 6.4 Test loading / error / success — the three states

Every hook test must cover at least:
- **Loading**: assert `isLoading` true, `data` undefined, `error` null
- **Success**: assert `isSuccess` true, `data` matches, `error` null
- **Error**: assert `isError` true, `error` defined, `data` undefined

Optional but recommended:
- **Empty**: success with `[]` (or empty object)
- **Stale-then-fresh**: `isFetching` toggles, no UI flash
- **Refetch on focus**: window blur/focus triggers refetch (use `vi.useFakeTimers` for debounce)
- **Cancel on unmount**: no state update after unmount (`act` + `unmount`)
- **Race condition**: slow first request superseded by fast second

### 6.5 Mutations

```tsx
describe('useCreateWorkPackage', () => {
  it('posts payload and invalidates the list query', async () => {
    const invalidateSpy = vi.fn()
    server.use(
      http.post('/api/projects/prj1/work-packages', () =>
        HttpResponse.json({ id: 'wp-new', subject: 'New' })
      )
    )
    const { result } = renderHook(
      () => {
        const qc = useQueryClient()
        return {
          mutation: useCreateWorkPackage('prj1'),
          spy: vi.spyOn(qc, 'invalidateQueries').mockImplementation(invalidateSpy),
        }
      },
      { wrapper: TestProviders }
    )
    await act(async () => {
      await result.current.mutation.mutateAsync({ subject: 'New' })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-packages', 'prj1'] })
  })
})
```

### 6.6 Optimistic updates

```tsx
it('optimistically inserts the new row and rolls back on error', async () => {
  server.use(
    http.post('/api/projects/prj1/work-packages', () =>
      HttpResponse.json({ error: 'forbidden' }, { status: 403 })
    )
  )
  const { result } = renderHook(() => useCreateWorkPackage('prj1'), {
    wrapper: TestProviders,
  })
  // Start with one existing WP
  act(() => qc.setQueryData(['work-packages', 'prj1'], [{ id: 'wp1' }]))
  try {
    await act(() => result.current.mutate({ subject: 'New' }))
  } catch {}
  // After error, list is back to one
  expect(qc.getQueryData(['work-packages', 'prj1'])).toEqual([{ id: 'wp1' }])
})
```

---

## 7. API Integration Testing

### 7.1 What integration tests cover (that unit tests don't)

- The route handler is **registered** at the correct path
- Next.js API method dispatch (GET vs POST) works
- The Zod schema actually validates the real body
- Prisma queries hit a real Postgres and return real shapes
- Auth middleware (`getServerSession`) reads cookies correctly
- RBAC helpers check the right role
- Error responses map to the right HTTP status
- Rate limiting engages
- CORS headers are present

### 7.2 Test database strategy

- Dedicated Postgres database: `openproject_rewrite_test`
- Created in CI: `createdb openproject_rewrite_test`
- Schema: `prisma migrate deploy` (not `db push` — use committed migrations)
- Seed: `npm run db:seed -- --env=test` with deterministic IDs
- **Reset between tests:** transaction rollback pattern (see 7.3)
- **Reset between CI runs:** truncate all tables in a global `beforeAll`

### 7.3 Transaction rollback (the right way)

```ts
// __tests__/api/integration/_setup.ts
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

let tx: PrismaClient | undefined

beforeAll(async () => {
  // Run migrations once
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
})

beforeEach(async () => {
  // Wrap each test in a transaction
  tx = await prisma.$transaction(async (client) => {
    // We can't actually pass `client` back to app code via the
    // module-singleton pattern; instead we use SAVEPOINT and the
    // `tx_id` cookie. The Prisma `$transaction` API is the wrong
    // primitive for this; use raw BEGIN/ROLLBACK.
    await prisma.$executeRawUnsafe('BEGIN')
    return client
  }, { timeout: 60000 })
  // Note: real implementation uses the wrapper below
})

afterEach(async () => {
  await prisma.$executeRawUnsafe('ROLLBACK')
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

The right pattern: a Prisma extension that wraps every query in a transaction tagged by `tx_id`. A new `tx_id` per test, then `ROLLBACK TO SAVEPOINT` in `afterEach`.

```ts
// __tests__/api/integration/_prisma-test-client.ts
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

export function makeTestPrisma(): PrismaClient {
  const txId = randomUUID()
  const base = new PrismaClient()
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        // Wrap in savepoint per operation, rollback in afterEach
        await base.$executeRawUnsafe(`SAVEPOINT ${txId}`)
        try {
          return await query(args)
        } catch (e) {
          await base.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${txId}`)
          throw e
        }
      },
    },
  }) as PrismaClient
}
```

### 7.4 The integration test runner

```ts
// __tests__/api/integration/projects.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testApiHandler } from 'next-test-api-route-handler'
import handler from '@/pages/api/projects/[id]'
import { makeTestPrisma, prisma } from './_prisma-test-client'
import { buildProject, buildUser, buildMembership } from '@/test/factories'

describe('GET /api/projects/[id] (integration)', () => {
  let testPrisma = makeTestPrisma()
  let project: Awaited<ReturnType<typeof prisma.project.create>>

  beforeEach(async () => {
    const owner = await testPrisma.user.create({ data: buildUser({ role: 'ADMIN' }) })
    project = await testPrisma.project.create({
      data: buildProject({ createdById: owner.id }),
    })
  })

  it('returns the project for an authenticated member', async () => {
    const user = await testPrisma.user.create({ data: buildUser() })
    await testPrisma.membership.create({ data: buildMembership(project.id, user.id, 'MEMBER') })

    await testApiHandler({
      appRouter: { handleRequest: undefined as any }, // not used
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: project.id }, cookies: { 'auth-session': makeSessionCookie(user.id) } })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBe(project.id)
      },
    })
  })

  it('returns 401 when unauthenticated', async () => {
    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: project.id } })
        expect(res.status).toBe(401)
      },
    })
  })

  it('returns 403 when authenticated but not a member', async () => {
    const otherUser = await testPrisma.user.create({ data: buildUser() })
    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: project.id }, cookies: { 'auth-session': makeSessionCookie(otherUser.id) } })
        expect(res.status).toBe(403)
      },
    })
  })

  it('returns 404 when project does not exist', async () => {
    const user = await testPrisma.user.create({ data: buildUser() })
    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: 'nonexistent' }, cookies: { 'auth-session': makeSessionCookie(user.id) } })
        expect(res.status).toBe(404)
      },
    })
  })

  it('rejects invalid id with 400', async () => {
    const user = await testPrisma.user.create({ data: buildUser() })
    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: 'not-a-cuid' }, cookies: { 'auth-session': makeSessionCookie(user.id) } })
        expect(res.status).toBe(400)
      },
    })
  })
})
```

### 7.5 Cases every API route must cover

For each route in `pages/api/**`:

| Case | Expected |
|------|----------|
| Method not allowed | 405 |
| Unauthenticated | 401 (unless public route) |
| Authenticated but no permission | 403 |
| Valid request, happy path | 200/201 + correct body |
| Invalid body (Zod fail) | 400 + error list |
| Resource not found | 404 |
| Conflict (unique constraint) | 409 |
| Rate limited | 429 |
| Internal server error (forced) | 500 + no stack trace leaked |
| Pagination (limit/offset) | correct slice + total |
| Sorting & filtering | correct order & subset |

### 7.6 RBAC matrix test

Generate the (role × resource × action) matrix programmatically and assert the response code for each cell. Use a snapshot of the matrix in `__tests__/api/integration/_rbac-matrix.test.ts`.

```ts
const matrix = [
  // [role, action, resource, expectedStatus]
  ['ADMIN', 'delete', 'project', 200],
  ['MEMBER', 'delete', 'project', 403],
  ['VIEWER', 'read',   'project', 200],
  ['ANON',  'read',   'project', 401],
  // ... 50+ rows
]
```

### 7.7 HTTP testing with `fetch` in Node

The existing `__tests__/api/routes-integration.test.ts` uses native `fetch` against `http://localhost:3001`. This requires the dev server to be running — fragile. Recommendation:

- **Primary**: use `next-test-api-route-handler` (already a dependency) — instant, no server
- **Secondary**: a smoke test that hits a real dev server, run in CI as a separate job that boots `next dev` first
- **Deprecated**: keep `routes-integration.test.ts` only as a smoke when needed; remove the exclude pattern from `vitest.config.ts` and let it run with a guard

---

## 8. End-to-End Testing (Playwright)

### 8.1 Install the missing pieces

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium firefox webkit
```

`playwright.config.ts` (new):

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'coverage/e2e-junit.xml' }]]
    : 'html',
  outputDir: './test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run build && npm start',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
})
```

### 8.2 Page Object Model (POM)

```
e2e/
├── pages/
│   ├── BasePage.ts                 # common helpers (nav, toast, confirm dialogs)
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── ProjectListPage.ts
│   ├── ProjectDetailPage.ts
│   ├── ProjectSettingsPage.ts
│   ├── WorkPackageTablePage.ts
│   ├── WorkPackageDetailPage.ts
│   ├── WorkPackageBoardPage.ts
│   ├── WorkPackageGanttPage.ts
│   ├── WorkPackageCalendarPage.ts
│   ├── WikiPageListPage.ts
│   ├── WikiPageEditorPage.ts
│   ├── WikiVersionHistoryPage.ts
│   ├── ForumListPage.ts
│   ├── ForumThreadPage.ts
│   ├── NotificationCenterPage.ts
│   ├── AdminPage.ts
│   └── TimeTrackingPage.ts
├── fixtures/
│   ├── users.ts                    # seed + sign-in helpers
│   ├── projects.ts
│   ├── work-packages.ts
│   └── factories.ts                # re-exports for E2E (no faker; use Prisma seed)
├── journeys/                       # the 20 critical flows (see §9)
│   ├── 01-signup-to-close-wp.spec.ts
│   ├── 02-forum-thread-watch.spec.ts
│   └── ...
├── visual/                         # screenshot baselines
│   ├── board-baseline.spec.ts
│   └── ...
├── helpers/
│   ├── auth.ts                     # signInAs(role)
│   ├── api.ts                      # direct fetch for setup
│   └── db.ts                       # pg admin: reset between specs
└── playwright.config.ts
```

**Page Object contract:** every page class exposes semantic methods (`clickSave`, `fillTitle`, `expectVisible`), not raw selectors. Locators are private to the page. Tests read like user stories.

```ts
// e2e/pages/WorkPackageTablePage.ts
import { Page, Locator, expect } from '@playwright/test'

export class WorkPackageTablePage {
  constructor(private page: Page) {}

  get rows(): Locator {
    return this.page.getByRole('row').filter({ hasNot: this.page.getByRole('columnheader') })
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/work-packages/table`)
    await expect(this.page.getByRole('heading', { name: /work packages/i })).toBeVisible()
  }

  async filterByStatus(status: string) {
    await this.page.getByRole('combobox', { name: /status/i }).selectOption(status)
    await expect(this.page.getByText(/loading/i)).toBeHidden()
  }

  async expectRowCount(n: number) {
    await expect(this.rows).toHaveCount(n)
  }
}
```

### 8.3 Test data factories for E2E

E2E tests should **not** generate data via the UI for setup. Use direct API/Prisma calls to seed, then drive the UI for the actual flow.

```ts
// e2e/fixtures/projects.ts
import { prisma } from './db'
import { buildProject, buildMembership } from '@/test/factories'

export async function seedProject(opts: { withMembers?: number } = {}) {
  const owner = await prisma.user.create({ data: { email: `owner-${Date.now()}@test.local`, /* ... */ } })
  const project = await prisma.project.create({ data: buildProject({ createdById: owner.id }) })
  if (opts.withMembers) {
    for (let i = 0; i < opts.withMembers; i++) {
      const u = await prisma.user.create({ data: { email: `m${i}-${Date.now()}@test.local`, /* ... */ } })
      await prisma.membership.create({ data: buildMembership(project.id, u.id, 'MEMBER') })
    }
  }
  return { owner, project }
}
```

### 8.4 Parallel execution & sharding

```yaml
# CI sharding
- name: E2E (shard 1/4)
  run: npx playwright test --shard=1/4
- name: E2E (shard 2/4)
  run: npx playwright test --shard=2/4
- name: E2E (shard 3/4)
  run: npx playwright test --shard=3/4
- name: E2E (shard 4/4)
  run: npx playwright test --shard=4/4
```

`--shard=N/M` evenly distributes tests across M parallel runners. Combined with `fullyParallel: true`, total runtime drops ~4×.

### 8.5 Flake prevention — the 10 commandments

1. **No `waitForTimeout(N)`.** Use `expect(locator).toBeVisible()` or `locator.waitFor({ state: 'attached' })`.
2. **Prefer user-facing assertions over DOM checks.** `getByRole`, `getByText`, `getByLabelText`.
3. **Auto-retry on transient errors.** Configure `retries: 2` in CI.
4. **Capture diagnostic on failure.** `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`, `video: 'retain-on-failure'`.
5. **Isolate test data.** Each spec uses a unique `project-${uuid}` so concurrent runs don't collide.
6. **Reset DB state between specs.** `test.beforeEach` runs `TRUNCATE` on the test schema (in E2E DB only; not the test integration DB).
7. **Don't depend on time of day.** Use `vi.useFakeTimers` or seed dates explicitly.
8. **Don't depend on email delivery.** Use a test SMTP catcher (Mailhog / Mailpit) or assert against `outbox` table.
9. **Don't depend on external services.** Mock Stripe, Resend, LDAP, S3 via MSW (browser mode).
10. **Quarantine, don't hide.** A flake goes to a `quarantine/` folder with a `quarantineReason` annotation; the CI job runs the quarantine suite with retries=5 to see if it's stable.

### 8.6 Authentication in E2E

```ts
// e2e/helpers/auth.ts
import { Page, expect } from '@playwright/test'
import { prisma } from './db'

export async function signInAs(page: Page, email: string) {
  // Direct DB: insert a verified session token, set cookie
  const sessionToken = await createTestSession(email)
  await page.context().addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
  // Optionally also navigate to confirm
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
}
```

Avoid going through the real OAuth flow in CI; the cookie injection pattern is industry standard and ~100× faster.

### 8.7 Visual regression subset

Visual specs run in the `chromium` project only (baseline = 1×), fail on >0.1% pixel diff. Specs tagged `@visual` skip the parallel pool.

```ts
test('board view baseline', { tag: '@visual' }, async ({ page }) => {
  await setupProjectWithWorkPackages(page, 25)
  await page.goto('/projects/prj1/work-packages/board')
  await expect(page).toHaveScreenshot('board-25wps.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.001,
    animations: 'disabled',
  })
})
```

---

## 9. Critical User Journeys — Top 20

The 20 E2E tests that catch the most regressions per minute of CI time. Each is one spec file under `e2e/journeys/`. Order is priority (P0 first).

| # | Journey | Spec name | Catches |
|---|---------|-----------|---------|
| 1 | **Sign up → verify email → first login** | `01-signup-verify-first-login.spec.ts` | Email flow, NextAuth, user creation, redirect rules |
| 2 | **Create project → add 3 members with different roles** | `02-create-project-add-members.spec.ts` | Project CRUD, membership, RBAC, invitations |
| 3 | **Create work package → assign → comment → close** | `03-wp-lifecycle.spec.ts` | WP CRUD, assignment, comments, status transitions |
| 4 | **Bulk edit 10 work packages → status change** | `04-wp-bulk-edit.spec.ts` | Bulk actions, RBAC, audit log |
| 5 | **Board view drag-drop column move → WIP limit enforcement** | `05-board-wip-limit.spec.ts` | DnD, WIP, optimistic UI, server reconciliation |
| 6 | **Gantt: create dependency → chart renders dependency line** | `06-gantt-dependency.spec.ts` | Relations, Gantt chart correctness |
| 7 | **Calendar: drag WP to next week → due date updated** | `07-calendar-drag-reschedule.spec.ts` | Calendar DnD, date math, WP update |
| 8 | **Wiki: create page → edit → view diff → revert** | `08-wiki-edit-diff-revert.spec.ts` | Markdown, version history, revert |
| 9 | **Forum: create thread → reply → watch → email** | `09-forum-thread-watch-email.spec.ts` | Forums, notifications, email |
| 10 | **Notifications: receive 5 → mark all read → preferences** | `10-notification-center.spec.ts` | Notification aggregation, prefs page |
| 11 | **Time tracking: log 4h → weekly view → export** | `11-time-tracking-export.spec.ts` | Time entries, sums, CSV export |
| 12 | **Search: full-text across WP/wiki/forums** | `12-global-search.spec.ts` | Search index, ranking, pagination |
| 13 | **Saved query: create → share → another user opens** | `13-saved-query-share.spec.ts` | Persistence, sharing, RBAC on query |
| 14 | **News: post → comment → email subscribers** | `14-news-comment-email.spec.ts` | News, comments, notifications |
| 15 | **Documents: upload PDF → share → download** | `15-document-upload-share.spec.ts` | S3 (or local), ACL, download URL signing |
| 16 | **Meeting: schedule → agenda → minutes → action items → close** | `16-meeting-lifecycle.spec.ts` | Meetings, action items → WP |
| 17 | **RBAC: viewer tries to edit → blocked; admin can** | `17-rbac-edit-attempt.spec.ts` | RBAC enforcement end-to-end |
| 18 | **2FA: enable TOTP → login requires code → backup code recovery** | `18-2fa-totp-backup.spec.ts` | 2FA flow, otplib, backup codes |
| 19 | **Admin: invite user → LDAP sync (mock) → role assignment** | `19-admin-ldap-sync.spec.ts` | LDAP, admin pages, role assignment |
| 20 | **Error & empty states: zero projects, 0 WP, network offline** | `20-empty-error-states.spec.ts` | UX edge cases, error boundaries, offline handling |

**Smoke subset (run on every PR, ~2 min):** 1, 3, 5, 8, 10, 17.
**Full E2E (run on main + nightly):** all 20.

### 9.1 Example journey spec

```ts
// e2e/journeys/03-wp-lifecycle.spec.ts
import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { seedProject, addMember } from '../fixtures/projects'
import { WorkPackageTablePage } from '../pages/WorkPackageTablePage'
import { WorkPackageDetailPage } from '../pages/WorkPackageDetailPage'

test('J03: create → assign → comment → close', async ({ page, request }) => {
  const { owner, project } = await seedProject({ withMembers: 1 })
  const assignee = (await prisma.membership.findFirst({
    where: { projectId: project.id, userId: { not: owner.id } },
    include: { user: true },
  }))!.user

  await signInAs(page, owner.email)

  const table = new WorkPackageTablePage(page)
  await table.goto(project.id)

  await table.createWorkPackage({ subject: 'Fix login bug', type: 'Task' })

  const detail = new WorkPackageDetailPage(page)
  await detail.expectOpened('Fix login bug')

  await detail.assignTo(assignee.email)
  await detail.addComment('Investigating root cause.')
  await detail.changeStatus('In progress')
  await detail.changeStatus('Closed')

  await expect(page.getByText(/closed/i)).toBeVisible()

  // Verify the assignee gets a notification
  const notifs = await request.get('/api/notifications', {
    headers: { cookie: (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join('; ') },
  })
  const list = await notifs.json()
  expect(list.find((n: any) => n.workPackageId === 'wp-1' && n.type === 'ASSIGNED')).toBeTruthy()
})
```

---

## 10. Visual Regression

### 10.1 Layered approach

| Layer | Tool | Coverage |
|-------|------|----------|
| **Screenshot diff** | Playwright `toHaveScreenshot()` | All top-level pages, all view modes (table/board/gantt/calendar), all major component states |
| **Component snapshots** (Storybook) | Chromatic | Every exported component, every variant, every state |
| **Cross-browser** | Playwright projects (chromium, firefox, webkit) | Critical pages only (5-10) |

### 10.2 Baseline management

- Baselines stored in `e2e/visual/snapshots/` (git-tracked)
- `npx playwright test --update-snapshots` to regenerate after an intentional UI change
- **Review every diff in PR** — same rigor as code review
- Stable environment: disable animations (`animations: 'disabled'`), set viewport, use system font

### 10.3 What to baseline

| Screen | Variants |
|--------|----------|
| Login | default, error, loading |
| Dashboard | empty (new user), populated |
| Project list | empty, 1 project, 50 projects (pagination) |
| Project detail | member view, non-member view |
| Work package table | empty, 1 row, 100 rows (virtualization) |
| Work package board | empty, 5 columns, drag-in-progress |
| Work package Gantt | empty, 10 tasks, dependency arrows |
| Work package calendar | empty, month view, week view |
| Work package detail | open, closed, overdue |
| Wiki editor | new page, edit existing, preview |
| Forum thread | empty, with replies |
| Notification center | empty, 10 unread, 0 unread |
| Admin | user list, role list, project settings |
| Mobile | dashboard, WP table (responsive) |

Total baseline: ~30 screenshots. Update cycle: ~1 per 2 weeks.

### 10.4 Chromatic (recommended addition)

```bash
npm i -D chromatic
```

```yaml
# .github/workflows/visual.yml
- uses: chromaui/action@latest
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    buildScriptName: 'build-storybook'
    exitOnceUploaded: true
```

Storybook stories already exist for many components (e.g., `wiki-components`); extend to all components in `src/components/`.

---

## 11. Performance Testing (k6)

### 11.1 Current state

```
k6/
└── scenarios/
    ├── load.ts   # 50 VUs ramping
    └── smoke.ts  # 5 VUs constant
```

**Gap analysis:**
- No auth flow load (k6 doesn't handle OAuth easily)
- No write-path load (mutations, especially WP creation)
- No spike test
- No soak test (memory leak detection)
- No DB query benchmarks (would be Postgres `EXPLAIN ANALYZE` scripts)
- No thresholds per endpoint
- Not wired into CI

### 11.2 Proposed scenarios

```
k6/
├── scenarios/
│   ├── smoke.ts            # 5 VUs, 1m, every PR
│   ├── load.ts             # 50 VUs ramping, every main + nightly
│   ├── stress.ts           # 200 VUs ramp, nightly
│   ├── spike.ts            # 0→500 VUs in 10s, nightly
│   ├── soak.ts             # 30 VUs, 1h, weekly
│   ├── api-read.ts         # GET endpoint sweep
│   ├── api-write.ts        # POST/PATCH/DELETE mix
│   ├── wp-board-load.ts    # 100 VUs hitting board endpoint
│   └── search-load.ts      # 50 VUs hammering /api/search
├── lib/
│   ├── auth.js             # login + session cookie extraction
│   ├── endpoints.js        # endpoint catalog
│   └── data.js             # test data refs
└── thresholds.json         # central thresholds for all scenarios
```

### 11.3 Example load scenario (improved)

```ts
// k6/scenarios/load.ts
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { login } from '../lib/auth.js'

const errorRate = new Rate('errors')
const apiDuration = new Trend('api_duration')
const wpCreate = new Counter('wp_created')

export const options = {
  scenarios: {
    read_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'read' },
      exec: 'readScenario',
    },
    write_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },   // writes scale lower
        { duration: '5m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'write' },
      exec: 'writeScenario',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{endpoint:work-packages}': ['p(95)<300'],
    'http_req_duration{endpoint:board}': ['p(95)<600'],
    'http_req_duration{endpoint:search}': ['p(95)<800'],
    errors: ['rate<0.05'],
  },
}

const BASE = __ENV.STAGING_URL || 'http://localhost:3000'
let sessionCookie = ''

export function setup() {
  sessionCookie = login(__ENV.TEST_USER, __ENV.TEST_PASSWORD)
  return { sessionCookie }
}

export function readScenario(data) {
  const endpoints = [
    '/api/projects',
    '/api/work-packages',
    '/api/statuses',
    '/api/types',
    '/api/notifications',
  ]
  for (const ep of endpoints) {
    const res = http.get(BASE + ep, { headers: { cookie: data.sessionCookie } })
    apiDuration.add(res.timings.duration, { endpoint: ep.replace('/api/', '') })
    errorRate.add(res.status !== 200)
  }
  sleep(1)
}

export function writeScenario(data) {
  const payload = JSON.stringify({
    subject: `k6 WP ${__VU}-${__ITER}`,
    projectId: __ENV.TEST_PROJECT_ID,
    typeId: __ENV.TEST_TYPE_ID,
    statusId: __ENV.TEST_STATUS_ID,
  })
  const res = http.post(BASE + '/api/work-packages', payload, {
    headers: { 'content-type': 'application/json', cookie: data.sessionCookie },
  })
  wpCreate.add(1)
  errorRate.add(res.status !== 201)
  sleep(2)
}
```

### 11.4 CI integration

```yaml
# .github/workflows/perf.yml
on:
  schedule: [{ cron: '0 2 * * *' }]   # nightly
  workflow_dispatch:
jobs:
  k6-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: k6/scenarios/smoke.ts
          flags: --out json=smoke.json
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: smoke.json
  k6-load:
    needs: k6-smoke
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: test } }
    steps:
      - run: npm ci && npm run build && npm start &
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: k6/scenarios/load.ts
```

### 11.5 Database query benchmarks

In `prisma/benchmarks/`:
- `work-package-list.sql` — `EXPLAIN ANALYZE` of the WP list query
- `gantt-data.sql` — date-range join benchmarks
- `search.sql` — full-text search query
- `notifications-aggregate.sql` — notification rollup

Run with `pgbench`-style scripts in CI; fail if p95 regresses > 20% vs. main.

### 11.6 Front-end performance budgets

- LCP < 2.5s on 4G/Moto G4
- FID < 100ms
- CLS < 0.1
- Total JS < 250KB gzipped on `/dashboard`
- Lighthouse CI in the Playwright project, asserted against thresholds

```yaml
# .github/workflows/lighthouse.yml
- uses: treosh/lighthouse-ci-action@v11
  with:
    urls: |
      http://localhost:3000/
      http://localhost:3000/dashboard
      http://localhost:3000/projects/prj1/work-packages/table
    budgetPath: ./lighthouse-budget.json
    uploadArtifacts: true
```

---

## 12. Accessibility Testing

### 12.1 Three layers

| Layer | Tool | Where | Asserts |
|-------|------|-------|---------|
| **Component (unit/integration)** | `vitest-axe` (jest-axe for vitest) | `*.test.tsx` | Per-component, 0 serious/critical |
| **Page (E2E)** | `@axe-core/playwright` | E2E | Per-page, 0 serious/critical, on key user flows |
| **Site-wide (CI nightly)** | `pa11y-ci` | Full crawl | WCAG 2.1 AA across all routes |

### 12.2 Component-level axe (proposed addition)

```bash
npm i -D vitest-axe
```

```ts
// src/components/Button.test.tsx
import { axe } from 'vitest-axe'

it('has no a11y violations', async () => {
  const { container } = renderWithProviders(<Button>Save</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### 12.3 E2E axe

```ts
// e2e/helpers/a11y.ts
import { AxeBuilder } from '@axe-core/playwright'

export async function expectNoA11yViolations(page: Page, options: { tags?: string[] } = {}) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  const results = await builder.analyze()
  const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  if (blocking.length) {
    console.error(JSON.stringify(blocking, null, 2))
  }
  expect(blocking).toEqual([])
}
```

Used in every journey spec after the final assertion:
```ts
await expectNoA11yViolations(page)
```

### 12.4 Pa11y CI

```json
// .pa11yci.json
{
  "defaults": {
    "timeout": 30000,
    "standard": "WCAG2.1AA",
    "runners": ["axe", "htmlcs"]
  },
  "urls": [
    "http://localhost:3000/",
    "http://localhost:3000/login",
    "http://localhost:3000/dashboard",
    "http://localhost:3000/projects",
    "http://localhost:3000/projects/prj1",
    "http://localhost:3000/projects/prj1/work-packages/table",
    "http://localhost:3000/projects/prj1/work-packages/board",
    "http://localhost:3000/projects/prj1/work-packages/gantt",
    "http://localhost:3000/projects/prj1/work-packages/calendar",
    "http://localhost:3000/projects/prj1/wiki",
    "http://localhost:3000/forums",
    "http://localhost:3000/notifications"
  ]
}
```

```yaml
# .github/workflows/a11y.yml
- run: npx pa11y-ci --config .pa11yci.json
```

### 12.5 Manual a11y checklist (per release)

- [ ] Tab order is logical on every page
- [ ] All interactive elements have visible focus styles
- [ ] Forms have associated labels (no orphan inputs)
- [ ] Color contrast ≥ 4.5:1 (text) and 3:1 (UI)
- [ ] Modals trap focus and restore on close
- [ ] Toast / alert region is `role="status"` or `role="alert"`
- [ ] Dynamic content changes are announced (`aria-live`)
- [ ] Drag-and-drop has keyboard alternative
- [ ] Color is not the only signal (status uses icon + text)
- [ ] All images have `alt` (decorative = `alt=""`)

---

## 13. Security Testing

### 13.1 Layered approach

| Layer | Tool | Frequency |
|-------|------|-----------|
| **Dependency audit** | `npm audit --audit-level=high` | Every PR |
| **SAST** | CodeQL | Every PR |
| **Secret scanning** | `gitleaks` | Every PR |
| **DAST baseline** | OWASP ZAP | Nightly + per release |
| **License compliance** | `license-checker` | Every PR |
| **Container scan** | Trivy (when Dockerized) | Per image build |

### 13.2 OWASP ZAP baseline

```yaml
# .github/workflows/zap.yml
name: OWASP ZAP Baseline
on: [schedule, workflow_dispatch]
jobs:
  zap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start app
        run: |
          docker compose up -d
          npx wait-on http://localhost:3000/health
      - name: ZAP Baseline
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a -m 5 -T 60'
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: zap-report
          path: report_html.html
```

### 13.3 Snyk integration

```yaml
- uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high --fail-on=all
```

### 13.4 Security tests in the test suite

Beyond scanning, **security tests live in `__tests__/security/`** and assert:

- SQL injection: `' OR 1=1--` is rejected on every input field
- XSS: `<script>alert(1)</script>` is sanitized in WP subject, wiki content, forum posts
- CSRF: state-changing endpoints reject requests without valid CSRF token
- Auth bypass: `getServerSession` is called on every protected route
- IDOR: a user with no membership cannot read/write a project by guessing the ID
- Mass assignment: `POST /api/users` ignores `role: 'ADMIN'` if not authorized
- File upload: only allowlisted MIME types accepted; filename sanitized
- Path traversal: `../` in file references rejected
- Rate limit: 1000 requests/min from one IP returns 429

```ts
// __tests__/security/sql-injection.test.ts
import { testApiHandler } from 'next-test-api-route-handler'
import handler from '@/pages/api/projects/[id]'

it('rejects SQL injection in id', async () => {
  await testApiHandler({
    pagesHandler: handler,
    test: async ({ fetch }) => {
      const res = await fetch({
        method: 'GET',
        query: { id: "1' OR '1'='1" },
        cookies: { 'auth-session': adminSession },
      })
      expect(res.status).toBe(400)  // Zod rejects
    },
  })
})
```

### 13.5 Threat-model coverage matrix

| Threat | Test location | Status |
|--------|---------------|--------|
| SQLi | `__tests__/security/sql-injection.test.ts` | New |
| Stored XSS in WP | `__tests__/security/xss-work-package.test.ts` | New |
| Reflected XSS in search | `__tests__/security/xss-search.test.ts` | New |
| CSRF on POST | covered by NextAuth CSRF in integration | Existing |
| IDOR | `__tests__/security/idor.test.ts` | New |
| Privilege escalation | `__tests__/security/rbac-escalation.test.ts` | New |
| File upload abuse | `__tests__/security/upload.test.ts` | New |
| Open redirect (OAuth callback) | `__tests__/security/oauth-redirect.test.ts` | New |
| Session fixation | E2E `18-2fa-totp-backup.spec.ts` extends | Extend |
| Timing attack on login | `__tests__/security/auth-timing.test.ts` | New |
| Password reset poisoning | `__tests__/security/reset-poison.test.ts` | New |
| Rate limit bypass | `__tests__/security/rate-limit.test.ts` | New |
| 2FA bypass | `__tests__/security/2fa-bypass.test.ts` | New |

---

## 14. Mutation Testing (Stryker)

### 14.1 Setup

```bash
npm i -D @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
```

`stryker.config.json`:
```json
{
  "$schema": "https://stryker-mutator.io/schema/stryker.config.json",
  "packageManager": "npm",
  "runner": "vitest",
  "testRunner": "vitest",
  "reporters": ["html", "json", "github"],
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/lib/**/*.ts",
    "src/hooks/**/*.ts",
    "src/stores/**/*.ts",
    "src/services/**/*.ts",
    "!src/lib/auth.ts",
    "!src/lib/crypto.ts"
  ],
  "ignorePatterns": ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  }
}
```

### 14.2 What Stryker catches that coverage doesn't

A line can be 100% covered (executed) and still be wrong:
```ts
if (user.role === 'ADMIN') {  // killed: change to !== → test fails ✓
  return canDelete(user)
} else {
  return false  // killed: change to true → test fails ✓
}
```

A test that asserts `canDelete(admin) === true` and `canDelete(member) === false` survives coverage but dies under mutation.

### 14.3 CI integration

Run Stryker **only on touched files** in the PR:
```yaml
- name: Detect changed files
  id: changed
  run: |
    CHANGED=$(git diff --name-only origin/main -- 'src/**/*.{ts,tsx}' | grep -v test)
    echo "files=$CHANGED" >> $GITHUB_OUTPUT
- name: Stryker (incremental)
  if: steps.changed.outputs.files != ''
  run: npx stryker run --mutate ${{ steps.changed.outputs.files }}
```

### 14.4 Score target

- **High (80%+)** on security-critical code (`auth.ts`, `rbac/`, `crypto.ts`, `pages/api/auth/**`)
- **Low (60%+)** on general lib code
- **Break (50%)** — PR fails below this

---

## 15. Test Data Management

### 15.1 Factories (custom, no factory-bot dep)

We use a custom factory pattern (no `factory-bot` dep to keep the bundle small):

```ts
// __tests__/factories/index.ts
import { faker } from '@faker-js/faker'
import type { Prisma } from '@prisma/client'

type Overrides<T> = Partial<T>

export function buildProject(overrides: Overrides<Prisma.ProjectCreateInput> = {}): Prisma.ProjectCreateInput {
  return {
    name: faker.company.name(),
    identifier: faker.string.alphanumeric(8).toLowerCase(),
    description: faker.lorem.paragraph(),
    status: 'active',
    public: false,
    createdBy: { connect: { id: faker.string.cuid() } },
    ...overrides,
  }
}

export function buildWorkPackage(overrides: Overrides<Prisma.WorkPackageCreateInput> = {}): Prisma.WorkPackageCreateInput {
  return {
    subject: faker.hacker.phrase(),
    description: faker.lorem.paragraph(),
    startDate: faker.date.recent(),
    dueDate: faker.date.future(),
    estimatedTime: faker.number.int({ min: 1, max: 40 }),
    project: { connect: { id: faker.string.cuid() } },
    type: { connect: { id: faker.string.cuid() } },
    status: { connect: { id: faker.string.cuid() } },
    priority: { connect: { id: faker.string.cuid() } },
    author: { connect: { id: faker.string.cuid() } },
    ...overrides,
  }
}

export function buildUser(overrides: Overrides<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  return {
    email: faker.internet.email().toLowerCase(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password: faker.internet.password({ length: 16 }),
    role: 'USER',
    ...overrides,
  }
}

export function buildMembership(overrides: Overrides<Prisma.MembershipCreateInput> = {}): Prisma.MembershipCreateInput {
  return {
    project: { connect: { id: faker.string.cuid() } },
    user: { connect: { id: faker.string.cuid() } },
    roles: { connect: [{ id: faker.string.cuid() }] },
    ...overrides,
  }
}
```

**Why not factory-bot:** adds 80KB+ to dev deps, requires async by default, doesn't compose well with TypeScript discriminated unions, and Prisma's typed `CreateInput` is already a near-perfect factory.

### 15.2 Faker.js setup

```bash
npm i -D @faker-js/faker
```

In `src/test/setup.ts`:
```ts
import { faker } from '@faker-js/faker'
faker.seed(42)  // deterministic across runs
```

**Deterministic faker** is critical: it makes flaky tests reproducible. Re-seed at the top of any test that needs determinism.

### 15.3 Seed scripts

`prisma/seed.ts` is the canonical seed for dev. For tests:

```
prisma/seed-test/
├── 00-baseline.ts        # roles, types, statuses, priorities
├── 10-users.ts           # 5 users (admin, member, viewer, anon, owner)
├── 20-projects.ts        # 3 projects
├── 30-memberships.ts     # role assignments
├── 40-work-packages.ts   # 50 WPs across projects
├── 50-wiki.ts            # 10 wiki pages
├── 60-forums.ts          # 5 forums, 20 threads
└── 99-index.ts           # runs all
```

Run with: `tsx prisma/seed-test/99-index.ts`

### 15.4 Test DB snapshot

For E2E:
- **Cold start**: empty DB → seed-test runs
- **Reset between specs**: `TRUNCATE` all tables, re-seed minimal data per spec
- **For stateful specs**: snapshot/restore using `pg_dump`/`pg_restore` of a "golden" state

```ts
// e2e/helpers/db.ts
import { execSync } from 'child_process'
import { Client } from 'pg'

export async function resetDb() {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL })
  await client.connect()
  await client.query(`
    TRUNCATE
      "WorkPackage", "Project", "User", "Membership",
      "WikiPage", "Forum", "ForumThread", "Notification"
    RESTART IDENTITY CASCADE
  `)
  await client.end()
}
```

---

## 16. CI/CD Integration

### 16.1 Required checks (merge gates)

| Check | Tool | When | Block merge? |
|-------|------|------|--------------|
| Type check | `tsc --noEmit` | every PR | ✅ |
| Lint | `eslint` | every PR | ✅ |
| Format | `prettier --check` | every PR | ✅ |
| Unit + integration tests | `vitest run` | every PR | ✅ |
| Coverage threshold | vitest + Codecov | every PR | ✅ (delta < -0.5%) |
| E2E smoke (chromium) | `playwright test --grep @smoke` | every PR | ✅ |
| E2E full (chromium + ff + webkit) | `playwright test` | every main + nightly | ✅ (main only) |
| Build | `next build` | every PR | ✅ |
| Snyk / npm audit | Snyk | every PR | ✅ (high+) |
| CodeQL | GitHub | every PR | ✅ (alert) |
| Visual regression | Playwright + Chromatic | every main | ⏳ best-effort |
| a11y (pa11y-ci) | pa11y-ci | nightly | ⏳ best-effort |
| Performance (k6 smoke) | k6 | every main | ⏳ best-effort |
| Mutation (incremental) | Stryker | every PR (touched files) | ⏳ best-effort |
| ZAP baseline | OWASP ZAP | nightly | ⏳ best-effort |

### 16.2 Workflow structure

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npx prettier --check .
  unit:
    needs: static
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: openproject_rewrite_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s
    env:
      DATABASE_URL: postgresql://postgres:test@localhost:5432/openproject_rewrite_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npx tsx prisma/seed-test/99-index.ts
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v4
        with: { file: coverage/lcov.info, fail_ci_if_error: true }
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: coverage, path: coverage/ }
  e2e-smoke:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - name: Run smoke
        run: npx playwright test --grep @smoke
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
  e2e-full:
    needs: unit
    if: github.event_name == 'push' || github.event_name == 'schedule'
    runs-on: ubuntu-latest
    strategy: { fail-fast: false, matrix: { shard: [1, 2, 3, 4] } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-shard-${{ matrix.shard }}, path: test-results/ }
  mutation:
    needs: unit
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Touched files
        id: t
        run: |
          FILES=$(git diff --name-only origin/main -- 'src/**/*.{ts,tsx}' | grep -v test | tr '\n' ',')
          echo "files=$FILES" >> $GITHUB_OUTPUT
      - run: npx stryker run --mutate "${{ steps.t.outputs.files }}"
        if: steps.t.outputs.files != ''
```

### 16.3 Required status checks (branch protection)

In GitHub Settings → Branches → main → Require status checks to pass:
- `static / lint`
- `static / typecheck`
- `unit / test`
- `unit / coverage`
- `e2e-smoke / playwright`

### 16.4 Failure artifact strategy

- Vitest: `coverage/` (always) + JUnit `coverage/junit.xml`
- Playwright: `playwright-report/` (always) + `test-results/` on failure (traces, videos, screenshots)
- Codecov: delta graph in PR comment
- Snyk: PR comment with vulnerability list
- ZAP: `report_html.html` on nightly

### 16.5 Coverage reporting to Codecov

`codecov.yml`:
```yaml
codecov:
  require_ci_to_pass: true
  notify:
    after_n_builds: 4
coverage:
  precision: 2
  round: down
  range: "70...90"
  status:
    project:
      default:
        target: 80%
        threshold: 0.5%
    patch:
      default:
        target: 80%
        threshold: 0%
```

---

## 17. Test Debugging & Tooling

### 17.1 Local debugging toolkit

| Tool | Command | Use |
|------|---------|-----|
| Vitest UI | `npm run test:ui` | Time-travel, filter, watch |
| Vitest debug | `node --inspect-brk ./node_modules/.bin/vitest` | Chrome DevTools |
| Playwright UI | `npx playwright test --ui` | Time-travel, trace inspection |
| Playwright trace viewer | `npx playwright show-trace test-results/.../trace.zip` | Step-by-step replay |
| Playwright codegen | `npx playwright codegen http://localhost:3000` | Record selectors |
| VSCode Vitest ext. | Test Explorer | Run/debug from sidebar |
| VSCode Playwright ext. | "Testing" sidebar | Run/debug E2E |
| `vitest --reporter=verbose` | Verbose output | See every assertion |

### 17.2 Debugging a flake

1. **Reproduce locally:** `npm test -- --repeat=10 src/lib/auth.test.ts`
2. **Inspect the failure:** `npm run test:ui`, click the failed assertion
3. **Look at the state:** add `screen.debug()` (RTL) or `console.log(page.locator('...').all())` (Playwright)
4. **Check for shared state:** `grep -r "vi.fn()" src/lib/auth.test.ts` and ensure mocks reset in `beforeEach`
5. **Time the test:** `vitest run --reporter=verbose src/lib/auth.test.ts` — if it's close to the timeout, fix the slowness
6. **Disable parallelism:** `poolOptions.threads.singleThread: true` — if the flake goes away, it's a shared-state issue

### 17.3 VSCode configuration

`.vscode/settings.json`:
```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm test --",
  "playwright.reporter": "html",
  "testing.automaticallyOpenTestResults": "onFailure",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

`.vscode/launch.json`:
```json
{
  "configurations": [
    {
      "name": "Vitest current file",
      "type": "node",
      "request: "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 17.4 Test naming convention for filtering

```bash
# Run only failing tests from last run
npm test -- --changed

# Run by file path pattern
npm test -- src/lib/auth

# Run by test name pattern
npm test -- -t "RBAC"

# Run by tag (custom matcher)
npm test -- -t "@smoke"
```

---

## 18. Mock-Fiction Detection (Known Issue)

### 18.1 The problem

`vi.hoisted()` makes module-level mocks referenceable inside `vi.mock` factories. This is the *correct* pattern — except when:

```ts
// Mock state at module load
const mocks = vi.hoisted(() => ({
  prisma: { workPackage: { findMany: vi.fn().mockResolvedValue([{ subject: 'OLD FIELD NAME' }]) } },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
```

Then later the schema is renamed (`subject` → `title`), but the mock still returns `{ subject: 'OLD' }`. The Prisma mock lies. Tests pass. Real DB returns `{ title: 'OLD' }`. UI crashes.

### 18.2 The detection rules

**Rule 1: Every mock must be schema-validated.**
A custom Vitest setup hook that, in `beforeAll`, runs the real Zod parser against every mock response:

```ts
// src/test/_mock-fiction-detector.ts
import { z } from 'zod'

const WorkPackageResponseSchema = z.object({
  id: z.string().cuid(),
  subject: z.string(),
  description: z.string().nullable(),
  // ...all expected fields
})

export function detectMockDrift() {
  // Walk all registered MSW handlers, hit them, parse the response
  server.listen({ onUnhandledRequest: 'error' })
  // ... assert shape
}
```

If a handler returns `{ subject: 'X' }` and the schema says `title: z.string()`, throw.

**Rule 2: Use real seeds, not hand-written mocks.**
Prefer MSW handlers backed by the **in-memory MockDb** which uses the **real factory functions**. The factory uses `f` from a single source — when `subject` renames, every factory output changes, the MockDb shape changes, the test fails.

**Rule 3: Per-test `server.use` overrides must go through the same MockDb.**
```ts
// Bad: hardcoded override that can drift
server.use(http.get('/api/x', () => HttpResponse.json({ subject: 'X' })))

// Good: override the data, let the handler shape the response
mockDb.workPackages.push({ id: 'wp-1', subject: 'X', /* all required fields */ })
// The real handler reads from mockDb and returns the canonical shape
```

**Rule 4: Per-test hoisted mock overrides are forbidden.**
```ts
// Bad
const mocks = vi.hoisted(() => ({ value: 'A' }))
// ... test 1
mocks.value = 'B'  // ← THIS is the fiction risk
```

Replace with `server.use(...)` (MSW) or `useStore.setState(...)` (Zustand).

**Rule 5: Snapshot the response shape, not the response content.**
```ts
// In handler tests, do a shape-only assertion once per handler
const res = await fetch('/api/x')
const body = await res.json()
expect(Object.keys(body).sort()).toEqual(['createdAt', 'id', 'subject', 'title'].sort())
```

When a new field is added to the API, this fails — and tells you to update the snapshot.

### 18.3 The `vi.hoisted()` policy

- **Allowed:** hoisting a `vi.fn()` that the test then asserts on (spy pattern)
- **Allowed:** hoisting a `vi.fn()` for use inside a `vi.mock` factory
- **Forbidden:** mutating a hoisted value between tests to "stage" a scenario
- **Forbidden:** hoisting a complex object that is later deeply mutated

### 18.4 Audit script

A nightly job runs:
```bash
# Detect all `vi.hoisted` usages, flag those that mutate
npx tsx scripts/audit-mock-fiction.ts
```

Output:
```
src/lib/auth/__tests__/rbac.test.ts:42: hoisted `mocks` mutated in test body
src/hooks/__tests__/use-work-packages.test.tsx:18: hoisted `mocks` mutated in test body
```

---

## 19. Migration Plan: feature-flow-http.js

### 19.1 Current state of the script

`scripts/feature-flow-http.js` is a **smoke test runner** that:
- Hits 60+ endpoints over plain `http.get`
- Asserts only `2xx–3xx` response codes
- Logs a pretty pass/fail report
- Has zero assertions on response *content*
- Is not invoked anywhere in CI
- Has hardcoded `PROJECT_ID = 'cmo4ojw5r000gy8qxbipmo46s'` (will drift)

### 19.2 Problems

1. **Hardcoded project ID** — the script will start failing as soon as that ID is gone
2. **No auth** — protected routes will return 401/403, treated as "fail" with no distinction
3. **No content checks** — a 200 with `[]` is reported as PASS
4. **No retry / no parallelism** — sequential `http.get` chain, 10s timeout
5. **Manual invocation only** — not in CI
6. **No output artifact** — only console
7. **No baseline** — no way to know "this endpoint was always slow"

### 19.3 Migration plan

**Phase 1 (do now):**
- Rewrite as `e2e/smoke/api-health.spec.ts` Playwright spec
- Cover the 60 endpoints in 4 test files, parallelized across 4 shards
- Assert: status, response shape, presence of expected keys
- Authenticate once per spec via `signInAs(page, admin)`
- Use a `seed-test` script that creates a known `smoke-project-${runId}` and uses its ID
- Add `@smoke` tag → run on every PR (subset of E2E)
- Add to CI in the `e2e-smoke` job

**Phase 2 (next sprint):**
- Replace `feature-flow-http.js` invocation in any docs/scripts with `npx playwright test e2e/smoke/`
- Add response-time assertions (p95 < threshold)
- Emit JSON results to a file for historical comparison

**Phase 3 (after):**
- Delete `scripts/feature-flow-http.js`
- Add it to `.gitignore` history clean (optional, prefer leaving a stub that prints "use `npm run test:e2e:smoke`")

### 19.4 New Playwright spec structure

```ts
// e2e/smoke/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Smoke: Auth @smoke', () => {
  test('GET /api/auth/providers returns array', async ({ request }) => {
    const res = await request.get('/api/auth/providers')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /api/auth/csrf returns token', async ({ request }) => {
    const res = await request.get('/api/auth/csrf')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('csrfToken')
    expect(typeof body.csrfToken).toBe('string')
  })
})
```

```ts
// e2e/smoke/projects.spec.ts
import { test, expect } from '@playwright/test'
import { signInApi } from '../helpers/api'

test.describe('Smoke: Projects @smoke', () => {
  let cookie: string

  test.beforeAll(async ({ request }) => {
    cookie = await signInApi(request, 'admin@test.local')
  })

  test('GET /api/projects returns array with seeded project', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: { cookie } })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('name')
  })

  test('GET /api/projects/:id returns single project', async ({ request }) => {
    const list = await request.get('/api/projects', { headers: { cookie } })
    const projects = await list.json()
    const id = projects[0].id
    const res = await request.get(`/api/projects/${id}`, { headers: { cookie } })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(id)
  })

  test('GET /api/projects/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.get('/api/projects/0000000000000000000000000', { headers: { cookie } })
    expect(res.status()).toBe(404)
  })
})
```

### 19.5 Mapping from old script to new specs

| Old script section | New spec file | Tests |
|--------------------|---------------|-------|
| Public Pages | `e2e/smoke/public.spec.ts` | 4 |
| Auth | `e2e/smoke/auth.spec.ts` | 5 |
| Work Packages | `e2e/smoke/work-packages.spec.ts` | 8 |
| Projects | `e2e/smoke/projects.spec.ts` | 6 |
| Board | `e2e/smoke/board.spec.ts` | 3 |
| Gantt | `e2e/smoke/views.spec.ts` | 2 |
| Calendar | `e2e/smoke/views.spec.ts` | 2 |
| Wiki | `e2e/smoke/wiki.spec.ts` | 5 |
| Forums | `e2e/smoke/forums.spec.ts` | 5 |
| News | `e2e/smoke/news.spec.ts` | 2 |
| Documents | `e2e/smoke/documents.spec.ts` | 2 |
| Meetings | `e2e/smoke/meetings.spec.ts` | 2 |
| Activity | `e2e/smoke/activity.spec.ts` | 1 |
| Members | `e2e/smoke/members.spec.ts` | 3 |
| Project Settings | `e2e/smoke/project-settings.spec.ts` | 2 |
| Notifications | `e2e/smoke/notifications.spec.ts` | 2 |
| Search | `e2e/smoke/search.spec.ts` | 2 |
| Queries | `e2e/smoke/queries.spec.ts` | 1 |
| Time Tracking | `e2e/smoke/time-tracking.spec.ts` | 2 |
| Health & Metrics | `e2e/smoke/health.spec.ts` | 2 |
| **Total** | **20 files** | **~60 tests** |

---

## 20. Coverage Analysis & Gap Prioritization

### 20.1 Current state by area

| Area | Existing tests | Coverage estimate | Gap |
|------|----------------|-------------------|-----|
| Auth (login, logout, session) | `auth/2fa.test.ts`, `lib/oauth.unit.test.ts` | ~60% | RBAC, password reset, lockout |
| 2FA | `lib/2fa/{totp,backup-codes,webauthn}.test.ts`, `api/auth/2fa.test.ts` | ~75% | Enrollment E2E, recovery E2E |
| LDAP | `lib/ldap/{client,group-map,sync}.test.ts` | ~70% | Sync scheduler, error paths |
| Projects CRUD | `api/projects.unit.test.ts` (48 cases) | ~80% | Integration, RBAC matrix |
| Work Packages CRUD | `api/work-packages.unit.test.ts` (13 cases) | ~50% | **Major gap** — needs 50+ more cases |
| Wiki | `api/wiki.unit.test.ts` (8 cases), 5 component tests | ~60% | Version diff, revert, ACL |
| Forums | `api/forums.unit.test.ts` (16 cases) | ~65% | Threading, watching, moderation |
| Documents | `api/documents-meetings-search.unit.test.ts` (25 cases) | ~60% | Upload, S3, sharing |
| Meetings | same | ~50% | Action items → WP, agenda → minutes |
| News | (no test file) | **0%** | **Critical gap** |
| Search | partial in unit test | ~40% | Indexing, ranking, faceting |
| Notifications | 3 component tests | ~50% | Backend aggregator, prefs |
| Time tracking | 2 component tests | ~50% | Backend, weekly rollup, export |
| Saved queries | (no test file) | **0%** | **Critical gap** |
| Backlogs | 3 component tests | ~60% | Burndown math, sprint transitions |
| Calendar | 1 component test | ~40% | Drag-drop, recurring |
| Gantt | 1 component test + `lib/gantt-calculate.test.ts` | ~50% | Date math, dependencies |
| Members / RBAC | implicit | ~40% | **Critical gap** — needs matrix test |
| Admin pages | (no test file) | **0%** | **Critical gap** |
| S3 uploads | (no test file) | **0%** | **Critical gap** |
| Email delivery | (no test file) | **0%** | **Critical gap** |
| API routes integration | `routes-integration.test.ts` (excluded) | ~10% | **Critical gap** |

### 20.2 Prioritized test additions (the next 90 days)

**P0 (week 1-2): blocks merge**
- [ ] Enable `routes-integration.test.ts` in CI (with dev server)
- [ ] Add 30 cases to `work-packages.unit.test.ts` (CRUD, validation, RBAC, bulk ops)
- [ ] Fill `__tests__/api/users/` with auth, profile, settings, password
- [ ] Fill `__tests__/api/ldap/` with sync, search, error paths
- [ ] Add RBAC matrix integration test
- [ ] Playwright config + 5 smoke specs (migration of feature-flow-http.js)
- [ ] CI workflow (`.github/workflows/ci.yml`)

**P1 (week 3-4):** high value, planned
- [ ] Playwright + 20 journey specs
- [ ] News module tests (0% → 80%)
- [ ] Saved queries tests (0% → 80%)
- [ ] Admin page tests (0% → 60%)
- [ ] S3 upload tests (0% → 70%)
- [ ] Email delivery tests with Mailhog
- [ ] axe-core in component tests (vitest-axe)
- [ ] Codecov integration

**P2 (week 5-8):** quality + safety
- [ ] Stryker mutation testing on auth/RBAC
- [ ] OWASP ZAP nightly
- [ ] Snyk on every PR
- [ ] Visual regression baselines (Chromatic)
- [ ] Lighthouse CI on key pages
- [ ] Pa11y nightly
- [ ] CodeQL enablement

**P3 (week 9-12):** polish
- [ ] Storybook stories for all components → Chromatic
- [ ] Soak test (k6, 1h, weekly)
- [ ] Spike test (k6, 0→500 VUs)
- [ ] Database query benchmarks
- [ ] Security test suite (13 threat cases)
- [ ] Flaky test quarantine workflow
- [ ] Test debugging guide in `/docs`

### 20.3 Coverage gap heat map (textual)

```
                 UNTESTED                          TESTED
                 ──────────                       ──────
  Auth           ██░░░░░░░░ 30%                   ░░░░██░░░░
  RBAC           ████░░░░░░ 40%                   ░░░░████░░
  Work Packages  ███░░░░░░░ 35%                   ░░░░███░░░
  Wiki           ████░░░░░░ 40%                   ░░░░████░░
  Forums         ████░░░░░░ 40%                   ░░░░███░░░
  Documents      █████░░░░░ 50%                   ░░░░████░░
  News           ██████████ 10%                   ░░░░░░░░░░
  Meetings       █████░░░░░ 50%                   ░░░░███░░░
  Search         ██████░░░░ 60%                   ░░░░████░░
  Notifications  ████░░░░░░ 40%                   ░░░░███░░░
  Time tracking  ████░░░░░░ 40%                   ░░░░████░░
  Saved queries  ██████████ 5%                    ░░░░░░░░░░
  Admin          ██████████ 5%                    ░░░░░░░░░░
  S3 uploads     ██████████ 0%                    ░░░░░░░░░░
```

### 20.4 Success measure

After 90 days of execution:
- Project-wide coverage: 80% lines, 70% branches
- 0 areas at "0%" coverage
- Mutation score: 60%+ on `lib/`
- E2E runtime: < 5 min smoke, < 15 min full
- 0 flaky tests in main
- Mean time to detect regression: < 12 hours (CI catches it)

---

## 21. Tooling Catalog & Versions

### 21.1 Current (already in package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.4 | Unit + integration runner |
| `@vitest/ui` | 4.1.4 | Browser-based test UI |
| `@vitejs/plugin-react` | 6.0.1 | JSX in tests |
| `jsdom` | 29.0.2 | DOM env for component tests |
| `@testing-library/react` | 16.3.2 | Component testing |
| `@testing-library/jest-dom` | 6.9.1 | Matchers |
| `@testing-library/user-event` | 14.6.1 | User event simulation |
| `@testing-library/dom` | 10.4.1 | RTL core |
| `msw` | 2.14.2 | HTTP mocking |
| `next-test-api-route-handler` | 5.0.4 | API route testing |
| `node-mocks-http` | 1.17.2 | Mock Node req/res |
| `playwright` | 1.59.1 | E2E (currently ad-hoc) |
| `dotenv` | 17.4.2 | .env loading |
| `tsx` | 4.21.0 | TS execution |
| `prisma` | 7.7.0 | Test DB |

### 21.2 To add

| Package | Version target | Purpose | Why |
|---------|----------------|---------|-----|
| `@playwright/test` | 1.59.x | E2E runner (the test half of playwright) | Currently only `playwright` (lib) is installed; need the test runner |
| `@axe-core/playwright` | latest | E2E a11y | a11y in E2E |
| `vitest-axe` | latest | Component a11y | a11y in unit/integration |
| `@faker-js/faker` | 9.x | Realistic test data | Replace hand-written IDs |
| `@stryker-mutator/vitest-runner` | latest | Mutation testing | Quality signal |
| `@stryker-mutator/typescript-checker` | latest | TS type-checker for Stryker | Faster incremental runs |
| `pa11y-ci` | latest | Site-wide a11y crawl | Catch a11y across all routes |
| `chromatic` | latest | Visual regression | Component-level visual diffs |
| `@lhci/cli` | latest | Lighthouse CI | Front-end perf budgets |
| `eslint-plugin-vitest` | latest | Lint test code | Catch anti-patterns |
| `eslint-plugin-jest-dom` | latest | Lint RTL usage | Best-practice enforcement |
| `eslint-plugin-testing-library` | latest | RTL lint rules | Best-practice enforcement |

### 21.3 Script additions to `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:ci": "vitest run --reporter=default --reporter=github-actions --reporter=junit",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "test:visual": "playwright test --project=chromium e2e/visual/",
    "test:mutate": "stryker run",
    "test:a11y": "pa11y-ci --config .pa11yci.json",
    "test:load": "k6 run k6/scenarios/load.ts",
    "test:smoke:load": "k6 run k6/scenarios/smoke.ts",
    "test:audit-mocks": "tsx scripts/audit-mock-fiction.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

---

## 22. Implementation Roadmap

### 22.1 Phasing

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| **Phase A: Foundation** | 1 | CI workflow, Playwright config, Codecov, axe in component tests, faker added, factories written |
| **Phase B: Test densification** | 2-3 | Fill `users/`, `ldap/`, `work-packages` to 80%; enable `routes-integration.test.ts`; add RBAC matrix |
| **Phase C: E2E** | 3-5 | All 20 journeys; smoke migration from feature-flow-http.js; flake budget < 0.5% |
| **Phase D: Quality layers** | 5-7 | Stryker, Snyk, ZAP, Lighthouse CI, visual regression |
| **Phase E: Performance & security** | 7-9 | k6 rewrite, DB benchmarks, security test suite |
| **Phase F: Polish** | 9-12 | Storybook+Chromatic, flaky quarantine, mock-fiction audit script, full docs |

### 22.2 Quick wins (do this week)

1. **Add `__tests__/factories/` with faker-backed factories**
2. **Move `vi.hoisted` audit to a pre-commit hook** (`npx tsx scripts/audit-mock-fiction.ts`)
3. **Add `eslint-plugin-vitest` and fix reported issues**
4. **Add `vitest-axe` to one component test** as a template; roll out over the month
5. **Add `@playwright/test` and a single `e2e/smoke/auth.spec.ts`** to validate the runner
6. **Remove `feature-flow-http.js` exclude** by porting it properly OR by deleting it (after smoke spec exists)
7. **Add `playwright-report/` upload to CI** even if only one test runs

### 22.3 Migration checklist for `__tests__/`

| Current | New | Action |
|---------|-----|--------|
| `__tests__/api/*.unit.test.ts` | `pages/api/**/__tests__/*.test.ts` (colocated) | Move when refactoring the route; for now, leave |
| `__tests__/api/routes-integration.test.ts` | `__tests__/api/integration/*.test.ts` | Split per route group, enable in CI |
| `__tests__/components/*.test.tsx` | `src/components/**/*.test.tsx` (colocated) | Move gradually; allows better co-evolution |
| `__tests__/hooks/*.test.tsx` | `src/hooks/**/*.test.ts` (colocated) | Move gradually |
| `__tests__/lib/*.test.ts` | `src/lib/**/*.test.ts` (colocated) | Move gradually |
| `__tests__/pages/project-settings.test.tsx` | `src/pages/**/*.test.tsx` (colocated) | Move when settings page is touched |
| (none) | `e2e/` | Create new |
| (none) | `__tests__/factories/` | Create new |
| (none) | `__tests__/security/` | Create new |
| (none) | `e2e/visual/` | Create new |
| `src/test/mocks/handlers.ts` (single file) | `src/test/mocks/handlers/*.ts` (split) | Refactor |
| `src/test/mocks/MockDb` (inline) | `src/test/mocks/MockDb.ts` (typed) | Extract |

### 22.4 Definition of "done" for each phase

- All tests pass on the first CI run (no follow-up fixes)
- Coverage reports show no area regressed
- No new files use forbidden patterns (`vi.mock('react')`, `setTimeout` in tests, hand-rolled fake IDs)
- New tests are referenced in this design doc's coverage map (or the map is updated)
- E2E journeys have traces and videos on failure

---

## 23. Success Metrics & SLOs

### 23.1 Velocity metrics

| Metric | Target | Measured by |
|--------|--------|-------------|
| PR cycle time | < 4 hours | GitHub PR API |
| Time to first CI feedback | < 5 min | GitHub Actions |
| Flaky test rate | < 0.5% | Playwright + Vitest reporters |
| Mean time to detect regression | < 12 hours | Sentry + CI history |

### 23.2 Quality metrics

| Metric | Target | Measured by |
|--------|--------|-------------|
| Line coverage | ≥ 80% | vitest coverage |
| Branch coverage | ≥ 70% | vitest coverage |
| Mutation score (security code) | ≥ 80% | Stryker |
| Mutation score (general) | ≥ 60% | Stryker |
| a11y violations (serious+) on key pages | 0 | axe + pa11y |
| OWASP ZAP alerts (high+) | 0 | ZAP baseline |
| Snyk vulnerabilities (high+) | 0 | Snyk |
| npm audit (high+) | 0 | npm audit |
| Lighthouse perf score (key pages) | ≥ 90 | LHCI |

### 23.3 Operational metrics

| Metric | Target | Measured by |
|--------|--------|-------------|
| Unit + integration runtime | < 5 min | vitest reporter |
| E2E smoke runtime | < 5 min | Playwright reporter |
| E2E full runtime (4 shards) | < 15 min | Playwright reporter |
| k6 smoke runtime | < 2 min | k6 output |
| k6 load runtime | < 10 min | k6 output |
| CI total runtime (unit + e2e smoke) | < 15 min | GitHub Actions |
| Test failure artifact upload success | 100% | Actions logs |

### 23.4 When to roll back a change

- Mutation score drops > 5% on touched files
- Coverage drops > 1% absolute on `lib/`
- A new test pattern is needed because coverage gap appeared
- A test takes > 10s (always slow) — rewrite or delete
- A test is in quarantine for > 30 days — fix or delete

---

## 24. Appendix: Templates & Examples

### 24.1 Test file template (colocated unit test)

```ts
// src/lib/format/duration.test.ts
import { describe, it, expect } from 'vitest'
import { formatDuration } from './duration'

describe('formatDuration', () => {
  it('formats minutes under an hour', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats hours under a day', () => {
    expect(formatDuration(120)).toBe('2h')
  })

  it('formats days under a week', () => {
    expect(formatDuration(60 * 24 * 3)).toBe('3d')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it.each([
    [-1, '0m'],
    [NaN, '0m'],
    [Infinity, '0m'],
  ])('returns 0m for invalid input %s', (input, expected) => {
    expect(formatDuration(input as number)).toBe(expected)
  })
})
```

### 24.2 Hook test template

```tsx
// src/hooks/use-create-work-package.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { TestProviders } from '@/test/TestProviders'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
import { useCreateWorkPackage } from './use-create-work-package'

describe('useCreateWorkPackage', () => {
  beforeEach(() => {
    server.resetHandlers()
  })

  it('creates and invalidates list', async () => {
    server.use(
      http.post('/api/work-packages', () =>
        HttpResponse.json({ id: 'wp1', subject: 'New' }, { status: 201 })
      )
    )
    const { result } = renderHook(() => useCreateWorkPackage('prj1'), {
      wrapper: TestProviders,
    })
    await act(async () => {
      await result.current.mutateAsync({ subject: 'New' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ subject: 'New' })
  })

  it('exposes error on failure', async () => {
    server.use(
      http.post('/api/work-packages', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 })
      )
    )
    const { result } = renderHook(() => useCreateWorkPackage('prj1'), {
      wrapper: TestProviders,
    })
    await act(async () => {
      try { await result.current.mutateAsync({ subject: 'X' }) } catch {}
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

### 24.3 API integration test template

```ts
// __tests__/api/integration/projects-id.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testApiHandler } from 'next-test-api-route-handler'
import handler from '@/pages/api/projects/[id]'
import { prisma } from './_prisma-test-client'
import { signInCookie } from './_auth-helper'
import { buildProject, buildUser, buildMembership } from '@/test/factories'

describe('GET /api/projects/[id]', () => {
  beforeEach(async () => {
    // Truncate handled by global hook
  })

  it('returns 401 when unauthenticated', async () => {
    const project = await prisma.project.create({ data: buildProject() })
    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET', query: { id: project.id } })
        expect(res.status).toBe(401)
      },
    })
  })

  it('returns 200 for a member', async () => {
    const owner = await prisma.user.create({ data: buildUser() })
    const project = await prisma.project.create({ data: buildProject({ createdById: owner.id }) })
    const member = await prisma.user.create({ data: buildUser() })
    await prisma.membership.create({ data: buildMembership(project.id, member.id, 'MEMBER') })

    await testApiHandler({
      pagesHandler: handler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'GET',
          query: { id: project.id },
          cookies: { 'next-auth.session-token': await signInCookie(member.id) },
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBe(project.id)
      },
    })
  })
})
```

### 24.4 E2E journey template

```ts
// e2e/journeys/05-board-wip-limit.spec.ts
import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { seedProjectWithColumns } from '../fixtures/board'
import { WorkPackageBoardPage } from '../pages/WorkPackageBoardPage'

test.describe('J05: Board WIP limit @smoke', () => {
  test('blocks drag into full column', async ({ page }) => {
    const { owner, project } = await seedProjectWithColumns({
      statuses: ['New', 'In progress'],
      wipLimits: { New: 3, 'In progress': 2 },
      workPackagesPerStatus: { New: 3, 'In progress': 2 },
    })

    await signInAs(page, owner.email)
    const board = new WorkPackageBoardPage(page)
    await board.goto(project.id)

    // Attempt to drag a "New" WP to "In progress" (already at WIP limit)
    const sourceCard = board.cardByStatus('New', 0)
    const targetColumn = board.columnHeader('In progress')
    await sourceCard.dragTo(targetColumn)

    // Expect a WIP-limit dialog
    await expect(page.getByRole('alertdialog', { name: /work in progress limit/i })).toBeVisible()
    await expect(page.getByText(/column is at its limit/i)).toBeVisible()

    // Source WP remains in "New"
    await expect(board.cardByStatus('New', 0)).toBeVisible()
    await expect(board.columnCount('In progress')).toBe(2)
  })
})
```

### 24.5 Coverage report check

Add a script `scripts/check-coverage.ts` that fails if any new file is below the floor:

```ts
import { readFileSync } from 'fs'
import { glob } from 'glob'

const summary = JSON.parse(readFileSync('./coverage/coverage-summary.json', 'utf8'))

let failed = false
for (const file of Object.keys(summary)) {
  if (file === 'total') continue
  const { lines, branches, functions, statements } = summary[file]
  if (lines.pct < 70 || branches.pct < 60) {
    console.error(`❌ ${file}: lines ${lines.pct}%, branches ${branches.pct}%`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
```

### 24.6 Mock-fiction audit script

```ts
// scripts/audit-mock-fiction.ts
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const FORBIDDEN_PATTERNS = [
  // Mutating a hoisted value in a test body
  /vi\.hoisted\([^)]+\)\s*\n.*mutate|hoisted.*=.*vi\.fn/m,
  // Mocking react itself
  /vi\.mock\(['"]react['"]/,
  // setTimeout-based waits
  /await new Promise\(r => setTimeout/,
  // Hand-rolled cuid-like IDs (use factories instead)
  /id:\s*['"]c[0-9a-f]{20,}['"]/,
]

const errors: string[] = []
function walk(dir: string) {
  for (const file of readdirSync(dir)) {
    const p = join(dir, file)
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      const content = readFileSync(p, 'utf8')
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.test(content)) errors.push(`${p}: matches ${pat}`)
      }
    }
  }
}

walk('./__tests__')
walk('./src')

if (errors.length) {
  console.error('Mock-fiction audit FAILED:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log('Mock-fiction audit: OK')
```

---

## Closing Notes

This is not a 2-week project. It's a sustained engineering discipline. Every PR should leave the test suite a little better than it found it: one more edge case, one more RBAC row, one more a11y assertion, one more journey covered. The metric we care about is not "lines of test code" but "**how many user-facing bugs would have been caught in CI if they had slipped past review**."

The 20 journeys in §9 are the contract: those 20 paths must work. Everything else is supporting infrastructure. If a P0 journey breaks, we revert. If a unit test breaks, we fix. If a flake appears, we quarantine and fix within 7 days. If a coverage gap appears on security code, we block the PR.

That's the bar.
