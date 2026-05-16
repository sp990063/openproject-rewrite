import React from 'react'

interface NewsComment {
  id: string
  newsId: string
  authorId: string
  content: string
  createdAt: Date | string
  updatedAt: Date | string
  author?: {
    id: string
    name: string
    email?: string
    avatarUrl?: string
    image?: string
  }
}

interface CommentItemProps {
  comment: NewsComment
}

export function CommentItem({ comment }: CommentItemProps) {
  const formattedDate = new Date(comment.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = new Date(comment.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const avatarUrl = comment.author?.avatarUrl ?? comment.author?.image
  const authorName = comment.author?.name ?? 'Unknown'

  return (
    <div className="flex gap-3 py-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={authorName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {authorName}
          </span>
          <span className="text-xs text-gray-400">
            {formattedDate} at {formattedTime}
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">
          {comment.content}
        </div>
      </div>
    </div>
  )
}

export type { NewsComment }
