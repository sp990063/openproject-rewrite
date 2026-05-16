export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { useWikiPages } from '@/hooks/useWikiPages'
import { useCreateWikiPage } from '@/hooks/useWikiMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'

export default function WikiPagesIndexPage() {
  const router = useRouter()
  const { projectId } = router.query

  const { data: wikiPages = [], isLoading, error } = useWikiPages(projectId as string | undefined)
  const createWikiPage = useCreateWikiPage()
  const { data: currentUser } = useCurrentUser()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !currentUser?.id) return

    try {
      await createWikiPage.mutateAsync({
        projectId: projectId as string,
        title: newTitle,
        content: newContent,
        authorId: currentUser.id,
      })
      setIsCreateModalOpen(false)
      setNewTitle('')
      setNewContent('')
    } catch (err) {
      console.error('Failed to create wiki page:', err)
    }
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wiki</h1>
              <p className="text-gray-500 text-sm mt-1">
                Document your project with wiki pages
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              New Page
            </Button>
          </div>
        </div>

        {/* Wiki Pages List */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading wiki pages...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load wiki pages. Please try again.
          </div>
        )}

        {!isLoading && !error && wikiPages?.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No wiki pages yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first wiki page to start documenting your project.
              </p>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                Create First Page
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && wikiPages && wikiPages.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Children
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wikiPages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/projects/${projectId}/wiki/${page.slug}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {page.title}
                      </Link>
                      {page.parent && (
                        <span className="ml-2 text-xs text-gray-400">
                          ↳ in: {page.parent.title}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {page.author?.name ?? 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {page._count?.children ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(page.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Wiki Page Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Wiki Page"
        description="Create a new wiki page for this project."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Page title"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content (optional)
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Initial page content..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={createWikiPage.isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}