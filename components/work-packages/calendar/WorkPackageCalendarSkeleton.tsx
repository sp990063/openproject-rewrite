// components/work-packages/calendar/WorkPackageCalendarSkeleton.tsx
// v2 design-system-aligned loading skeleton for the calendar view.
import { Skeleton } from '@/components/feedback/Skeleton'

export function WorkPackageCalendarSkeleton() {
  return (
    <div className="flex flex-col h-full" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <Skeleton variant="text" className="h-5 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton variant="rect" className="h-8 w-8" />
          <Skeleton variant="rect" className="h-8 w-24" />
          <Skeleton variant="rect" className="h-8 w-8" />
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 border-b border-border-divider">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="text-center py-2 text-xs text-text-muted font-medium"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-r border-border-divider p-2 min-h-[80px]"
          >
            <Skeleton variant="circle" className="h-4 w-4 mb-1" />
            <div className="space-y-1">
              {i % 3 === 0 && (
                <Skeleton variant="rect" className="h-5 w-full" />
              )}
              {i % 5 === 1 && (
                <Skeleton variant="rect" className="h-5 w-3/4" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
