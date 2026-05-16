import React, { useState } from 'react'
import type { FolderWithMeta } from '@/hooks/useDocuments'
import { useCreateFolder } from '@/hooks/useDocumentMutations'
import { Button, Input } from '@/components/ui'

interface FolderTreeProps {
  folders: FolderWithMeta[]
  selectedFolderId?: string | null
  onSelect: (folderId: string | null) => void
  projectId: string
}

export function FolderTree({ folders, selectedFolderId, onSelect, projectId }: FolderTreeProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const createFolder = useCreateFolder()

  // Build a tree structure from flat folders
  const rootFolders = folders.filter((f) => !f.parentId)
  const getChildren = (parentId: string) => folders.filter((f) => f.parentId === parentId)

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    try {
      await createFolder.mutateAsync({
        projectId,
        name: newFolderName.trim(),
        parentId: selectedFolderId ?? null,
      })
      setNewFolderName('')
      setIsCreating(false)
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }

  const renderFolder = (folder: FolderWithMeta, depth: number = 0) => {
    const children = getChildren(folder.id)
    const isSelected = selectedFolderId === folder.id
    const hasChildren = children.length > 0

    return (
      <div key={folder.id}>
        <div
          onClick={() => onSelect(folder.id)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
            ${isSelected
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
            }
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {/* Folder icon */}
          <svg
            className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
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
          <span className="truncate flex-1">{folder.name}</span>
          {folder._count?.documents !== undefined && (
            <span className="text-xs text-gray-400">{folder._count.documents}</span>
          )}
        </div>
        {hasChildren && (
          <div>
            {children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* All Documents option */}
      <div
        onClick={() => onSelect(null)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm
          ${selectedFolderId === null
            ? 'bg-blue-100 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100'
          }
        `}
      >
        <svg
          className={`w-4 h-4 flex-shrink-0 ${selectedFolderId === null ? 'text-blue-500' : 'text-gray-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span>All Documents</span>
      </div>

      {/* Folder list */}
      <div className="mt-2 space-y-0.5">
        {rootFolders.map((folder) => renderFolder(folder))}
      </div>

      {/* Create folder */}
      {isCreating ? (
        <form onSubmit={handleCreateFolder} className="px-3 py-2">
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1"
              autoFocus
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={createFolder.isPending}
            >
              Create
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                setIsCreating(false)
                setNewFolderName('')
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all w-full"
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
          New Folder
        </button>
      )}
    </div>
  )
}
