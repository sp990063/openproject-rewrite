import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui'

interface NewsItem {
  id: string
  projectId: string
  authorId: string
  title: string
  slug: string
  summary: string | null
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

interface NewsCardProps {
  news: NewsItem
  onClick?: () => void
}

export function NewsCard({ news, onClick }: NewsCardProps) {
  const formattedDate = new Date(news.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const truncatedSummary = news.summary
    ? news.summary.length > 120
      ? news.summary.slice(0, 120) + '...'
      : news.summary
    : null

  return (
    <div
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      <Link
        href={`/projects/${news.projectId}/news/${news.slug}`}
        className="block group"
        onClick={(e) => {
          if (onClick) {
            e.preventDefault()
          }
        }}
      >
        <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* News icon */}
              <div className="text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5 flex-shrink-0">
                <span className="text-lg" role="img" aria-label="news">📢</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {news.title}
                </div>
                {truncatedSummary && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {truncatedSummary}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span className={news.author ? 'text-gray-600' : 'text-gray-400'}>
                    {news.author?.name ?? 'Unknown'}
                  </span>
                  <span>·</span>
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>
            <div className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export type { NewsItem }
