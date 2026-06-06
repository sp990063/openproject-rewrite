// components/work-packages/table/WorkPackageTableSkeleton.tsx
// v2 design-system-aligned loading skeleton for the work-package table.
// Uses the new <Skeleton> primitive from components/feedback/Skeleton so
// the pulse animation + dark-mode tone stay consistent.
import { Skeleton } from '@/components/feedback/Skeleton'

const COLUMN_WIDTHS = [200, 120, 100, 100, 140, 110, 110, 90] as const
const ROW_WIDTHS = [220, 100, 80, 80, 120, 90, 90, 60] as const

export function WorkPackageTableSkeleton() {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-live="polite">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-3 border-b border-border-subtle">
        <Skeleton variant="circle" className="w-4 h-4" />
        {COLUMN_WIDTHS.map((w, i) => (
          <Skeleton
            key={i}
            variant="text"
            className="h-4"
            style={{ width: w }}
          />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton variant="circle" className="w-4 h-4" />
          {ROW_WIDTHS.map((w, j) => (
            <Skeleton
              key={j}
              variant="text"
              className="h-4"
              style={{
                width: w,
                animationDelay: `${j * 50}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
