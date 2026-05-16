export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { useForums } from '@/hooks/useForums'
import { useCreateForum } from '@/hooks/useForumMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'

export default function ForumsIndexPage() {
  const router = useRouter()
  const { projectId } = router.query

  const { data: forums, isLoading, error } = useForums(projectId as string | undefined)
  const createForum = useCreateForum()
  const { user: currentUser } = useCurrentUser()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !currentUser?.id) return

    try {
      await createForum.mutateAsync({
        projectId: projectId as string,
        name: newName,
        description: newDescription || undefined,
        authorId: currentUser.id,
      })
      setIsCreateModalOpen(false)
      setNewName('')
      setNewDescription('')
    } catch (err) {
      console.error('Failed to create forum:', err)
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
              <h1 className="text-2xl font-bold text-gray-900">Forums</h1>
              <p className="text-gray-500 text-sm mt-1">
                Discuss topics with your project team
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              New Forum
            </Button>
          </div>
        </div>

        {/* Forums List */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading forums...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load forums. Please try again.
          </div>
        )}

        {!isLoading && !error && forums?.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No forums yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first forum to start discussing topics with your team.
              </p>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                Create First Forum
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && forums && forums.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Forum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Threads
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forums.map((forum) => (
                  <tr key={forum.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${projectId}/forums/${forum.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {forum.name}
                      </Link>
                      {forum.description && (
                        <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                          {forum.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {forum.author?.name ?? 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {forum._count?.threads ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(forum.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Forum Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Forum"
        description="Create a new forum for this project."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Forum name"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What will this forum be about?"
              rows={3}
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
              isLoading={createForum.isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}
