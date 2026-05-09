import React from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import type { WikiPageVersion, User } from '@/types/wiki'

interface WikiVersionHistoryProps {
  versions: WikiPageVersion[]
  currentVersion: number
  onRestore?: (version: number) => void
  onViewVersion?: (version: WikiPageVersion) => void
  isRestoring?: boolean
}

export function WikiVersionHistory({
  versions,
  currentVersion,
  onRestore,
  onViewVersion,
  isRestoring = false,
}: WikiVersionHistoryProps) {
  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">No version history available</p>
        <p className="text-gray-400 text-xs mt-1">Version history will appear here after edits</p>
      </div>
    )
  }

  // Sort versions by version number descending (newest first)
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

  return (
    <div className="wiki-version-history">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {versions.length} Revision{versions.length === 1 ? '' : 's'}
        </h3>
        <button
          onClick={() => {}}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      <div className="space-y-1">
        {sortedVersions.map((version) => (
          <VersionItem
            key={version.id}
            version={version}
            isCurrent={version.version === currentVersion}
            onRestore={onRestore}
            onViewVersion={onViewVersion}
            isRestoring={isRestoring}
          />
        ))}
      </div>
    </div>
  )
}

function VersionItem({
  version,
  isCurrent,
  onRestore,
  onViewVersion,
  isRestoring,
}: {
  version: WikiPageVersion
  isCurrent: boolean
  onRestore?: (version: number) => void
  onViewVersion?: (version: WikiPageVersion) => void
  isRestoring: boolean
}) {
  const timeAgo = formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })
  const fullDate = format(new Date(version.createdAt), 'MMM d, yyyy HH:mm')

  return (
    <div
      className={`p-3 rounded-lg transition-colors ${
        isCurrent ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              v{version.version}
            </span>
            {isCurrent && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                Current
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5" title={fullDate}>
            {timeAgo}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            by {version.authorId.slice(0, 8)}...
          </div>
        </div>

        {!isCurrent && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onViewVersion && (
              <button
                onClick={() => onViewVersion(version)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                disabled={isRestoring}
              >
                View
              </button>
            )}
            {onRestore && (
              <button
                onClick={() => onRestore(version.version)}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                disabled={isRestoring}
              >
                Restore
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function WikiVersionHistorySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-2" />
          <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mt-1" />
        </div>
      ))}
    </div>
  )
}
