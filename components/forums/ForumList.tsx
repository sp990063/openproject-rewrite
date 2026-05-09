import React from 'react'
import Link from 'next/link'
import type { Forum } from '@/types/forum'

interface ForumListProps {
  forums: Forum[]
  projectId: string
  isLoading?: boolean
}

export function ForumList({ forums, projectId, isLoading }: ForumListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ForumSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!forums || forums.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No forums yet</p>
        <p className="text-gray-400 text-xs mt-1">Create a forum to start discussions</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {forums.map((forum) => (
        <ForumCard key={forum.id} forum={forum} projectId={projectId} />
      ))}
    </div>
  )
}

export function ForumCard({ forum, projectId }: { forum: Forum; projectId: string }) {
  const threadCount = forum._count?.threads ?? forum.threads?.length ?? 0

  return (
    <Link
      href={`/projects/${projectId}/forums/${forum.id}`}
      className="block group"
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
              <div className="text-xs text-gray-400 mt-1.5">
                {threadCount} thread{threadCount === 1 ? '' : 's'}
                {forum.author && (
                  <> · Created by {forum.author.name}</>
                )}
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
  )
}

function ForumSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}