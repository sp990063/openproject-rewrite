---
title: OpenProject Rewrite — AGENTS.md
description: AI coding agent guidance for the OpenProject Next.js rewrite project
---

# OpenProject Rewrite — AI Coding Agent Guide

This is the OpenProject Next.js rewrite project. This AGENTS.md file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, Hermes, etc.) when working on this codebase.

## Project Overview

**Location:** `/home/cwlai/openproject-rewrite`

A production-grade rewrite of OpenProject using Next.js 15 (Pages Router). The project follows a 6-phase roadmap spanning 12 months.

**Current Status:**
- Phase 1 (Foundation): ✅ Complete
- Phase 2 (Work Package Views): ✅ Complete
- Phase 3-6: ✅ Complete
- **Phase 7 (RBAC Hardening):** 🚧 In Progress — B-1 forum, B-2 meetings, B-3 wiki/documents/announcements/work-packages, B-4 relations ✅ migrated to `withRoute` HOF. 12 routes hardened, 80 unit tests, 5 new project-membership helpers.

**Tech Stack:**
- Next.js 15.5.15 (Pages Router)
- Prisma 7.7.0 + PostgreSQL
- NextAuth.js v5 (beta)
- Zustand 5.0.12
- TanStack Query 5.99.0
- Radix UI + Tailwind CSS v4
- Vitest 4.1.4

## Core Rules

### For Hermes Agent (this system)

This project has its own skills installed:

1. **`openproject-rewrite`** — Master skill for all OpenProject work
2. **`openproject-phase2-work-packages`** — Phase 2 specific guidance
3. **agent-skills** (from `agent-skills/` directory) — Standard engineering skills

When starting any OpenProject task, load the `openproject-rewrite` skill first:
```
Load skill: openproject-rewrite
```

### Skill Loading Priority

For ANY OpenProject rewrite task, load skills in this order:

1. `openproject-rewrite` — Project context and conventions
2. Relevant phase skill — e.g., `openproject-phase2-work-packages`
3. Relevant agent-skills — e.g., `planning-and-task-breakdown`, `incremental-implementation`

### Slash Commands

This project has custom slash commands in `.claude/commands/`:

- `/plan` — Plan the next phase or feature
- `/build` — Build incrementally with TDD
- `/test` — Run tests and verify
- `/review` — Code review
- `/spec` — Create a new spec
- `/ship` — Ship completed work
- `/code-simplify` — Simplify code

## Workflow

### Development Lifecycle

```
/plan → /spec → /build → /test → /review → /ship
```

Each step loads the appropriate skill.

### Intent → Skill Mapping

- **Planning a phase or feature** → Load `openproject-rewrite` + `planning-and-task-breakdown`
- **Implementing a component** → Load `openproject-rewrite` + `incremental-implementation`
- **Writing tests** → Load `openproject-rewrite` + `test-driven-development`
- **Code review** → Load `openproject-rewrite` + `code-review-and-quality`
- **Debugging** → Load `openproject-rewrite` + `debugging-and-error-recovery`

## Key Conventions

### Pages Router Only
- All pages go in `pages/` directory
- API routes in `pages/api/`
- **DO NOT use App Router** (no `app/` directory)

### Prisma 7 Patterns
- Use `@db.VarChar`, `@db.Text` for PostgreSQL
- Always use explicit transactions for multi-step operations
- Phase 4 models exist: Wiki, Forum, Document, Meeting

### NextAuth.js v5 Patterns
- Config at `lib/auth.ts`
- JWT strategy (no sessions table)
- `isSystemAdmin()` and `validatePassword()` helpers exist

### API Routes — `withRoute` HOF (mandatory for new routes)
- All new API routes in `pages/api/**` MUST use the `withRoute` higher-order function from `lib/api/withRoute.ts`.
- `withRoute` provides: auth (3-arg `getServerSession`), rate limit (Upstash Redis), zod validation (body/query/params), RBAC callback, uniform error envelope, Sentry capture, audit log.
- **Helpers for project-membership checks live in `lib/auth/project.ts`** (Phase 7 RBAC layer):
  - `assertProjectMembership(projectId, userId, isSystemAdmin)` — direct check
  - `assertForumProjectMembership / assertThreadProjectMembership / assertPostProjectMembership` (Phase 7 B-1)
  - `assertMeetingProjectMembership / assertMeetingAgendaProjectMembership / assertMeetingMinutesProjectMembership / assertMeetingAttendeeProjectMembership` (Phase 7 B-2)
  - `assertWikiPageProjectMembership / assertWikiPageBySlugProjectMembership` (Phase 7 B-3)
  - `assertDocumentProjectMembership / assertFolderProjectMembership` (Phase 7 B-3)
  - `assertWorkPackageProjectMembership` (Phase 7 B-3.4)
  - `assertRelationProjectMembership` (Phase 7 B-4)
