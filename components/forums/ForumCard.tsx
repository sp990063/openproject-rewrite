import React from 'react'
import Link from 'next/link'
import type { Forum } from '@/types/forum'
import { Badge } from '@/components/ui'

interface ForumCardItemProps {
  forum: Forum
  onClick?: () => void
}

export function ForumCardItem({ forum, onClick }: ForumCardItemProps) {
  const threadCount = forum._count?.threads ?? forum.threads?.length ?? 0
  const createdDate = new Date(forum.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      <Link
        href={`/projects/${forum.projectId}/forums/${forum.id}`}
        className="block group"
        onClick={(e) => {
          if (onClick) {
            e.preventDefault()
          }
        }}
      >
        <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {forum.name}
                </div>
                {forum.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{forum.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default">
                    {threadCount} thread{threadCount === 1 ? '' : 's'}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    Created {createdDate}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
