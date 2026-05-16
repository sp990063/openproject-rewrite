export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useNewsItem } from '@/hooks/useNews'
import { useCreateNewsComment, useDeleteNews } from '@/hooks/useNewsMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'

export default function NewsDetailPage() {
  const router = useRouter()
  const { projectId, slug } = router.query

  const { data, isLoading, error } = useNewsItem(projectId as string | undefined, slug as string | undefined)
  const deleteNews = useDeleteNews()
  const createComment = useCreateNewsComment()
  const { user: currentUser } = useCurrentUser()

  const [renderedContent, setRenderedContent] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)

  const news = data?.news
  const isAuthor = currentUser?.id === news?.authorId
  const isAdmin = currentUser?.isSystemAdmin ?? false
  const canDelete = isAuthor || isAdmin

  useEffect(() => {
    if (news?.content) {
      renderMarkdown(news.content).then(setRenderedContent)
    }
  }, [news?.content])

  const handleDelete = async () => {
    if (!projectId || !slug || !confirm('Are you sure you want to delete this news?')) return

    try {
      await deleteNews.mutateAsync({ projectId: projectId as string, slug: slug as string })
      router.push(`/projects/${projectId}/news`)
    } catch (err) {
      console.error('Failed to delete news:', err)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !slug || !commentContent.trim()) return

    setCommentError(null)

    try {
      await createComment.mutateAsync({
        projectId: projectId as string,
        slug: slug as string,
        content: commentContent,
      })
      setCommentContent('')
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to add comment')
    }
  }

  if (!projectId || !slug) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (error || !news) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link href={`/projects/${projectId}/news`} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to News
            </Link>
          </div>
          <div className="text-center py-12 text-red-500">
            Failed to load news. Please try again.
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}/news`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to News
          </Link>
        </div>

        {/* News Article */}
        <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          {/* Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {isAuthor && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Author
                </span>
              )}
            </div>
            {canDelete && (
              <Button
                variant="secondary"
                onClick={handleDelete}
                isLoading={deleteNews.isPending}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                Delete
              </Button>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{news.title}</h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {news.author?.avatarUrl ? (
                <img
                  src={news.author.avatarUrl}
                  alt={news.author.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                  {news.author?.name?.charAt(0) ?? '?'}
                </div>
              )}
              <span className="font-medium text-gray-700">{news.author?.name ?? 'Unknown'}</span>
            </div>
            <span>•</span>
            <span>{formatDate(news.createdAt)}</span>
          </div>

          {/* Summary */}
          {news.summary && (
            <div className="bg-gray-50 border-l-4 border-blue-500 px-4 py-3 mb-6">
              <p className="text-gray-700">{news.summary}</p>
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-blue max-w-none"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </article>

        {/* Comments Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Comments ({news.comments?.length ?? 0})
          </h2>

          {/* Comment List */}
          {news.comments && news.comments.length > 0 && (
            <div className="space-y-6 mb-8">
              {news.comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <div className="flex-shrink-0">
                    {comment.author?.avatarUrl ? (
                      <img
                        src={comment.author.avatarUrl}
                        alt={comment.author.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                        {comment.author?.name?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{comment.author?.name ?? 'Unknown'}</span>
                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={handleCommentSubmit} className="space-y-4">
            {commentError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {commentError}
              </div>
            )}

            <div>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                type="submit"
                isLoading={createComment.isPending}
                disabled={!commentContent.trim()}
              >
                Add Comment
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AuthenticatedLayout>
  )
}
