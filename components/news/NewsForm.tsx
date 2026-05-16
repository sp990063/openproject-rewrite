import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { NewsItem } from './NewsCard'

interface NewsFormProps {
  projectId: string
  news?: NewsItem
  onSuccess: () => void
}

export function NewsForm({ projectId, news, onSuccess }: NewsFormProps) {
  const [title, setTitle] = useState(news?.title ?? '')
  const [summary, setSummary] = useState(news?.summary ?? '')
  const [content, setContent] = useState(news?.content ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = Boolean(news?.slug)

  const mutation = useMutation({
    mutationFn: async (data: { title: string; summary?: string; content: string }) => {
      const url = isEditing && news
        ? `/api/projects/${projectId}/news/${news.slug}`
        : `/api/projects/${projectId}/news`

      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save news')
      }

      return res.json()
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!content.trim()) {
      setError('Content is required')
      return
    }

    mutation.mutate({
      title: title.trim(),
      summary: summary.trim() || undefined,
      content: content.trim(),
    })
  }

  const summaryCharCount = summary.length
  const maxSummaryChars = 500

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Title input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="News title..."
          className="w-full text-gray-900 placeholder-gray-300 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
          disabled={mutation.isPending}
        />
      </div>

      {/* Summary textarea */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
            Summary <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <span className={`text-xs ${summaryCharCount > maxSummaryChars ? 'text-red-500' : 'text-gray-400'}`}>
            {summaryCharCount}/{maxSummaryChars}
          </span>
        </div>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A brief summary of the news (max 500 characters)..."
          maxLength={maxSummaryChars + 50}
          rows={2}
          className="w-full text-gray-900 placeholder-gray-300 border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors resize-none"
          disabled={mutation.isPending}
        />
      </div>

      {/* Content textarea with preview toggle */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Content <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                !showPreview
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              disabled={mutation.isPending}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                showPreview
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              disabled={mutation.isPending}
            >
              Preview
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="min-h-[200px] p-4 border border-gray-200 rounded-lg bg-gray-50">
            {content ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{content}</pre>
            ) : (
              <p className="text-gray-400 italic">Nothing to preview</p>
            )}
          </div>
        ) : (
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your news content in Markdown...

# Heading 1
## Heading 2

**Bold** and *italic* text

- List item
- Another item

[Link text](url)"
            rows={8}
            className="w-full text-sm text-gray-700 placeholder-gray-300 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors resize-none font-mono"
            disabled={mutation.isPending}
          />
        )}
        <p className="mt-1 text-xs text-gray-400">Markdown supported</p>
      </div>

      {/* Submit button */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={mutation.isPending || !title.trim() || !content.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending
            ? isEditing
              ? 'Saving...'
              : 'Creating...'
            : isEditing
              ? 'Save Changes'
              : 'Create News'}
        </button>
      </div>
    </form>
  )
}
