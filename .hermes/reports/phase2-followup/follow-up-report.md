# OpenProject Rewrite — Phase 1 Code Review Follow-up Report

> Consolidated from 10 Phase 1 JSONL reports. Read-only synthesis. 559 actionable findings across 10 domains. Drives 10 parallel Phase 3 fix sprints.

---

## Executive Summary

- **Total findings: 559** (43 critical, 191 high, 179 medium, 146 low)
- **Domains covered: 10** (Auth, RBAC, API, DB, WorkPackages, WikiDocs, ForumMeetings, UI, HooksState, TestsTooling)
- **Phase 1 reports: 10** JSONL files in `.hermes/reports/phase1-code-review/`
- **Pre-existing baseline (out of scope):** 6 work-packages + 7 work-package-permissions unit-test failures, plus forums / 2fa / projects / calendar / ui-smoke / notifications.

### Headline systemic issues

1. **95 of 156 API routes still use raw handlers** — missing the `withRoute` HOF's auth, rate limit, zod validation, RBAC callback, Sentry, and audit log. The systematic Phase 1 backlog dwarfs the 12 routes already hardened in Phase 7 B-1..B-4.
2. **Cross-tenant data leaks via missing project-scoping** — `GET /api/work-packages`, `GET /api/v3/work-packages`, `GET /api/time-entries`, `GET /api/projects`, `GET /api/groups/[id]`, `GET /api/webhooks/[id]` all return data across projects/orgs to any authenticated user (RBAC-5, RBAC-9, RBAC-10, RBAC-11, RBAC-13, RBAC-22, RBAC-23, API-172, API-173).
3. **Three competing RBAC systems** — direct `prisma.member.findUnique`, `assertProjectMembership` helper, and per-resource `assertXxxProjectMembership` helpers. Routes pick one or none; tests are split across all three (RBAC-2, RBAC-3, RBAC-32, RBAC-42).
4. **TOTP / 2FA chain of cryptographic gaps** — plaintext secret storage, modulo-biased backup-code generation, linear-scan backup-code consumption without constant-time compare, and 2FA disable that requires no re-auth (AUTH-1, AUTH-5, AUTH-6, API-130, API-132).
5. **Test coverage for new helpers is largely fictional** — the Phase 7 RBAC helpers (`assertForumProjectMembership`, `assertWikiPageBySlugProjectMembership`, etc.) have **zero direct unit tests**; the existing forum/wiki test files do not exercise them, and the HOF `rbac` callback pattern is untested end-to-end (TT-26, RBAC-3, RBAC-42).

---

## Severity Matrix by Domain

| Domain           | Critical | High | Medium | Low | Total |
| ---------------- | -------: | ---: | -----: | --: | ----: |
| Auth             |        1 |    6 |      6 |   5 |    18 |
| RBAC             |        3 |   20 |     12 |  10 |    45 |
| API              |       21 |   97 |     73 |  21 |   212 |
| DB (Prisma)      |        3 |    8 |     16 |  13 |    40 |
| WorkPackages     |        1 |    3 |      6 |  11 |    21 |
| WikiDocs         |        5 |   13 |     15 |   9 |    42 |
| ForumMeetings    |        0 |   11 |     13 |  11 |    35 |
| UI               |        1 |    8 |     16 |  61 |    86 |
| HooksState       |        4 |   17 |      8 |   1 |    30 |
| TestsTooling     |        4 |    8 |     14 |   4 |    30 |
| **TOTAL**        |  **43**  |**191**| **179** |**146** | **559** |

Notes:
- API counts reflect the largest backlog: 95 raw handlers × ~1 finding each (envelope / Sentry / rate-limit / audit gaps) + 35 specific security bugs.
- UI skews low: most findings are a11y / dead-link / i18n nits; only 1 critical (Router uses private Next.js `_extractParams`).
- Auth/RBAC ratio is healthy — the worst defects are concentrated in the data-plane (API) and the DB schema, not the identity layer.

---

## Top 20 Prioritized Findings (P0 = must-fix before merge)

Ordered: critical first, then high with security/data-integrity impact first.

### Critical (P0)

