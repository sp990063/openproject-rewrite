# Plan: Phase 2 Foundation (p2-001 to p2-003) — Status Review

## Goal

Determine the actual status of Phase 2.1 Foundation tasks (p2-001, p2-002, p2-003) and plan next steps.

## Current Context / Assumptions

Based on code inspection:

| Task | Expected | Actual | Status |
|------|----------|--------|--------|
| p2-001: Extend `types/index.ts` | Add `WorkPackageFilter`, `GanttWorkPackage`, `BoardColumn`, `CalendarEvent`, `Query` | All 5 types already exist at lines 145-203 | ✅ DONE |
| p2-002: Create `queries/queryKeys.ts` | TanStack Query key factories | Already exists at `queries/queryKeys.ts` with full coverage | ✅ DONE |
| p2-003: Confirm dependencies | `@tanstack/react-virtual` ^3.10.0, `date-fns` ^4.0.0 | Both installed: `react-virtual@3.13.24`, `date-fns@4.1.0` | ✅ DONE |

## Proposed Approach

The foundation tasks are already complete. The next logical step is to proceed to Phase 2.2: API Routes.

## Step-by-Step Plan

### Phase 2.1 — Already Complete ✅
- p2-001 ✅ `types/index.ts` extended
- p2-002 ✅ `queries/queryKeys.ts` created
- p2-003 ✅ Dependencies confirmed installed

### Phase 2.2 — API Routes (p2-004 to p2-009)

**p2-004**: `GET/PATCH/DELETE /api/work-packages/[id]`
- Location: `pages/api/work-packages/[id].ts`
- Add Zod validation
- Add date range validation (dueDate >= startDate)
- Extend existing route handlers

**p2-005**: `GET /api/work-packages/[id]/activities`
- Location: `pages/api/work-packages/[id]/activities.ts`
- Return activities for work package

**p2-006**: `GET/POST /api/work-packages/[id]/relations`
- Location: `pages/api/work-packages/[id]/relations.ts`
- GET: Return relations
- POST: Create relation with Zod validation

**p2-007**: `DELETE /api/relations/[id]`
- Location: `pages/api/relations/[id].ts`
- Delete relation by ID

**p2-008**: `GET/POST/PATCH/DELETE /api/queries`
- Location: `pages/api/queries.ts` + `[id].ts`
- Full CRUD for saved queries

**p2-009**: `POST /api/work-packages/reorder`
- Location: `pages/api/work-packages/reorder.ts`
- Handle drag-and-drop reorder (Board/Gantt position updates)

## Files Likely to Change

- `types/index.ts` (already has types, may need minor additions)
- `pages/api/work-packages/[id].ts` (extend)
- `pages/api/work-packages/[id]/activities.ts` (new)
- `pages/api/work-packages/[id]/relations.ts` (new)
- `pages/api/relations/[id].ts` (new)
- `pages/api/queries.ts` (new)
- `pages/api/queries/[id].ts` (new)
- `pages/api/work-packages/reorder.ts` (new)

## Tests / Validation

```bash
npm test                      # Run full test suite
npm run build                 # Verify build
npx tsc --noEmit             # TypeScript check
```

## Risks, Tradeoffs, and Open Questions

1. **Date validation**: Need to ensure `dueDate >= startDate` validation is enforced at API level, not just UI
2. **Permissions**: API routes should check user has permission to view/modify work packages
3. **Real-world usage**: The seed data should include realistic work packages for testing all views

## Next Action

Proceed to p2-004: Extend `GET/PATCH/DELETE /api/work-packages/[id]` with Zod validation and date range checks.