- **Pattern for raw handler migration**: keep helper OUT of withRoute's rbac callback — call it directly at the top of the handler body. This lets raw handlers and withRoute-wrapped handlers share the same helper.
- For migration procedure, load the **`openproject-rewrite-phase7-rbac`** skill.

### State Management
- TanStack Query for server state
- Zustand for client UI state
- Custom hooks in `hooks/` directory

## Quality Gates

All code changes must pass:

```bash
npm test              # Vitest tests
npm run build         # Next.js production build
npx tsc --noEmit      # TypeScript type check
```

**Note on pre-existing baseline:**
- `npx tsc --noEmit` shows ~412 pre-existing errors in unrelated test files (e.g. `forums.unit.test.ts` `getStatusCode` typo, `auth/2fa.test.ts` `getServerSession` import) — these are NOT regressions from new work. Track which errors you INTRODUCED in your touched files, not the total.
- Some test files have pre-existing baseline failures (e.g. `projects.unit.test.ts`, `work-packages-calendar`, `ui-smoke`, `notifications`). Verify your B-N sprint tests pass in isolation (`npx vitest run __tests__/api/<sprint>.unit.test.ts`) and that the test count delta matches what you added — don't try to fix unrelated failures.

## Important Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | NextAuth.js configuration + admin helpers |
| `lib/api/withRoute.ts` | **API route HOF (mandatory)** — auth + rate limit + zod + RBAC + Sentry + audit |
| `lib/auth/project.ts` | **Phase 7 RBAC helpers** — `assertXxxProjectMembership` for forums, threads, posts, meetings, agenda, minutes, attendees, wiki pages, wiki slugs, documents, folders, work packages, relations |
| `lib/prisma.ts` | Prisma client singleton |
| `stores/ui-store.ts` | Zustand UI state |
| `hooks/use-*.ts` | TanStack Query hooks |
| `prisma/schema.prisma` | Database schema |
| `pages/api/` | REST API routes |

## Wiki Specs

Detailed specifications are in the wiki:

```
/home/cwlai/wiki/concepts/openproject-rewrite-phase1-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phase2-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phase3-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phase4-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phase5-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phase6-spec.md
/home/cwlai/wiki/concepts/openproject-rewrite-phases-roadmap.md
/home/cwlai/wiki/concepts/openproject-rewrite-remaining-issues.md
```

## Anti-Patterns

❌ **DO NOT:**
- Use App Router patterns (this is Pages Router)
- Create API routes without proper error handling
- Skip tests when implementing features
- Use `any` type without justification
- Bypass the skill workflow for "quick" tasks

✅ **DO:**
- Follow the /plan → /build → /test → /review → /ship workflow
- Write tests before implementing (TDD)
- Use TypeScript strict mode
- Load relevant skills before starting work
- Read the phase spec before implementing

## Session Start Hook

When you start a session working on OpenProject:

1. Load the `openproject-rewrite` skill
2. Check the current phase and status
3. Read any relevant remaining issues
4. Pick up where you left off

## Need Help?

- For workflow questions → Load `openproject-rewrite` skill
- For Phase 2 questions → Load `openproject-phase2-work-packages` skill
- For Phase 7 RBAC migration (raw handler → withRoute HOF, helper patterns, push workflow) → Load `openproject-rewrite-phase7-rbac` skill
- For general engineering → Load relevant agent-skills from `agent-skills/` directory

## Git Push Workflow (Phase 7 lessons)

The Hermes tool gate blocks `git push --force-with-lease` per-command and requires explicit user confirmation. **Prefer fast-forward pushes:**

1. **Make commits linear on top of `origin/main`** before pushing. If you find yourself with parallel/orphan commits (e.g. fix commit on a side branch from a previous `--soft` reset), drop the corrupt state, fresh-clone to a temp dir, replay the commits in linear order, then `git push` from the temp dir.
2. **Verify the linear path**: `git log --oneline --all --graph` should show a straight line from `origin/main` to your HEAD.
3. **Push from a clean state** (no working tree changes): `git status` should show nothing to commit (untracked debug scripts are fine).
4. **If you absolutely need force-push**, ask the user first — `--force-with-lease` is blocked by the tool gate, so a clean linear history is the safe path.
