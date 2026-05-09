import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal } from '@/components/ui'
import { useWikiPage } from '@/hooks/useWikiPage'
import { useUpdateWikiPage, useDeleteWikiPage } from '@/hooks/useWikiMutations'
import { useCurrentUser } from '@/hooks/use-current-user'

export const dynamic = 'force-dynamic'

export default function WikiPageViewPage() {
  const router = useRouter()
  const { projectId, slug } = router.query

  const { wikiPage, isLoading, error } = useWikiPage(projectId as string | undefined, slug as string | undefined)
  const updateWikiPage = useUpdateWikiPage()
  const deleteWikiPage = useDeleteWikiPage()
  const { data: currentUser } = useCurrentUser()

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const handleStartEdit = () => {
    if (wikiPage) {
      setEditTitle(wikiPage.title)
      setEditContent(wikiPage.content)
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditContent('')
  }

  const handleSaveEdit = async () => {
    if (!wikiPage) return

    try {
      await updateWikiPage.mutateAsync({
        id: wikiPage.id,
        data: {
          title: editTitle !== wikiPage.title ? editTitle : undefined,
          content: editContent,
        },
      })
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update wiki page:', err)
    }
  }

  const handleDelete = async () => {
    if (!wikiPage) return

    try {
      await deleteWikiPage.mutateAsync(wikiPage.id)
      router.push(`/projects/${projectId}/wiki`)
    } catch (err) {
      console.error('Failed to delete wiki page:', err)
    }
  }

  if (!projectId || !slug) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading wiki page...</div>
      </AuthenticatedLayout>
    )
  }

  if (error || !wikiPage) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load wiki page</p>
          <Link href={`/projects/${projectId}/wiki`} className="text-blue-600 hover:text-blue-500">
            Back to Wiki
          </Link>
        </div>
      </AuthenticatedLayout>
    )
  }

  const isOwnerOrAdmin = currentUser?.id === wikiPage.authorId || currentUser?.isSystemAdmin

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}/wiki`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Wiki
          </Link>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold text-gray-900 w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Page title"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{wikiPage.title}</h1>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>By {wikiPage.author?.name ?? 'Unknown'}</span>
                <span>•</span>
                <span>Version {wikiPage.version}</span>
                <span>•</span>
                <span>Updated {new Date(wikiPage.updatedAt).toLocaleDateString()}</span>
              </div>
              {wikiPage.parent && (
                <div className="mt-1 text-sm text-gray-500">
                  Child of:{' '}
                  <Link
                    href={`/projects/${projectId}/wiki/${wikiPage.parent.slug}`}
                    className="text-blue-600 hover:text-blue-500"
                  >
                    {wikiPage.parent.title}
                  </Link>
                </div>
              )}
            </div>

            {isOwnerOrAdmin && !isEditing && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleStartEdit}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Children Section */}
        {wikiPage.children && wikiPage.children.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Child Pages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wikiPage.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/projects/${projectId}/wiki/${child.slug}`}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <span className="text-blue-600 hover:text-blue-800 font-medium">
                    {child.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Page content (Markdown supported)"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveEdit}
                  isLoading={updateWikiPage.isPending}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose max-w-none">
              {wikiPage.content ? (
                <div className="whitespace-pre-wrap text-gray-700">{wikiPage.content}</div>
              ) : (
                <div className="text-gray-400 italic">No content yet.</div>
              )}
            </div>
          )}
        </div>

        {/* Project Info */}
        {wikiPage.project && (
          <div className="mt-6 text-sm text-gray-500">
            Part of: {wikiPage.project.name} ({wikiPage.project.identifier})
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Delete Wiki Page"
        description="Are you sure you want to delete this wiki page? This action cannot be undone."
      >
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteWikiPage.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </AuthenticatedLayout>
  )
}