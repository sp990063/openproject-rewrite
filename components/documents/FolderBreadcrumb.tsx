import React from 'react'
import Link from 'next/link'
import type { ProjectDocumentFolder } from '@/types'

interface FolderBreadcrumbProps {
  folders: ProjectDocumentFolder[]
  projectId: string
  currentFolderId?: string | null
}

export function FolderBreadcrumb({ folders, projectId, currentFolderId }: FolderBreadcrumbProps) {
  if (!folders || folders.length === 0) {
    return null
  }

  return (
    <nav aria-label="Folder breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href={`/projects/${projectId}/documents`}
        className="text-gray-500 hover:text-blue-600 transition-colors"
      >
        Documents
      </Link>

      {folders.map((folder, index) => {
        const isLast = folder.id === currentFolderId || index === folders.length - 1

        return (
          <React.Fragment key={folder.id}>
            <span className="text-gray-400 select-none">/</span>
            {isLast ? (
              <span className="text-gray-900 font-medium truncate max-w-[200px]">
                {folder.name}
              </span>
            ) : (
              <Link
                href={`/projects/${projectId}/documents?folderId=${folder.id}`}
                className="text-gray-500 hover:text-blue-600 transition-colors truncate max-w-[200px]"
              >
                {folder.name}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
