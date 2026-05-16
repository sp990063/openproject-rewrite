export const dynamic = 'force-dynamic'

import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useNewsList } from '@/hooks/useNews'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'

export default function NewsIndexPage() {
  const router = useRouter()
  const { projectId } = router.query

  const { data, isLoading, error } = useNewsList(projectId as string | undefined, 1)
  const { user: currentUser } = useCurrentUser()

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">News</h1>
              <p className="text-gray-500 text-sm mt-1">
                Stay updated with the latest project news
              </p>
            </div>
            <Link href={`/projects/${projectId}/news/new`}>
              <Button variant="primary">New News</Button>
            </Link>
          </div>
        </div>

        {/* News List */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading news...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load news. Please try again.
          </div>
        )}

        {!isLoading && !error && data?.news.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-4xl mb-4">📰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No news yet</h3>
              <p className="text-gray-500 mb-4">
                Be the first to share news with your project team.
              </p>
              <Link href={`/projects/${projectId}/news/new`}>
                <Button variant="primary">Create First News</Button>
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !error && data?.news && data.news.length > 0 && (
          <div className="space-y-4">
            {data.news.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${projectId}/news/${item.slug}`}
                className="block"
              >
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                        {item.title}
                      </h2>
                      {item.summary && (
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span>{item.author?.name ?? 'Unknown'}</span>
                        <span>•</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination info */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
