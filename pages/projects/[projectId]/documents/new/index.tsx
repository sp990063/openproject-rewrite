export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Input, Select } from '@/components/ui'
import { useCreateDocument } from '@/hooks/useDocumentMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { FolderWithMeta } from '@/hooks/useDocuments'

async function fetchFolders(projectId: string): Promise<FolderWithMeta[]> {
  const res = await fetch(`/api/projects/${projectId}/document-folders`)
  if (!res.ok) throw new Error('Failed to fetch folders')
  return res.json()
}

export default function NewDocumentPage() {
  const router = useRouter()
  const { projectId } = router.query

  const createDocument = useCreateDocument()
  const { user: currentUser } = useCurrentUser()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [folderId, setFolderId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Fetch folders for dropdown
  const { data: folders } = useQuery({
    queryKey: ['document-folders', projectId],
    queryFn: () => fetchFolders(projectId as string),
    enabled: !!projectId,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !currentUser?.id) return

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setError(null)

    try {
      const result = await createDocument.mutateAsync({
        projectId: projectId as string,
        title: title.trim(),
        description: description.trim() || undefined,
        folderId: folderId || null,
      })

      // Redirect to documents list
      router.push(`/projects/${projectId}/documents`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document')
    }
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  const folderOptions = [
    { value: '', label: 'No folder (root)' },
    ...(folders?.map((f) => ({
      value: f.id,
      label: f.name,
    })) ?? []),
  ]

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}/documents`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Documents
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the document..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Select
              label="Folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              options={folderOptions}
            />

            {/* File Upload Placeholder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File <span className="text-gray-400">(Phase 6)</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="text-4xl mb-4">📁</div>
                <p className="text-gray-500 mb-2">
                  File upload will be implemented in Phase 6
                </p>
                <p className="text-sm text-gray-400">
                  Drag and drop or click to select a file
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link href={`/projects/${projectId}/documents`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                type="submit"
                isLoading={createDocument.isPending}
              >
                Create Document
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
