import React from 'react'
import Link from 'next/link'
import type { ForumThread } from '@/types/forum'

interface ForumThreadListProps {
  threads: ForumThread[]
  forumId: string
  projectId: string
  isLoading?: boolean
}

export function ForumThreadList({ threads, forumId, projectId, isLoading }: ForumThreadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ThreadSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No threads yet</p>
        <p className="text-gray-400 text-xs mt-1">Start a new thread to begin discussion</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          forumId={forumId}
          projectId={projectId}
        />
      ))}
    </div>
  )
}

export function ThreadCard({
  thread,
  forumId,
  projectId,
}: {
  thread: ForumThread
  forumId: string
  projectId: string
}) {
  const replyCount = (thread._count?.posts ?? thread.posts?.length ?? 0) - 1
  const isUnread = false // Could be computed from lastReadAt vs updatedAt

  return (
    <Link
      href={`/projects/${projectId}/forums/${forumId}/threads/${thread.id}`}
      className="block group"
    >
      <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Status icons */}
            <div className="flex flex-col items-center gap-1 text-gray-400 mt-0.5">
              {thread.isSticky && (
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.293 2.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 9l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
              )}
              {thread.isLocked && (
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {!thread.isSticky && !thread.isLocked && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium group-hover:text-blue-600 transition-colors ${isUnread ? 'text-blue-600' : 'text-gray-900'}`}>
                  {thread.subject}
                </span>
                {isUnread && (
                  <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                <span className={thread.author ? '' : 'text-gray-400'}>
                  {thread.author?.name ?? 'Unknown'}
                </span>
                <span className="mx-1">·</span>
                <span>{formatRelativeTime(thread.createdAt)}</span>
                {replyCount > 0 && (
                  <>
                    <span className="mx-1">·</span>
                    <span>{replyCount} repl{replyCount === 1 ? 'y' : 'ies'}</span>
                  </>
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

function ThreadSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse mt-1" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}