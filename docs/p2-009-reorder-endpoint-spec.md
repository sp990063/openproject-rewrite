# p2-009: POST /api/work-packages/reorder

## Request

```
POST /api/work-packages/reorder
```

**Body:**
```typescript
{
  workPackageId: string;
  targetStatusId: string;
  position: number;          // integer, 0-based
}
```

---

## Response

**Success (200):**
```typescript
{
  workPackage: {
    id: string;
    position: number;
    statusId: string;
  };
  column: {
    statusId: string;
    workPackages: Array<{
      id: string;
      position: number;
    }>;
  };
}
```

Returns the full updated column order so the client can sync optimistically.

---

## Behavior

1. Validate caller has `WORK_PACKAGE_EDIT` permission on the project
2. Begin transaction:
   - Update `statusId` → `targetStatusId`
   - Update `position` → clamped value
   - **Shift up:** `position >= targetPosition` in target column → `position + 1`
   - **Shift down:** If work package came from another column, shift old column down: `position > oldPosition` → `position - 1`
3. Return updated work package + full target column order

---

## Permission

`WORK_PACKAGE_EDIT` on the work package's project.

---

## Error Responses

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `INVALID_POSITION` | position negative or NaN |
| 400 | `SAME_STATUS_SAME_POSITION` | No-op, but return success |
| 403 | `FORBIDDEN` | No edit permission |
| 404 | `WORK_PACKAGE_NOT_FOUND` | Work package doesn't exist |
| 404 | `STATUS_NOT_FOUND` | Target status doesn't exist in project |

---

## Edge Cases

| Case | Handling |
|------|----------|
| `position` > column.length | Clamp to `column.length` |
| `position` < 0 | Clamp to `0` |
| Same status + same position | No-op, return 200 with current state |
| Drag to empty column | position = 0, shift step skipped |
| Work package not in project | 404 |

---

## Files to create/modify

```
prisma/schema.prisma                     — (no change needed)
app/api/work-packages/reorder/
  route.ts                               — POST handler + validation
  service.ts                             — transaction logic + permission check
lib/permissions/work-packages.ts         — add reorder permission guard
pages/api/work-packages/reorder.ts       — Next.js route entry
```

---

## Test Cases to Cover

```
□ Move within same column (reorder)
□ Move to different column
□ Move to empty column
□ Move to position > length (clamp)
□ Move to position < 0 (clamp)
□ Same status + same position (no-op)
□ No permission → 403
□ Invalid work package → 404
□ Invalid status → 404
```

---

## Status

- [x] spec written
- [x] implementation (subagent + review)
- [ ] tests — no dedicated test file yet; tested via integration
