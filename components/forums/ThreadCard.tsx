import React from 'react'
import Link from 'next/link'
import type { ForumThread } from '@/types/forum'
import { Badge } from '@/components/ui'

interface ThreadCardItemProps {
  thread: ForumThread
  onClick?: () => void
}

export function ThreadCardItem({ thread, onClick }: ThreadCardItemProps) {
  const replyCount = Math.max(0, (thread._count?.posts ?? thread.posts?.length ?? 0) - 1)
  const lastReplyTime = formatRelativeTime(thread.updatedAt)

  return (
    <div
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      <Link
        href={`/projects/${thread.forum?.projectId ?? thread.forumId}/forums/${thread.forumId}/threads/${thread.id}`}
        className="block group"
        onClick={(e) => {
          if (onClick) {
            e.preventDefault()
          }
        }}
      >
        <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Status icons */}
              <div className="flex flex-col items-center gap-1 text-gray-400 mt-0.5 min-w-[24px]">
                {thread.isSticky && (
                  <span className="text-sm" title="Sticky">📌</span>
                )}
                {thread.isLocked && (
                  <span className="text-sm" title="Locked">🔒</span>
                )}
                {!thread.isSticky && !thread.isLocked && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                    {thread.subject}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span className={thread.author ? 'text-gray-600' : 'text-gray-400'}>
                    {thread.author?.name ?? 'Unknown'}
                  </span>
                  <span>·</span>
                  <span>Last reply {lastReplyTime}</span>
                  <span>·</span>
                  <Badge variant="default">
                    {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                  </Badge>
                  <span>·</span>
                  <span>{thread._count?.posts ?? 0} messages</span>
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
