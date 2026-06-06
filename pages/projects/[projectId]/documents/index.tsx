export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal } from '@/components/ui'
import { FolderTree, DocumentList } from '@/components/documents'
import { useDeleteDocument } from '@/hooks/useDocumentMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { DocumentWithMeta, FolderWithMeta } from '@/hooks/useDocuments'
import { queryKeys } from '@/queries/queryKeys'

async function fetchFolders(projectId: string): Promise<FolderWithMeta[]> {
  const res = await fetch(`/api/projects/${projectId}/document-folders`)
  if (!res.ok) throw new Error('Failed to fetch folders')
  return res.json()
}

async function fetchDocuments(projectId: string, folderId: string | null): Promise<DocumentWithMeta[]> {
  const params = new URLSearchParams({ projectId })
  if (folderId) {
    params.set('folderId', folderId)
  } else {
    params.set('folderId', 'null')
  }
  const res = await fetch(`/api/projects/${projectId}/documents?${params}`)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export default function DocumentsIndexPage() {
  const router = useRouter()
  const { projectId } = router.query
  const { user: currentUser } = useCurrentUser()

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)

  // Fetch folders
  const {
    data: folders,
    isLoading: isLoadingFolders,
    error: foldersError,
  } = useQuery({
    queryKey: queryKeys.documentFolders(projectId as string, null),
    queryFn: () => fetchFolders(projectId as string),
    enabled: !!projectId,
  })

  // Fetch documents for selected folder (or root if no folder selected)
  const {
    data: documents,
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useQuery({
    queryKey: ['documents', projectId, selectedFolderId],
    queryFn: () => fetchDocuments(projectId as string, selectedFolderId),
    enabled: !!projectId,
  })

  const deleteDocument = useDeleteDocument()

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await deleteDocument.mutateAsync({ projectId: projectId as string, id })
      // Refetch documents
      router.replace(router.asPath)
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId)
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
      <div className="flex gap-6 h-full">
        {/* Left Sidebar - Folder Tree */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Folders</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateFolderOpen(true)}
                title="Create Folder"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </Button>
            </div>

            {isLoadingFolders && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            )}

            {foldersError && (
              <div className="text-sm text-red-500">Failed to load folders</div>
            )}

            {folders && (
              <FolderTree
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={handleSelectFolder}
                projectId={projectId as string}
              />
            )}
          </div>
        </div>

        {/* Right Content - Document List */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Back to Project
                  </Link>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">Documents</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {selectedFolderId
                    ? `Viewing documents in selected folder`
                    : 'All project documents'}
                </p>
              </div>
              <Link href={`/projects/${projectId}/documents/new`}>
                <Button variant="primary">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Upload Document
                </Button>
              </Link>
            </div>
          </div>

          {/* Document List */}
          {isLoadingDocuments && (
            <DocumentList documents={[]} onDelete={handleDeleteDocument} isLoading />
          )}

          {documentsError && (
            <div className="text-center py-12">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="text-red-500 mb-4">Failed to load documents</div>
                <Button variant="secondary" onClick={() => router.reload()}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!isLoadingDocuments && !documentsError && documents && (
            <DocumentList
              documents={documents}
              onDelete={handleDeleteDocument}
            />
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
