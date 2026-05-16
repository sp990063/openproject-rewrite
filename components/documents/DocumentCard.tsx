import React from 'react'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { DocumentWithMeta } from '@/hooks/useDocuments'

interface DocumentCardProps {
  document: DocumentWithMeta
  onDelete: (id: string) => void
}

// File type to icon mapping
function getFileIcon(fileType: string) {
  if (!fileType) {
    return (
      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  const type = fileType.toLowerCase()

  // PDF
  if (type.includes('pdf')) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  // Word/DOC
  if (type.includes('word') || type.includes('doc')) {
    return (
      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  // Excel
  if (type.includes('excel') || type.includes('spreadsheet') || type.includes('xlsx')) {
    return (
      <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  // Image
  if (type.includes('image') || type.includes('png') || type.includes('jpeg') || type.includes('gif')) {
    return (
      <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }

  // Default document
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const createdDate = formatDate(document.createdAt)
  // Handle both full Document type and DocumentWithMeta (which may not have these)
  const fileUrl = (document as { fileUrl?: string }).fileUrl || '#'
  const fileType = (document as { fileType?: string }).fileType || ''
  const version = (document as { version?: number }).version || 1

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="flex-shrink-0 mt-1">
          {getFileIcon(fileType)}
        </div>

        {/* Document info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {document.title}
              </h3>
              {document.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {document.description}
                </p>
              )}
            </div>

            {/* Version badge */}
            <Badge variant="default">
              v{version}
            </Badge>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className={document.author ? 'text-gray-600' : ''}>
              {document.author?.name ?? 'Unknown'}
            </span>
            <span>•</span>
            <span>{createdDate}</span>
            {document.folder && (
              <>
                <span>•</span>
                <span>{document.folder.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Download */}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>

          {/* Delete */}
          <button
            onClick={() => onDelete(document.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
