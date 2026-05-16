export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { useRepositories } from '@/hooks/useRepositories'
import { useCurrentUser } from '@/hooks/use-current-user'

export default function RepositoryIndexPage() {
  const router = useRouter()
  const { projectId } = router.query

  const { data: repositories, isLoading, error } = useRepositories(projectId as string | undefined)
  const { user: currentUser } = useCurrentUser()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocalPath, setNewLocalPath] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return

    try {
      const res = await fetch(`/api/projects/${projectId}/repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          localPath: newLocalPath || null,
          url: newUrl || null,
        }),
      })

      if (res.ok) {
        setIsCreateModalOpen(false)
        setNewName('')
        setNewLocalPath('')
        setNewUrl('')
        // Refetch repositories
        router.reload()
      }
    } catch (err) {
      console.error('Failed to create repository:', err)
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
              <h1 className="text-2xl font-bold text-gray-900">Repositories</h1>
              <p className="text-gray-500 text-sm mt-1">
                Browse Git repositories and commits for this project
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Add Repository
            </Button>
          </div>
        </div>

        {/* Repository List */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading repositories...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load repositories. Please try again.
          </div>
        )}

        {!isLoading && !error && repositories?.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No repositories yet</h3>
              <p className="text-gray-500 mb-4">
                Add a Git repository to start browsing commits and code changes.
              </p>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                Add First Repository
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && repositories && repositories.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Local Path
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repositories.map((repo) => (
                  <tr key={repo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${projectId}/repository/${repo.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {repo.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {repo.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {repo.localPath || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {repo.url || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(repo.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Repository Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Add Repository"
        description="Add a Git repository to this project."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-repo"
            required
          />
          <Input
            label="Local Path"
            value={newLocalPath}
            onChange={(e) => setNewLocalPath(e.target.value)}
            placeholder="/path/to/local/repo"
            required
          />
          <Input
            label="Remote URL (optional)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Repository
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}