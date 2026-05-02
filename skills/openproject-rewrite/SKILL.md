---
name: openproject-rewrite
description: Guides all work on the OpenProject Next.js rewrite. Use when working on any OpenProject rewrite task — any phase, any component. This skill activates automatically when working in /home/cwlai/openproject-rewrite.
---

# OpenProject Rewrite

## Overview

This is a production-grade rewrite of OpenProject using Next.js 15 (Pages Router). The project follows a 6-phase roadmap spanning 12 months, with the foundation (Phase 1) already complete.

## Project Context

**Location:** `/home/cwlai/openproject-rewrite`

**Current Status:**
- Phase 1 (Foundation): Complete
- Phase 2 (Work Package Views): In progress
- Phase 3-6: Not started

**Tech Stack:**
- Next.js 15.5.15 (Pages Router, NOT App Router)
- Prisma 7.7.0 + PostgreSQL
- NextAuth.js v5 (beta)
- Zustand 5.0.12 (client state)
- TanStack Query 5.99.0 (server state)
- Radix UI + Tailwind CSS v4
- Vitest 4.1.4 + MSW 2.13.4

**Key Files:**
- `pages/` — Next.js pages (Pages Router)
- `components/` — React components
- `lib/` — Utilities (auth.ts, prisma.ts, query-client.ts, ratelimit.ts)
- `stores/` — Zustand stores (ui-store.ts)
- `hooks/` — Custom hooks (use-current-user.ts, use-projects.ts, use-queries.ts, use-work-packages.ts)
- `prisma/schema.prisma` — Database schema

**Wiki Specs:** `/home/cwlai/wiki/concepts/openproject-rewrite-*.md`

## Workflow

When starting any OpenProject rewrite task:

1. **Read the relevant phase spec** from wiki/concepts/
2. **Follow the agent-skills workflow:**
   - `/spec` → Use spec-driven-development skill
   - `/plan` → Use planning-and-task-breakdown skill
   - `/build` → Use incremental-implementation skill
   - `/test` → Use test-driven-development skill
   - `/review` → Use code-review-and-quality skill
3. **Always verify** before marking complete

## Important Conventions

### Next.js 15 Pages Router
- All pages go in `pages/` directory
- API routes in `pages/api/`
- Layouts via `pages/_app.tsx` and `pages/_document.tsx`
- **DO NOT use App Router patterns** (no `app/` directory)

### Prisma 7
- Schema at `prisma/schema.prisma`
- Use `@db.VarChar`, `@db.Text` etc. for PostgreSQL types
- Phase 4 models exist: Wiki, Forum, Document, Meeting
- Use `prisma.modelName.findMany()` pattern

### NextAuth.js v5
- Config at `lib/auth.ts`
- Credentials provider for login
- JWT strategy (no sessions table)
- `isSystemAdmin()` and `validatePassword()` helpers exist

### Quality Gates
- All PRs must pass `npm test` (Vitest)
- All PRs must pass `npm run build`
- All PRs must pass TypeScript (`npx tsc --noEmit`)

## Phase Overview

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Foundation (auth, schema, API, UI shell) | ✅ Done |
| 2 | Work Package Views (Table, Gantt, Board, Calendar) | 🚧 Next |
| 3 | Projects & Members | 📋 Planned |
| 4 | Collaboration (Wiki, Forums, Documents, Meetings) | 📋 Planned |
| 5 | Notifications & Time Tracking | 📋 Planned |
| 6 | Real-time, Performance, Migration, Launch | 📋 Planned |

## Common Tasks

### Run Tests
```bash
cd /home/cwlai/openproject-rewrite
npm test
```

### Run Build
```bash
cd /home/cwlai/openproject-rewrite
npm run build
```

### Check TypeScript
```bash
cd /home/cwlai/openproject-rewrite
npx tsc --noEmit
```

### Read Phase Spec
```bash
cat /home/cwlai/wiki/concepts/openproject-rewrite-phase{N}-spec.md
```
