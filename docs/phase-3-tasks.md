---
title: OpenProject Rewrite — Phase 3 Tasks
created: 2026-06-06
updated: 2026-06-06
type: tasks
status: 🚧 Sprint 1 in progress
---

# Phase 3 — Projects & Members Tasks

Spec: `wiki/concepts/openproject-rewrite-phase3-spec.md` (2321 lines)
Gap analysis: 7 gaps remaining after Phase 0+1+2 implementation.

## Sprint 1 — Foundation & API (3-4 days, no new Prisma model)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Wildcard permission support in `lib/permissions/` (foundation) | `lib/permissions/wildcard.ts` (new), `lib/permissions/check.ts` (new) | 🔜 |
| 1.2 | Migrate `pages/api/projects/[projectId]/index.ts` from raw handler → `withRoute` HOF | `pages/api/projects/[projectId]/index.ts` (refactor) | 🔜 |
| 1.3 | `usePermission` client-side hook | `hooks/use-permission.ts` (new) | 🔜 |

## Sprint 2 — Advanced API (2-3 days, ⚠️ Sprint 2 = WAIT on Invite model approval)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | GDPR Hard Delete endpoint (system-admin only + deletion reason) | `pages/api/projects/[projectId]/hard-delete.ts` (new) | 🔒 |
| 2.2 | Bulk Archive endpoint (D9 fix) | `pages/api/projects/bulk-archive.ts` (new) | 🔒 |
| 2.3 | Invite Flow (3 endpoints + Invite model) ⚠️ needs approval | `prisma/schema.prisma` + 3 routes | 🔒 |

## Sprint 3 — UI (3-4 days)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | ProjectList + ProjectCard components | `components/projects/ProjectList.tsx` (new), `components/projects/ProjectCard.tsx` (new) | 🔒 |
| 3.2 | ProjectDetail page | `pages/projects/[projectId]/index.tsx` (verify + enhance) | 🔒 |
| 3.3 | ProjectSettings UI | `pages/projects/[projectId]/settings.tsx` (607 lines, decompose) | 🔒 |
| 3.4 | ModuleToggle + RoleSelect + RoleBadge + AddMemberDialog | `components/projects/*` (new) | 🔒 |

## Done in Phase 0/1/2 (out of scope for Phase 3 sprints)

- ✅ Prisma models: User, Project, Member, Role, ProjectModule, Activity
- ✅ `isSystemAdmin()` defined in `lib/auth.ts:33`
- ✅ `lib/auth/has-role.ts` server-safe role check
- ✅ `pages/api/projects/index.ts` — CRUD + 9 modules + withRoute
- ✅ `pages/api/projects/[projectId]/index.ts` — GET/PATCH/DELETE (raw, not withRoute)
- ✅ `pages/api/projects/[projectId]/members.ts` — full CRUD
- ✅ `pages/api/roles/index.ts` — list roles
- ✅ `pages/projects/new.tsx` — Project create form (RHF+Zod)
- ✅ `pages/projects/[projectId]/members/index.tsx` — Member mgmt UI
- ✅ `lib/permissions/work-packages.ts` — server RBAC check

## Verification (per task)

- `npx tsc --noEmit 2>&1 | grep -E "<new-file>"` → 0 lines
- `npx vitest run <test-file>` → 0 NEW failures
- Dev server smoke (per handover convention): `PORT=3001 NEXTAUTH_URL=*** npm run dev`
- `/api/health` 200, `/login` 200, modified routes 200/401 as expected

## Commit cadence

- 1 commit per Sprint, body lists each task with `- ` bullet
- 2-commit session pattern if pre-existing untracked files present (per skill)
- Push to `origin/main`
