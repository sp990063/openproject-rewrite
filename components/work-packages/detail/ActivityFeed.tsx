import React from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { useWorkPackageActivities } from '@/hooks/use-work-packages'
import type { Activity } from '@/types'

interface ActivityFeedProps {
  workPackageId: string
}

export function ActivityFeed({ workPackageId }: ActivityFeedProps) {
  const { data: activities, isLoading, isError } = useWorkPackageActivities(workPackageId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError || !activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities?.map((activity: Activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

// ─── ActivityItem ──────────────────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: Activity }) {
  const [showTime, setShowTime] = React.useState(false)

  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })

  return (
    <div
      className="flex gap-3 py-3 border-b border-gray-50 last:border-0 group"
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* User avatar */}
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
        style={{ backgroundColor: stringToColor(activity.user?.name ?? '?') }}
        aria-hidden="true"
      >
        {activity.user?.name?.charAt(0).toUpperCase() ?? '?'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-relaxed">
          <span className="font-medium text-gray-900">
            {activity.user?.name ?? 'Someone'}
          </span>{' '}
          <span className="text-gray-600">{activity.comment ?? getActivityDescription(activity)}</span>
        </div>
        <div className={`text-xs text-gray-400 mt-0.5 transition-opacity ${showTime ? 'opacity-100' : 'opacity-0'}`}>
          {timeAgo} · {format(new Date(activity.createdAt), 'MMM d, yyyy HH:mm')}
        </div>
      </div>
    </div>
  )
}

// ─── Activity types ─────────────────────────────────────────────────────────────

function getActivityDescription(activity: Activity): string {
  // Generic description for system-generated activities without comments
  switch (activity.action) {
    case 'created':
      return 'created this work package'
    case 'updated':
      return 'updated this work package'
    case 'commented':
      return 'commented'
    default:
      return 'updated this work package'
  }
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  return colors[Math.abs(hash) % colors.length]
}
