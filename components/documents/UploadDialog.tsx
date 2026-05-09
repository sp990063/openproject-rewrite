import React, { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { DocumentWithMeta, FolderWithMeta } from '@/hooks/useDocuments'

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  currentFolderId?: string | null
  folders: FolderWithMeta[]
  onUpload: (data: {
    title: string
    description: string
    folderId?: string | null
    file: File
  }) => Promise<void>
  isUploading?: boolean
}

export function UploadDialog({
  open,
  onOpenChange,
  projectId,
  currentFolderId,
  folders,
  onUpload,
  isUploading = false,
}: UploadDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [folderId, setFolderId] = useState<string>(currentFolderId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    try {
      await onUpload({
        title: title.trim(),
        description: description.trim(),
        folderId: folderId || null,
        file,
      })
      // Reset form on success
      setTitle('')
      setDescription('')
      setFolderId(currentFolderId ?? '')
      setFile(null)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setTitle('')
      setDescription('')
      setFolderId(currentFolderId ?? '')
      setFile(null)
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Upload Document"
      description="Upload a new document to this project"
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
            disabled={isUploading}
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            disabled={isUploading}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isUploading}
          />
        </div>

        {/* Folder */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folder
          </label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isUploading}
          >
            <option value="">No folder (root)</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isUploading || !file || !title.trim()}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
