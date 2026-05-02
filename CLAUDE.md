# OpenProject Rewrite — CLAUDE.md

## Project Purpose

This is the OpenProject Next.js rewrite project. The goal is to rebuild OpenProject using modern tooling while maintaining feature parity.

**Location:** `/home/cwlai/openproject-rewrite`

## Tech Stack

- **Next.js 15.5.15** (Pages Router, NOT App Router)
- **Prisma 7.7.0** + PostgreSQL
- **NextAuth.js v5** (beta)
- **Zustand 5.0.12** (client state)
- **TanStack Query 5.99.0** (server state)
- **Radix UI** + **Tailwind CSS v4**
- **Vitest 4.1.4** + **MSW 2.13.4**

## Key Conventions

### DO: Pages Router Only
- Pages: `pages/` directory
- APIs: `pages/api/` directory
- **NEVER use App Router** (no `app/` directory)

### DO: Prisma 7 Types
```prisma
name String @db.VarChar(255)
description String @db.Text
```

### DO: NextAuth.js v5 Patterns
```typescript
// lib/auth.ts has these helpers:
isSystemAdmin(userId: string): Promise<boolean>
validatePassword(inputPassword: string, user: {...}): Promise<boolean>
```

### DO: TanStack Query + Zustand
- Server state: TanStack Query hooks in `hooks/`
- Client state: Zustand store in `stores/`

## Quality Gates

All code must pass before merging:
```bash
npm test
npm run build
npx tsc --noEmit
```

## Skills

This project has custom skills installed:

- `skills/openproject-rewrite/SKILL.md` — Master project skill
- `skills/openproject-phase2-work-packages/SKILL.md` — Phase 2 guidance
- `agent-skills/` — Standard engineering skills

Also see slash commands in `.claude/commands/`

## Important Paths

| Path | Purpose |
|------|---------|
| `pages/` | Next.js pages |
| `components/` | React components |
| `lib/` | Utilities |
| `stores/` | Zustand stores |
| `hooks/` | TanStack Query hooks |
| `prisma/schema.prisma` | Database schema |

## Wiki Specs

Detailed specs at:
```
/home/cwlai/wiki/concepts/openproject-rewrite-phase*-spec.md
```
