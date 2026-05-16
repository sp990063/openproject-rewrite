export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Input } from '@/components/ui'
import { useCreateNews } from '@/hooks/useNewsMutations'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function NewNewsPage() {
  const router = useRouter()
  const { projectId } = router.query

  const createNews = useCreateNews()
  const { user: currentUser } = useCurrentUser()

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !currentUser?.id) return

    setError(null)

    try {
      const result = await createNews.mutateAsync({
        projectId: projectId as string,
        title,
        summary: summary || undefined,
        content,
      })
      // Redirect to the new news item
      router.push(`/projects/${projectId}/news/${result.news.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create news')
    }
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}/news`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to News
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create News</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="News title"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary <span className="text-gray-400">(optional, max 500 characters)</span>
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value.slice(0, 500))}
                placeholder="Brief summary of the news..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-400 mt-1 text-right">{summary.length}/500</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content <span className="text-gray-400">(Markdown supported)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Full news content in Markdown..."
                rows={12}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <div className="text-xs text-gray-400 mt-2">
                Supports Markdown: **bold**, *italic*, # headings, - lists, `code`, etc.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/projects/${projectId}/news`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                type="submit"
                isLoading={createNews.isPending}
              >
                Publish
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
