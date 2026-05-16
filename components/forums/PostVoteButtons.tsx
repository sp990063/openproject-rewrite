import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

interface PostVoteButtonsProps {
  postId: string
  threadId: string
  voteScore: number
  hasVoted?: boolean
  isThreadLocked?: boolean
}

async function toggleVote(postId: string): Promise<{ hasVoted: boolean; voteScore: number }> {
  const res = await fetch(`/api/forums/posts/${postId}/vote`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to vote')
  return res.json()
}

export function PostVoteButtons({
  postId,
  threadId,
  voteScore,
  hasVoted = false,
  isThreadLocked = false,
}: PostVoteButtonsProps) {
  const queryClient = useQueryClient()

  const voteMutation = useMutation({
    mutationFn: () => toggleVote(postId),
    onSuccess: (data) => {
      // Optimistically update the query cache
      queryClient.setQueryData(queryKeys.forumPosts(threadId), (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const oldData = old as { posts?: Array<{ id: string; voteScore: number }> }
        if (!oldData.posts) return oldData

        return {
          ...oldData,
          posts: oldData.posts.map((post) =>
            post.id === postId
              ? { ...post, voteScore: data.voteScore }
              : post
          ),
        }
      })
      // Also invalidate to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumPosts(threadId) })
    },
  })

  const handleVote = () => {
    if (isThreadLocked) return
    voteMutation.mutate()
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleVote}
        disabled={isThreadLocked || voteMutation.isPending}
        className={`p-1 rounded transition-colors ${
          isThreadLocked
            ? 'text-gray-300 cursor-not-allowed'
            : hasVoted
            ? 'text-orange-500 hover:text-orange-600'
            : 'text-gray-400 hover:text-orange-500'
        }`}
        title={isThreadLocked ? 'Cannot vote on locked thread' : hasVoted ? 'Remove vote' : 'Upvote'}
      >
        <svg
          className="w-5 h-5"
          fill={hasVoted ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>
      <span className={`text-sm font-medium min-w-[20px] text-center ${
        voteScore > 0 ? 'text-orange-600' : voteScore < 0 ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {voteScore}
      </span>
    </div>
  )
}
