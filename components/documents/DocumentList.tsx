import React from 'react'
import type { DocumentWithMeta } from '@/hooks/useDocuments'
import { DocumentCard } from './DocumentCard'

interface DocumentListProps {
  documents: DocumentWithMeta[]
  onDelete: (id: string) => void
  isLoading?: boolean
}

export function DocumentList({ documents, onDelete, isLoading }: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
          <p className="text-gray-500">
            Upload your first document to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
