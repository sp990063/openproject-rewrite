# OpenProject Rewrite — Phase 2 Task List

> Status: **Not started** (as of 2026-04-25)
> Source: Phase 2 spec + existing codebase analysis

## Overview

34 sub-tasks across 10 groups (A–K). Estimated ~3–4 weeks.

## Task List

### Phase 2.1: Foundation (Start here)

- [ ] **p2-001**: Extend `types/index.ts` — Add `WorkPackageFilter`, `GanttWorkPackage`, `BoardColumn`, `CalendarEvent`, `Query` interfaces
- [ ] **p2-002**: Create `queries/queryKeys.ts` — All TanStack Query key factories
- [ ] **p2-003**: Confirm `@tanstack/react-virtual` ^3.10.0 and `date-fns` ^4.0.0 are installed

### Phase 2.2: API Routes

- [ ] **p2-004**: `GET/PATCH/DELETE /api/work-packages/[id]` + Zod validation + date range validation (dueDate >= startDate)
- [ ] **p2-005**: `GET /api/work-packages/[id]/activities`
- [ ] **p2-006**: `GET/POST /api/work-packages/[id]/relations`
- [ ] **p2-007**: `DELETE /api/relations/[id]`
- [ ] **p2-008**: `GET/POST/PATCH/DELETE /api/queries` CRUD
- [ ] **p2-009**: `POST /api/work-packages/reorder`

### Phase 2.3: Hooks

- [ ] **p2-010**: Refactor `hooks/use-work-packages.ts` — Add filter params, `useWorkPackage(id)`, `useUpdateWorkPackage` (optimistic), `useWorkPackageRelations`, `useCreateRelation`, `useSavedQueries`

### Phase 2.4: Table View

- [ ] **p2-011**: `WorkPackageTable.tsx` — Main container + `@tanstack/react-virtual` virtual scrolling
- [ ] **p2-012**: `WorkPackageTableHeader.tsx` — Sortable columns
- [ ] **p2-013**: `WorkPackageFilters.tsx` — Filter bar (status/type/assignee/priority/date-range/text)
- [ ] **p2-014**: `WorkPackageInlineEdit.tsx` — Double-click edit + `editLockRef` to prevent race condition
- [ ] **p2-015**: `WorkPackageTableRow.tsx` + `WorkPackageTableCell.tsx` + `WorkPackageBulkActions.tsx`

### Phase 2.5: Gantt View

- [ ] **p2-016**: Create `lib/gantt/calculate.ts` — `parseDate`, `calculateGanttLayout`, `getDayWidth`, `calculatePath` (SVG dependency arrows)
- [ ] **p2-017**: `GanttChart.tsx` + `GanttTimeline.tsx` + `GanttRows.tsx`
- [ ] **p2-018**: `GanttBar.tsx` (drag-to-resize) + `GanttDependencyLines.tsx` (SVG) + `GanttTodayLine.tsx` + `GanttZoomControls.tsx`

### Phase 2.6: Board View

- [ ] **p2-019**: `WorkPackageBoard.tsx` — DnD Kit integration + optimistic status update
- [ ] **p2-020**: `WorkPackageBoardColumn.tsx` + `WorkPackageBoardCard.tsx` + `WorkPackageBoardColumnHeader.tsx`
- [ ] **p2-021**: `WorkPackageBoardAddCard.tsx` + `WorkPackageBoardDragLayer.tsx`
- [ ] **p2-022**: WIP Limit — `isOverLimit`/`isAtLimit` visual hints + block drop when over limit

### Phase 2.7: Calendar View

- [ ] **p2-023**: `WorkPackageCalendar.tsx` — month/week toggle + date range calculation
- [ ] **p2-024**: `WorkPackageCalendarHeader.tsx` + `WorkPackageCalendarGrid.tsx` + `WorkPackageCalendarCell.tsx` + `WorkPackageCalendarEvent.tsx` (@dnd-kit drag)
- [ ] **p2-025**: Ensure server-side date range filtering (NOT client-side after loading all)

### Phase 2.8: Work Package Detail

- [ ] **p2-026**: `pages/projects/[projectId]/work-packages/[id]/page.tsx` main layout
- [ ] **p2-027**: `SubjectInlineEdit` + `DescriptionEditor` + `AttributeSidebar` (StatusSelect/UserSelect/DatePicker)
- [ ] **p2-028**: `ActivityFeed.tsx` + `RelationsList` + `AddRelationButton`

### Phase 2.9: Query Management

- [ ] **p2-029**: Save Query dialog + Query switcher dropdown + `isDefault` support + connect to Filter bar

### Phase 2.10: Polish

- [ ] **p2-030**: Loading skeletons (one per view)
- [ ] **p2-031**: Empty states (one per view)
- [ ] **p2-032**: View switcher tabs (Table/Gantt/Board/Calendar) integrated into `pages/projects/[projectId]/work-packages/index.tsx`
- [ ] **p2-033**: Error handling + retry + responsive adjustments

### Phase 2.11: Testing

- [ ] **p2-034**: Confirm existing tests still pass + add tests for new Phase 2 hooks/components

---

## Next Task to Start

**p2-001** — Extend `types/index.ts`

## Dependencies

```
p2-001 (types)        → all
p2-002 (queryKeys)    → C, D, E, F, G, H, I
p2-003 (deps)         → D, E, F, G

B (API Routes)        → C (hooks)
C (Hooks)              → D, F, G, H

D (Table)              → J (polish)
E (Gantt)              → J
F (Board)              → J
G (Calendar)           → J
H (Detail)             → J
I (Query)              → J

J (Polish)             → K (Testing)
```

## Quick Reference

| Group | Tasks | Status |
|-------|-------|--------|
| A. Foundation | p2-001 to p2-003 | ⬜ Not started |
| B. API Routes | p2-004 to p2-009 | ⬜ Not started |
| C. Hooks | p2-010 | ⬜ Not started |
| D. Table View | p2-011 to p2-015 | ⬜ Not started |
| E. Gantt View | p2-016 to p2-018 | ⬜ Not started |
| F. Board View | p2-019 to p2-022 | ⬜ Not started |
| G. Calendar View | p2-023 to p2-025 | ⬜ Not started |
| H. Detail | p2-026 to p2-028 | ⬜ Not started |
| I. Query | p2-029 | ⬜ Not started |
| J. Polish | p2-030 to p2-033 | ⬜ Not started |
| K. Testing | p2-034 | ⬜ Not started |
