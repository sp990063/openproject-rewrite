'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  projectId: string
  userId: string
  subjectType: string
  subjectId: string
  action: string
  details: unknown
  mentionIds: string[]
  reference: unknown
  isArchived: boolean
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  comments: Array<{
    id: string
    userId: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      avatarUrl: string | null
    }
  }>
}

const SUBJECT_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  work_package: { icon: '📋', color: 'bg-blue-100 text-blue-600' },
  wiki_page: { icon: '📄', color: 'bg-purple-100 text-purple-600' },
  forum_post: { icon: '💬', color: 'bg-green-100 text-green-600' },
  document: { icon: '📎', color: 'bg-yellow-100 text-yellow-600' },
  meeting: { icon: '📅', color: 'bg-red-100 text-red-600' },
  news: { icon: '📢', color: 'bg-orange-100 text-orange-600' },
  time_entry: { icon: '⏱️', color: 'bg-gray-100 text-gray-600' },
  member: { icon: '👤', color: 'bg-indigo-100 text-indigo-600' },
  version: { icon: '🏷️', color: 'bg-pink-100 text-pink-600' },
}

const ACTION_TEXT: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  commented: 'commented on',
}

function getSubjectUrl(subjectType: string, subjectId: string, projectId: string): string {
  switch (subjectType) {
    case 'work_package':
      return `/projects/${projectId}/work-packages/${subjectId}`
    case 'wiki_page':
      return `/projects/${projectId}/wiki/${subjectId}`
    case 'forum_post':
      return `/projects/${projectId}/forums/${subjectId}`
    case 'document':
      return `/projects/${projectId}/documents/${subjectId}`
    case 'meeting':
      return `/projects/${projectId}/meetings/${subjectId}`
    case 'news':
      return `/projects/${projectId}/news/${subjectId}`
    default:
      return '#'
  }
}

function getReferenceName(reference: unknown): string {
  if (!reference) return 'this item'
  if (typeof reference === 'object' && reference !== null) {
    const ref = reference as Record<string, unknown>
    return (ref.subject as string) || (ref.title as string) || (ref.name as string) || 'this item'
  }
  return 'this item'
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  return colors[Math.abs(hash) % colors.length]
}

export function ActivityItem({ activity }: { activity: Activity }) {
  const [showTime, setShowTime] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const config = SUBJECT_TYPE_CONFIG[activity.subjectType] || { icon: '📌', color: 'bg-gray-100 text-gray-600' }
  const actionText = ACTION_TEXT[activity.action] || activity.action
  const referenceName = getReferenceName(activity.reference)
  const subjectUrl = getSubjectUrl(activity.subjectType, activity.subjectId, activity.projectId)
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })

  const hasDetails = activity.details && Array.isArray(activity.details) && activity.details.length > 0
  const hasComments = activity.comments && activity.comments.length > 0
  const isGroupable = hasDetails || hasComments

  return (
    <div
      className="p-4 hover:bg-gray-50 transition-colors"
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${config.color}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* User avatar */}
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: stringToColor(activity.user?.name ?? '?') }}
              >
                {activity.user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>

              {/* User name */}
              <span className="font-medium text-gray-900 text-sm">
                {activity.user?.name ?? 'Unknown'}
              </span>

              {/* Action */}
              <span className="text-gray-600 text-sm">
                {actionText}
              </span>

              {/* Subject link */}
              {activity.subjectType !== 'member' && activity.subjectType !== 'version' ? (
                <Link
                  href={subjectUrl}
                  className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors"
                >
                  {referenceName}
                </Link>
              ) : (
                <span className="font-semibold text-gray-900 text-sm">
                  {referenceName}
                </span>
              )}

              {/* Type badge */}
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {activity.subjectType.replace('_', ' ')}
              </span>
            </div>

            {/* Time */}
            <div className={`text-xs text-gray-400 flex-shrink-0 transition-opacity ${showTime ? 'opacity-100' : 'opacity-0'}`}>
              {timeAgo}
            </div>
          </div>

          {/* Comments */}
          {hasComments && (
            <div className="mt-2 pl-8 space-y-2">
              {activity.comments.slice(0, expanded ? undefined : 2).map((comment) => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: stringToColor(comment.author?.name ?? '?') }}
                    >
                      {comment.author?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <span className="font-medium text-gray-700 text-xs">
                      {comment.author?.name ?? 'Unknown'}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-gray-600 pl-7">{comment.content}</p>
                </div>
              ))}

              {activity.comments.length > 2 && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Show {activity.comments.length - 2} more comment{activity.comments.length - 2 > 1 ? 's' : ''}
                </button>
              )}

              {expanded && activity.comments.length > 2 && (
                <button
                  onClick={() => setExpanded(false)}
                  className="text-sm text-gray-500 hover:text-gray-600"
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {/* Details (for grouped activities) */}
          {hasDetails && !expanded && (
            <div className="mt-2 pl-8">
              <button
                onClick={() => setExpanded(true)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {hasComments ? '+ more details' : 'View details'}
              </button>
            </div>
          )}

          {hasDetails && expanded && (
            <div className="mt-2 pl-8 text-sm text-gray-600">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Changes:</p>
                <ul className="space-y-1">
                  {(activity.details as unknown[]).map((detail, i) => (
                    <li key={i} className="text-sm">
                      {typeof detail === 'object' ? JSON.stringify(detail) : String(detail)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
