// components/work-packages/gantt/WorkPackageGanttSkeleton.tsx
// v2 design-system-aligned loading skeleton for the Gantt chart.
import { Skeleton } from '@/components/feedback/Skeleton'

const ROWS = 8

export function WorkPackageGanttSkeleton() {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Timeline header */}
      <div className="flex border-b border-border-subtle">
        <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-border-subtle bg-surface-sunken">
          <Skeleton variant="text" className="h-4 w-24" />
        </div>
        <div className="flex-1 flex">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-10 border-r border-border-divider ${
                i === 14 ? 'bg-info-bg/30' : ''
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: ROWS }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex flex-1 min-h-[45px] border-b border-border-divider"
        >
          <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-border-subtle bg-surface-card">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-3 w-3" />
              <Skeleton
                variant="text"
                className={`h-4 ${
                  rowIdx % 3 === 0
                    ? 'w-32'
                    : rowIdx % 3 === 1
                      ? 'w-24'
                      : 'w-28'
                }`}
              />
            </div>
          </div>
          <div className="flex-1 relative flex items-center">
            {rowIdx % 3 === 0 && (
              <Skeleton
                variant="rect"
                className="absolute h-5"
                style={{
                  left: `${(rowIdx * 7) % 40}%`,
                  width: `${20 + (rowIdx * 5) % 20}%`,
                }}
              />
            )}
            {rowIdx % 3 === 1 && (
              <Skeleton
                variant="rect"
                className="absolute h-5"
                style={{
                  left: `${(rowIdx * 12) % 30}%`,
                  width: `${15 + (rowIdx * 8) % 25}%`,
                }}
              />
            )}
            {rowIdx % 3 === 2 && (
              <Skeleton
                variant="rect"
                className="absolute h-5"
                style={{
                  left: `${(rowIdx * 5) % 50}%`,
                  width: `${30 + rowIdx * 3}%`,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
