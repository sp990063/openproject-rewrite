export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Textarea } from '@/components/ui'
import { ForumMessageCard } from '@/components/forums/ForumMessageCard'
import { useCurrentUser } from '@/hooks/use-current-user'
import { queryKeys } from '@/queries/queryKeys'
import { formatDate } from '@/lib/utils'
import type { ForumThread, ForumPost } from '@/types/forum'

interface ThreadApiResponse extends ForumThread {
  author: { id: string; name: string; avatarUrl?: string | null }
  forum: { id: string; name: string; projectId: string }
  posts: (ForumPost & { author: { id: string; name: string; avatarUrl?: string | null } })[]
}

interface PostsApiResponse {
  posts: (ForumPost & { author: { id: string; name: string; avatarUrl?: string | null } })[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchThread(
  projectId: string,
  forumId: string,
  threadId: string
): Promise<ThreadApiResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/forums/${forumId}/threads/${threadId}`
  )
  if (!res.ok) throw new Error('Failed to fetch thread')
  return res.json()
}

async function fetchPosts(
  projectId: string,
  forumId: string,
  threadId: string,
  page = 1
): Promise<PostsApiResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/posts?page=${page}&pageSize=50`
  )
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}

async function createPost(
  projectId: string,
  forumId: string,
  threadId: string,
  content: string
): Promise<{ post: ForumPost }> {
  const res = await fetch(
    `/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/posts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  )
  if (!res.ok) throw new Error('Failed to create post')
  return res.json()
}

export default function ThreadDetailPage() {
  const router = useRouter()
  const { projectId, forumId, threadId } = router.query

  const { user: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()

  const [replyContent, setReplyContent] = useState('')
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const enabled = !!(projectId && forumId && threadId)

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ['forum-thread-detail', projectId, forumId, threadId],
    queryFn: () => fetchThread(projectId as string, forumId as string, threadId as string),
    enabled,
    refetchInterval: 30000, // Refresh every 30s for new posts
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['forum-posts-detail', projectId, forumId, threadId],
    queryFn: () => fetchPosts(projectId as string, forumId as string, threadId as string),
    enabled,
    refetchInterval: 30000,
  })

  const createPostMutation = useMutation({
    mutationFn: (content: string) =>
      createPost(projectId as string, forumId as string, threadId as string, content),
    onSuccess: async () => {
      setReplyContent('')
      setIsReplyModalOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['forum-thread-detail', projectId, forumId, threadId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['forum-posts-detail', projectId, forumId, threadId],
      })
    },
  })

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    setIsSubmitting(true)
    try {
      await createPostMutation.mutateAsync(replyContent)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!projectId || !forumId || !threadId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href={`/projects/${projectId}/forums/${forumId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to {thread?.forum?.name ?? 'Forum'}
          </Link>
        </div>

        {threadLoading && (
          <div className="text-center py-12 text-gray-500">Loading thread...</div>
        )}

        {!threadLoading && !thread && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Thread not found</p>
            <Link
              href={`/projects/${projectId}/forums/${forumId}`}
              className="text-blue-600 hover:text-blue-500"
            >
              Back to Forum
            </Link>
          </div>
        )}

        {thread && (
          <>
            {/* Thread header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {thread.isSticky && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Sticky
                      </span>
                    )}
                    {thread.isLocked && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        Locked
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-semibold text-gray-900">{thread.subject}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Started by {thread.author?.name ?? 'Unknown'} on{' '}
                    {formatDate(thread.createdAt)}
                  </p>
                </div>
              </div>

              {/* Thread actions */}
              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsReplyModalOpen(true)}
                  disabled={thread.isLocked}
                >
                  {thread.isLocked ? 'Thread Locked' : 'Reply'}
                </Button>
                <span className="text-sm text-gray-400">
                  {postsData?.pagination.total ?? thread._count?.posts ?? 0} posts
                </span>
              </div>
            </div>

            {/* Posts list */}
            {postsLoading && (
              <div className="text-center py-12 text-gray-500">Loading posts...</div>
            )}

            {!postsLoading && postsData && (
              <div className="space-y-6">
                {/* Original post as first "reply" */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <ForumMessageCard
                    post={{
                      id: thread.id,
                      threadId: thread.forumId,
                      content: thread.posts?.[0]?.content ?? '',
                      authorId: thread.authorId,
                      voteScore: 0,
                      createdAt: thread.createdAt,
                      updatedAt: thread.updatedAt,
                      author: thread.author,
                    }}
                    isOriginalPost
                  />
                </div>

                {/* Subsequent posts */}
                {postsData.posts.slice(1).map((post, index) => (
                  <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <ForumMessageCard post={post} />
                  </div>
                ))}

                {/* Empty state */}
                {!postsLoading && postsData.posts.length <= 1 && (
                  <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-500">No replies yet. Be the first to reply!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply modal */}
      <Modal
        open={isReplyModalOpen}
        onOpenChange={setIsReplyModalOpen}
        title="Reply to Thread"
        description="Post a reply to this discussion thread."
      >
        <form onSubmit={handleSubmitReply} className="space-y-4">
          <Textarea
            label="Your Reply"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            rows={6}
            required
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsReplyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              disabled={!replyContent.trim()}
            >
              Post Reply
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}
