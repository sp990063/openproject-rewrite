import React from 'react'
import Link from 'next/link'
import type { FolderWithMeta } from '@/hooks/useDocuments'

interface FolderCardProps {
  folder: FolderWithMeta
  projectId: string
}

export function FolderCard({ folder, projectId }: FolderCardProps) {
  const documentCount = folder._count?.documents ?? folder.documents?.length ?? 0
  const subfolderCount = folder._count?.children ?? folder.children?.length ?? 0

  return (
    <Link
      href={`/projects/${projectId}/documents?folderId=${folder.id}`}
      className="block group"
    >
      <div className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="text-yellow-500 group-hover:text-yellow-600 transition-colors mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                {folder.name}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {documentCount} document{documentCount === 1 ? '' : 's'}
                {subfolderCount > 0 && ` · ${subfolderCount} subfolder${subfolderCount === 1 ? '' : 's'}`}
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

export function FolderCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200">
      <div className="flex items-start gap-3">
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
