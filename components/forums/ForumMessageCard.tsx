import React from 'react'
import type { ForumPost } from '@/types/forum'
import { formatRelativeTime } from './ForumThreadList'

interface ForumMessageCardProps {
  post: ForumPost
  isOriginalPost?: boolean
}

export function ForumMessageCard({ post, isOriginalPost = false }: ForumMessageCardProps) {
  return (
    <div className={`flex gap-4 ${isOriginalPost ? 'pb-6 border-b border-gray-200' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          {post.author?.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt={post.author.name ?? 'User'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-gray-500">
              {getInitials(post.author?.name ?? 'Unknown')}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-sm font-medium text-gray-900">
            {post.author?.name ?? 'Unknown'}
          </span>
          {post.author?.email && (
            <span className="text-xs text-gray-400">{post.author.email}</span>
          )}
          <span className="text-xs text-gray-400">
            · {formatRelativeTime(post.createdAt)}
          </span>
          {isOriginalPost && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Original Post
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="text-sm text-gray-700 prose prose-sm max-w-none">
          {post.content.split('\n').map((paragraph, i) => (
            <p key={i} className={paragraph ? 'mb-2' : 'mb-0'}>
              {paragraph || '\u00A0'}
            </p>
          ))}
        </div>

        {/* Actions */}
        {!isOriginalPost && (
          <div className="flex items-center gap-4 mt-3">
            <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Quote
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Reply
            </button>
            {post.updatedAt && post.updatedAt !== post.createdAt && (
              <span className="text-xs text-gray-400 italic">
                (edited)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}