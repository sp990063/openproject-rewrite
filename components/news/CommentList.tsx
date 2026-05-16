import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { NewsComment } from './CommentItem'
import { CommentItem } from './CommentItem'

interface CommentListProps {
  newsSlug: string
  projectId: string
  comments: NewsComment[]
}

export function CommentList({ newsSlug, projectId, comments }: CommentListProps) {
  const [newComment, setNewComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/news/${newsSlug}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add comment')
      }

      return res.json()
    },
    onSuccess: () => {
      setNewComment('')
      setError(null)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = newComment.trim()
    if (!trimmed) {
      setError('Comment cannot be empty')
      return
    }

    mutation.mutate(trimmed)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 italic">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-100">
        {error && (
          <div className="mb-3 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full text-sm text-gray-700 placeholder-gray-300 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors resize-none"
              disabled={mutation.isPending}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending || !newComment.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  )
}