1. **AUTH-1** — TOTP secret stored in plaintext despite comment claiming encryption at rest
   *File:line:* `prisma/schema.prisma:71` (and all 7 2FA routes)
   *Why it matters:* A DB dump or SQL injection yields all TOTP seeds; attacker can compute valid 6-digit codes for any user. `webAuthnCreds` JSON column is dead but confusing.
   *Fix:* Implement AES-256-GCM via `lib/crypto/secrets.ts` with `encryptSecret`/`decryptSecret`; encrypt on write in `users/[id]/2fa/setup.ts`, decrypt on read in `verify.ts` and `auth.ts#authorize()`. Drop the dead `webAuthnCreds` column.

2. **API-78** — `time-entries/[id]/approve.ts`: ANY authenticated user can approve any time entry
   *File:line:* `pages/api/time-entries/[id]/approve.ts`
   *Why it matters:* CRITICAL RBAC gap (the file's own comment admits "should be restricted by project membership"). Unrestricted approval of payroll/timesheet data.
   *Fix:* Migrate to `withRoute` and apply `assertProjectMembership` with `TIME_ENTRY_APPROVE` permission; verify the actor is a project manager. (Mirror in `reject.ts` → API-80.)

3. **API-172 / API-173** — `v3/work-packages.ts` injects user-controlled JSON into Prisma `where`; no project scoping
   *File:line:* `pages/api/v3/work-packages.ts` (parseFilters + list)
   *Why it matters:* No allowlist of filterable fields. Any authenticated user or API key holder can list work packages across ALL projects — cross-tenant data leak.
   *Fix:* Allowlist filterable fields; add `projectId IN (member's projects)` OR-filter for non-admin viewers; add zod schema for filters.

4. **API-115..119** — `projects/[projectId]/repository/*`: shell-injection + arbitrary localPath file read
   *File:line:* `pages/api/projects/[projectId]/repository/index.ts` + tree.ts
   *Why it matters:* Any authenticated user with `projectId` can set `localPath` to any directory and GET the repository tree — arbitrary filesystem read inside the container.
   *Fix:* Validate `localPath` against a per-project allowlist (e.g. project root only); reject `..`; sanitize `sha` param; migrate to `withRoute`.

5. **API-128** — API key returned plaintext once at create, then only bcrypt-hash stored — key cannot be recovered
   *File:line:* `pages/api/api-keys/index.ts` (and `[id].ts`)
   *Why it matters:* UX/correctness: if the user copies the wrong value or closes the modal, they must rotate the key. Also: no rotation endpoint means no deactivation.
   *Fix:* Allow at minimum a one-time re-view of the plaintext via re-auth, and add explicit `POST /api/api-keys/[id]/rotate`.

6. **API-132** — Disable 2FA without re-authentication
   *File:line:* `pages/api/users/[id]/2fa/disable.ts` (or equivalent)
   *Why it matters:* Stolen session cookie = 2FA disabled silently. Defeats the entire purpose of 2FA.
   *Fix:* Require re-entry of password + active TOTP code (or webauthn assertion) before disabling.

7. **API-130** — Backup code verification: hashedCodes vs plaintext logic flaw
   *File:line:* `pages/api/users/[id]/2fa/verify.ts`
   *Why it matters:* Combined with AUTH-5 (no constant-time compare) and AUTH-6 (modulo bias), the chain is broken: low-entropy codes + linear scan + branch on first match = brute-forceable.
   *Fix:* Use `crypto.timingSafeEqual` against hashed codes; consume-by-mark-used, not by-delete-and-hope.

8. **API-54** — `local-upload` allows arbitrary path traversal in `key`
   *File:line:* `pages/api/files/local-upload.ts`
   *Why it matters:* Attacker can write outside the intended uploads directory (`../../../etc/...`).
   *Fix:* Validate `key` is a UUID/slug; reject `..` and absolute paths; rewrite to a UUID-based key server-side.

9. **API-69** — `GET /api/webhooks/[id]` returns webhook secret
   *File:line:* `pages/api/webhooks/[id].ts`
   *Why it matters:* Webhook secret is the bearer credential for the third-party endpoint; must be write-only.
   *Fix:* Strip `secret` from the GET response; return only on create.

10. **API-59** — LDAP `bindPassword` stored plaintext
    *File:line:* `pages/api/ldap/servers.ts`
    *Why it matters:* Service-account credentials in cleartext in the DB; if DB is exfiltrated, attacker can authenticate to internal LDAP.
    *Fix:* Encrypt at rest (same envelope-encryption helper as AUTH-1) or use a secrets manager reference.

11. **DB-1** — `Notification` model has duplicate/misplaced `@@index` after `@@map`
    *File:line:* `prisma/schema.prisma` Notification model
    *Why it matters:* Migration drift; Prisma may emit the wrong SQL or reject the schema. Affects every notification read path.
    *Fix:* Move the `@@index` directives to the correct position; run `npx prisma format` and re-generate the client.

12. **DB-5** — `WikiPageVersion.authorId` set to original page author, not the editor
    *File:line:* `prisma/schema.prisma` (and the editor code path)
    *Why it matters:* Audit trail is silently wrong — the field name implies "who made this version" but stores the page creator.
    *Fix:* Update the version-create call to pass the editing user's id; add a `createdBy` to differentiate from `WikiPage.authorId`.

13. **DB-14** — `activity.create` uses non-existent field `workPackageId`
    *File:line:* the activity-creation helper invoked by work-package routes
    *Why it matters:* Runtime error (or silent field drop if the schema is permissive). Activity feed for WPs is broken or wrong.
    *Fix:* Use the polymorphic `subjectType: 'WorkPackage', subjectId: wp.id` pattern (matches other Activity emitters).

14. **API-4** — Update + activity create + notification create run outside a transaction
    *File:line:* the update+side-effects code path (e.g. `work-packages/[id].ts`)
    *Why it matters:* Partial-failure window: WP updates but no activity row, or activity fires but notification drops. Data integrity gap.
    *Fix:* Wrap in `prisma.$transaction([...])` or use an interactive transaction.

15. **WP-1** — `createRelation` does not verify `toId` exists or shares a project with `fromId`
    *File:line:* `pages/api/work-packages/[id]/relations.ts`
    *Why it matters:* Cross-project relation injection + 500 on non-existent toId (no 404 envelope).
    *Fix:* Validate `toId` exists in same project; return 404 / 422 with proper ApiError envelope.

16. **WIKI-1 / WIKI-2** — `generateSlug` imported from wrong module (broken import)
    *File:line:* `pages/api/wiki/*` (multiple)
    *Why it matters:* Runtime crash on every wiki POST/PATCH. Production-defacing.
    *Fix:* Fix the import path; add a smoke test that POSTs to `/api/projects/[id]/wiki` to catch this in CI.

17. **WIKI-3** — Cross-project privacy leak: slug lookup is not project-scoped
    *File:line:* `pages/api/wiki/[slug].ts` (non-project-scoped)
    *Why it matters:* Slugs are global but a private project's `meeting-notes` slug can collide with a public project's. The non-scoped route returns whichever wins.
    *Fix:* Make the route 404 if no `projectId` is provided, or take `projectId` as a required param and scope the slug query.

18. **WIKI-4** — Wiki macro fetches non-existent endpoint
    *File:line:* `components/wiki/WikiMarkdown.tsx`
    *Why it matters:* The `{{recent_changes}}` (or similar) macro renders a broken link in every wiki page. UX-defacing.
    *Fix:* Either implement the endpoint or strip the macro from the renderer until it exists.

19. **HS-2** — `useQuery()` creates a new `dataSignal` on every call but never wires it back to entry updates
    *File:line:* `frontend/query.js`
    *Why it matters:* UI never re-renders when TanStack Query refetches. Looks like the data is stale even when fresh.
    *Fix:* Wire the signal so components using `useQuery` re-render on success — e.g. by re-running the subscriber list on data change.

20. **TT-1** — Vitest config references non-existent `.env.test`
    *File:line:* `vitest.config.ts` (or test setup file)
    *Why it matters:* Every `vi.mock` of a module that reads `process.env.X` at import time gets `undefined`. The whole test suite is silently testing against missing-env behavior.
    *Fix:* Either add `.env.test` with safe defaults, or change the config to skip loading it. **Note:** this is the highest-leverage single fix — it likely unblocks many other test-related issues.

### High-severity tail (P1, also must-fix before merge)

- **RBAC-2** Three competing RBAC systems → consolidate to one
- **RBAC-5** `GET /api/work-packages/[id]` has no auth or membership check
- **RBAC-10** `v3/work-packages` list returns ALL WPs system-wide
- **RBAC-11** `v3/projects` dumps every project's members + emails
- **RBAC-22** `GET /api/projects` returns every project to any authed user
- **AUTH-3** `getServerSession` imported from `'next-auth'` instead of `'next-auth/next'` in 2FA routes — runtime 401
- **API-47** `isSystemAdmin` gate but no `withRoute` — race condition
- **API-96** `DELETE /api/time-entries/[id]` allows anyone to soft-delete others' entries
- **API-112** `repository` raw handler — no RBAC at all
- **FM-31** Forum DELETE cascades to threads/posts without soft-delete

---

## Phase 3 Fix Sprints (10 parallel Opus agents)

Sequencing: the "Recommended Order of Operations" section below gives the merge-conflict-free order. Each sprint has its own branch + test gate.

### Sprint 1: Auth & 2FA hardening
- **Files in scope:** `lib/auth.ts`, `lib/crypto.ts` (new), `pages/api/auth/2fa/*`, `pages/api/users/[id]/2fa/*`, `prisma/schema.prisma` (TOTP columns)
- **Findings to fix:** 18 total — AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, AUTH-6, AUTH-7, AUTH-15, AUTH-16, AUTH-17, AUTH-18, plus API-130, API-132
- **Verification:** `npx vitest run __tests__/api/auth __tests__/lib/2fa __tests__/lib/crypto` (after fixing the .env.test issue in Sprint 10)
- **Estimated complexity:** large (crypto, auth flow changes)

### Sprint 2: RBAC consolidation
- **Files in scope:** `lib/auth/project.ts`, `lib/api/withRoute.ts`, `lib/permissions/*`
- **Findings to fix:** 45 total — RBAC-1..RBAC-45 (focus on RBAC-2, RBAC-3, RBAC-4, RBAC-21..23, RBAC-32, RBAC-40, RBAC-41, RBAC-42, RBAC-43, RBAC-45)
- **Verification:** `npx vitest run __tests__/api/withRoute-rbac __tests__/api/auth-project-helpers`
- **Estimated complexity:** large (architectural; must not break Sprint 1's auth changes)

### Sprint 3: API route migration backlog (security-sensitive slice)
- **Files in scope:** ~25 raw handlers in `pages/api/` with the worst RBAC gaps
  - `time-entries/[id]/approve.ts` + `reject.ts` (API-78, API-80)
  - `v3/work-packages.ts` (API-172, API-173)
  - `projects/[projectId]/repository/*` (API-115..119, API-112)
  - `api-keys/*` (API-128)
  - `files/local-upload.ts` (API-54)
  - `webhooks/[id].ts` (API-69, RBAC-12)
  - `groups/*` (RBAC-13, RBAC-14, RBAC-15)
  - `ldap/*` (API-58, API-59, API-63)
- **Findings to fix:** ~35 of the 212 API findings (security-slice)
- **Verification:** `npx vitest run __tests__/api/time-entries __tests__/api/v3 __tests__/api/repository __tests__/api/api-keys __tests__/api/webhooks __tests__/api/groups __tests__/api/ldap`
- **Estimated complexity:** large (95 routes in total; this sprint tackles ~25)

### Sprint 4: API route migration backlog (bulk / remaining)
- **Files in scope:** remaining ~70 raw handlers in `pages/api/`
- **Findings to fix:** ~70 of 212 API findings (envelope / Sentry / rate-limit / audit gaps; non-security)
- **Verification:** `npx vitest run __tests__/api` and `npm run build` (catches envelope-shape regressions)
- **Estimated complexity:** large (mechanical, but volume)

### Sprint 5: Prisma schema & DB integrity
- **Files in scope:** `prisma/schema.prisma`, follow-up migration files
- **Findings to fix:** 40 DB findings — DB-1, DB-5, DB-14 first (critical), then DB-10, DB-22, DB-24, DB-33, DB-34, DB-40; lower-priority index additions DB-36, DB-37, DB-38, DB-39
- **Verification:** `npx prisma format && npx prisma validate && npx tsc --noEmit`
- **Estimated complexity:** medium (schema-only, but needs a migration + env-test)

### Sprint 6: Work Packages correctness
- **Files in scope:** `pages/api/work-packages/*`, `hooks/use-work-packages.ts`, `components/work-packages/*`
- **Findings to fix:** 21 WP findings — WP-1, WP-6, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Verification:** `npx vitest run __tests__/api/work-packages __tests__/components/work-packages`
- **Estimated complexity:** medium (relies on Sprint 3 for the `assertWorkPackageProjectMembership` helper)

### Sprint 7: Wiki / Documents correctness
- **Files in scope:** `pages/api/wiki/*`, `pages/api/documents/*`, `lib/markdown.ts`, `components/wiki/*`
- **Findings to fix:** 42 WikiDocs findings — WIKI-1, WIKI-2, WIKI-3, WIKI-4, WIKI-5 first; then the medium/low items
- **Verification:** `npx vitest run __tests__/api/wiki __tests__/api/documents __tests__/lib/markdown`
- **Estimated complexity:** medium

### Sprint 8: Forum / Meetings correctness
- **Files in scope:** `pages/api/forums/*`, `pages/api/meetings/*`
- **Findings to fix:** 35 FM findings — FM-3, FM-4, FM-5, FM-9, FM-22, FM-26, FM-28, FM-29, FM-30, FM-31, FM-32, FM-33, FM-34, FM-35
- **Verification:** `npx vitest run __tests__/api/forums __tests__/api/meetings`
- **Estimated complexity:** medium

### Sprint 9: Frontend (UI + Hooks/State)
- **Files in scope:** `frontend/router.js`, `frontend/components/**`, `frontend/query.js`, `frontend/store.js`, `hooks/use-*.ts`
- **Findings to fix:** 86 UI + 30 HooksState = 116 findings — UI-1, HS-2, HS-5, HS-8, HS-13 first
- **Verification:** `npx vitest run __tests__/components __tests__/hooks` and a manual `npm run dev` smoke pass
- **Estimated complexity:** medium (high volume, mostly low severity)

### Sprint 10: Tests & Tooling
- **Files in scope:** `vitest.config.ts`, `__tests__/setup.ts`, `__tests__/helpers/*` (new), test files for the new RBAC helpers
- **Findings to fix:** 30 Tests findings — TT-1, TT-2, TT-4, TT-5, TT-23, TT-24, TT-25, TT-26, TT-27
- **Verification:** `npx vitest run` (whole suite, full count delta visible)
- **Estimated complexity:** small (infra work; unblocks the other 9 sprints' tests)

---

## Cross-Cutting Themes (problems affecting multiple domains)

1. **Three competing RBAC systems** (`RBAC-2`, `RBAC-3`, `RBAC-32`, `RBAC-42`)
   - Direct `prisma.member.findUnique` (legacy)
   - `assertProjectMembership(projectId, userId, isSystemAdmin)` (Phase 7 generic)
   - Per-resource `assertXxxProjectMembership` (Phase 7 B-1..B-4)
   - Affects: RBAC, API, WorkPackages, WikiDocs, ForumMeetings
   - Resolution: pick one, deprecate the others; add an ESLint rule banning the legacy pattern.

2. **TOTP / 2FA encryption + auth gap** (`AUTH-1`, `AUTH-5`, `AUTH-6`, `API-130`, `API-132`)
   - Affects: Auth + DB + API (7 routes in `pages/api/auth/2fa/*` and `pages/api/users/[id]/2fa/*`)
   - Resolution: one envelope-encryption helper consumed by all write/read paths; one re-auth gate consumed by all "disable" paths.

3. **`withRoute` migration backlog** (95 raw handlers)
   - Affects: API + every domain that uses routes (RBAC, WorkPackages, WikiDocs, ForumMeetings, UI smoke tests)
   - Resolution: one pattern (`withRoute` + zod + rbac callback + envelope + Sentry + audit) replicated in 95 files. Phase 7 B-1..B-4 already shipped 12 — pattern is proven, just volume.

4. **Test gaps for new helpers** (`RBAC-3`, `RBAC-42`, `RBAC-43`, `TT-26`)
   - Affects: Tests + RBAC + every new feature
   - Resolution: a single test scaffold (`__tests__/api/withRoute-rbac.test.ts`) that exercises the rbac-callback pattern once and serves as a template.

5. **XSS / markdown sanitization** (`UI-*` + `WIKI-*` for `ALLOWED_URI_REGEXP`)
   - Affects: frontend (innerHTML usage in primitives/index.js) + wiki markdown renderer
   - Resolution: standardize on a `safeHtml()` helper that runs DOMPurify with a project-wide config; ban raw `innerHTML` and `dangerouslySetInnerHTML` outside that helper.

6. **Cross-tenant data leaks** (RBAC-9, RBAC-10, RBAC-11, RBAC-13, RBAC-22, RBAC-23, API-172, API-173)
   - Affects: every "list" endpoint that doesn't have a project-scope in the path
   - Resolution: middleware-level "is the query scoped to a projectId this user is a member of?" check; default-deny for unscoped lists.

7. **Transactional inconsistency** (`API-4`, `API-14`, `API-19`, others)
   - Affects: work-packages update + activity + notification; member add + activity; many mutation paths
   - Resolution: a `withTransaction` HOF wrapper or ESLint rule banning multi-write handlers without `prisma.$transaction`.

---

## Out-of-Scope (pre-existing baselines, NOT in this report)

Per AGENTS.md and the task brief, these are **pre-existing** and are NOT to be fixed as part of Phase 3:

- `__tests__/api/work-packages.unit.test.ts` — 6 pre-existing failures
- `__tests__/api/work-package-permissions.unit.test.ts` — 7 pre-existing failures
- `__tests__/api/forums.unit.test.ts` — pre-existing baseline
- `__tests__/api/auth/2fa.test.ts` — pre-existing baseline
- `__tests__/api/projects.unit.test.ts` — pre-existing baseline
- `__tests__/api/calendar.unit.test.ts` — pre-existing baseline
- `__tests__/components/ui-smoke.test.tsx` — pre-existing baseline
- `__tests__/api/notifications.unit.test.ts` — pre-existing baseline
- `npx tsc --noEmit` ~412 pre-existing errors in unrelated test files
- Stash `p7-b3.4-ext` coordination item

Sprint 10's verification **must** verify that the count delta of new tests matches what was added, and must NOT chase these baselines.

---

## Recommended Order of Operations for Phase 3

To avoid merge conflicts across 10 parallel agents, sequence the sprints so the foundation lands first:

1. **Foundation — DB schema (Sprint 5) first.** All other sprints touch `prisma/schema.prisma`; land DB-1, DB-5, DB-14 + the index additions in a single migration. Ships: schema + migration.
2. **Foundation — Tests/Tooling (Sprint 10) in parallel with Sprint 5.** Fix `vitest.config.ts` (TT-1), MSW (TT-2), and add `__tests__/helpers/mockPrisma.ts` (TT-27). Ships: working test infra for every other sprint.
3. **Security — Auth (Sprint 1) and RBAC consolidation (Sprint 2) next.** Both depend on Sprint 5's schema (for AUTH-1) and both are foundation for the API sprint. Run in parallel.
4. **Security — API migration security slice (Sprint 3).** Depends on Sprints 1, 2, 10. Migrates the ~25 worst RBAC gaps to `withRoute`.
5. **Domain — Work Packages (Sprint 6), Wiki (Sprint 7), Forum (Sprint 8).** All can run in parallel after Sprint 3 lands, since the patterns are now established.
6. **Domain — Frontend (Sprint 9).** Independent of API sprints; can run in parallel from Sprint 3 onward.
7. **Cleanup — API migration bulk (Sprint 4).** Lands last because the remaining raw handlers are low-severity and can absorb pattern changes from Sprints 1–3 without conflict.

Each sprint is its own branch + PR. The merge order matches this sequence: 5 → 10 → (1 ∥ 2) → 3 → (4 ∥ 6 ∥ 7 ∥ 8 ∥ 9).

---

## Appendix: Severity distribution by report file

| File | findings | crit | high | med | low | parsing notes |
|------|---------:|-----:|-----:|----:|----:|---------------|
| 01-auth.jsonl        |  18 |  1 |  6 |  6 |  5 | has `===SUMMARY===` marker; counts match |
| 02-rbac.jsonl        |  45 |  3 | 20 | 12 | 10 | no marker; counts match |
| 03-api.jsonl         | 212 | 21 | 97 | 73 | 21 | 220 reported in header, 8 lines are SUMMARY text (not JSON findings) |
| 04-prisma.jsonl      |  40 |  3 |  8 | 16 | 13 | counts match |
| 05-work-packages.jsonl| 21 |  1 |  3 |  6 | 11 | counts match |
| 06-wiki-docs.jsonl   |  42 |  5 | 13 | 15 |  9 | 44 reported in header, 2 are non-JSON summary lines |
| 07-forum-meetings.jsonl| 35 |  0 | 11 | 13 | 11 | counts match (35 of 34 because one extra) |
| 08-pages-ui.jsonl    |  86 |  1 |  8 | 16 | 61 | 90 reported in header, 4 are non-JSON summary lines |
| 09-hooks-state.jsonl |  30 |  4 | 17 |  8 |  1 | counts match |
| 10-tests-tooling.jsonl| 30 |  4 |  8 | 14 |  4 | counts match |
| **TOTAL**            |**559**|**43**|**191**|**179**|**146**| 15 header lines are not valid JSON findings |

This report was generated as read-only synthesis. No source code was modified, no commits were made, and no secrets were accessed.
