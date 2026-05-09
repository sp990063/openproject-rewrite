import React from 'react'
import Link from 'next/link'
import type { WikiPageWithMeta } from '@/types/wiki'

interface WikiPageListProps {
  pages: WikiPageWithMeta[]
  projectId: string
  isLoading?: boolean
}

export function WikiPageList({ pages, projectId, isLoading }: WikiPageListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <WikiPageSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No wiki pages yet</p>
        <p className="text-gray-400 text-xs mt-1">Create your first wiki page to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {pages.map((page) => (
        <WikiPageItem key={page.id} page={page} projectId={projectId} />
      ))}
    </div>
  )
}

function WikiPageItem({ page, projectId }: { page: WikiPageWithMeta; projectId: string }) {
  const childCount = page.children?.length ?? 0

  return (
    <Link
      href={`/projects/${projectId}/wiki/${page.slug}`}
      className="block group"
    >
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {page.title}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {page.author?.name ?? 'Unknown'} · v{page.version}
              {childCount > 0 && ` · ${childCount} child${childCount === 1 ? '' : 'ren'}`}
            </div>
          </div>
        </div>
        <div className="text-gray-300 group-hover:text-gray-500 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

function WikiPageSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}
