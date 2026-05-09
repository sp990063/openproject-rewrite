import React from 'react'
import Link from 'next/link'
import type { DocumentWithMeta } from '@/hooks/useDocuments'

interface DocumentCardProps {
  document: DocumentWithMeta
  projectId: string
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function DocumentCard({ document, projectId }: DocumentCardProps) {
  return (
    <Link
      href={`/projects/${projectId}/documents/${document.id}`}
      className="block group"
    >
      <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {document.title}
              </div>
              {document.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {document.description}
                </p>
              )}
              <div className="text-xs text-gray-400 mt-1.5">
                {document.author?.name ?? 'Unknown'}
                {document.folder && ` · in ${document.folder.name}`}
                {' · '}
                {formatDate(document.createdAt)}
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
  )
}

export function DocumentCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
