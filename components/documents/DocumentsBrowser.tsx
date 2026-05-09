import React, { useState } from 'react'
import { FolderBreadcrumb } from './FolderBreadcrumb'
import { FolderCard, FolderCardSkeleton } from './FolderCard'
import { DocumentCard, DocumentCardSkeleton } from './DocumentCard'
import { UploadDialog } from './UploadDialog'
import { Button } from '@/components/ui/Button'
import { useDocumentFolders, useDocumentFolderBreadcrumb } from '@/hooks/useDocuments'
import { useCreateDocument, useCreateFolder } from '@/hooks/useDocumentMutations'

interface DocumentsBrowserProps {
  projectId: string
  currentFolderId?: string | null
  currentUserId: string
}

export function DocumentsBrowser({
  projectId,
  currentFolderId,
  currentUserId,
}: DocumentsBrowserProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const { data: contents, isLoading: isLoadingContents } = useDocumentFolders(
    projectId,
    currentFolderId
  )
  const { data: breadcrumb, isLoading: isLoadingBreadcrumb } = useDocumentFolderBreadcrumb(
    currentFolderId ?? undefined
  )

  const createDocument = useCreateDocument()
  const createFolder = useCreateFolder()

  const handleUpload = async (data: {
    title: string
    description: string
    folderId?: string | null
    file: File
  }) => {
    // In a real implementation, this would upload the file first
    // and then create the document with the file URL
    // For now, we create the document directly
    await createDocument.mutateAsync({
      projectId,
      title: data.title,
      description: data.description,
      folderId: data.folderId,
      authorId: currentUserId,
    })
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    await createFolder.mutateAsync({
      projectId,
      name: newFolderName.trim(),
      parentId: currentFolderId,
    })
    setNewFolderName('')
    setShowNewFolderDialog(false)
  }

  const isLoading = isLoadingContents || isLoadingBreadcrumb
  const folders = contents?.folders ?? []
  const documents = contents?.documents ?? []

  return (
    <div className="space-y-4">
      {/* Header with breadcrumb and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <FolderBreadcrumb
            folders={breadcrumb ?? []}
            projectId={projectId}
            currentFolderId={currentFolderId}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewFolderDialog(true)}
          >
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            New Folder
          </Button>
          <Button size="sm" onClick={() => setShowUploadDialog(true)}>
            <svg
              className="w-4 h-4 mr-1.5"
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
            Upload
          </Button>
        </div>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <form onSubmit={handleCreateFolder} className="flex items-center gap-3">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!newFolderName.trim()}>
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewFolderDialog(false)
                setNewFolderName('')
              }}
            >
              Cancel
            </Button>
          </form>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <FolderCardSkeleton key={`folder-${i}`} />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <DocumentCardSkeleton key={`doc-${i}`} />
          ))}
        </div>
      ) : folders.length === 0 && documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No documents yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Upload a file or create a folder to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Folders first */}
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} projectId={projectId} />
          ))}
          {/* Then documents */}
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} projectId={projectId} />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        projectId={projectId}
        currentFolderId={currentFolderId}
        folders={folders}
        onUpload={handleUpload}
        isUploading={createDocument.isPending}
      />
    </div>
  )
}
