// components/work-packages/board/WorkPackageBoardSkeleton.tsx
// v2 design-system-aligned loading skeleton for the kanban board.
import { Skeleton } from '@/components/feedback/Skeleton'

const COLUMNS = 4
const CARDS_PER_COLUMN = [3, 2, 4, 1] as const

export function WorkPackageBoardSkeleton() {
  return (
    <div
      className="flex gap-4 p-4 overflow-x-auto"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: COLUMNS }).map((_, colIdx) => (
        <div key={colIdx} className="flex-shrink-0 w-64">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="circle" className="h-5 w-6" />
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {Array.from({ length: CARDS_PER_COLUMN[colIdx] }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="bg-surface-card rounded-xl border border-border-subtle p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <Skeleton variant="text" className="h-3 w-12" />
                  <Skeleton variant="circle" className="h-3 w-3" />
                </div>
                <Skeleton variant="text" className="h-4 w-full mb-1" />
                <Skeleton variant="text" className="h-4 w-3/4 mb-3" />
                <div className="flex items-center justify-between">
                  <Skeleton variant="circle" className="h-5 w-5" />
                  <Skeleton variant="text" className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
