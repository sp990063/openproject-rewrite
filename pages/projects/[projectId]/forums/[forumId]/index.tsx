export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input, Textarea } from '@/components/ui'
import { useForum } from '@/hooks/useForum'
import { useCreateThread } from '@/hooks/useForumMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'

export default function ForumDetailPage() {
  const router = useRouter()
  const { projectId, forumId } = router.query

  const { data: forum, isLoading, error } = useForum(
    projectId as string | undefined,
    forumId as string | undefined,
  )
  const createThread = useCreateThread()
  const { user: currentUser } = useCurrentUser()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newContent, setNewContent] = useState('')

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !forumId || !currentUser?.id) return

    try {
      const result = await createThread.mutateAsync({
        projectId: projectId as string,
        forumId: forumId as string,
        subject: newSubject,
        content: newContent,
        authorId: currentUser.id,
      })
      setIsCreateModalOpen(false)
      setNewSubject('')
      setNewContent('')
      // result.thread contains the created thread
      const thread = result.thread ?? result
      router.push(`/projects/${projectId}/forums/${forumId}/threads/${thread.id}`)
    } catch (err) {
      console.error('Failed to create thread:', err)
    }
  }

  if (!projectId || !forumId) {
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
          <Link href={`/projects/${projectId}/forums`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Forums
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading forum...</div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">Failed to load forum</p>
            <Link href={`/projects/${projectId}/forums`} className="text-blue-600 hover:text-blue-500">
              Back to Forums
            </Link>
          </div>
        )}

        {forum && (
          <>
            {/* Forum Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{forum.name}</h1>
                  {forum.description && (
                    <p className="text-gray-500 text-sm mt-1">{forum.description}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-2">
                    Created by {forum.author?.name ?? 'Unknown'} on {formatDate(forum.createdAt)}
                  </p>
                </div>
                <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                  New Thread
                </Button>
              </div>
            </div>

            {/* Threads List */}
            {!forum.threads || forum.threads.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                  <div className="text-4xl mb-4">🧵</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No threads yet</h3>
                  <p className="text-gray-500 mb-4">
                    Start a new thread to begin discussing with your team.
                  </p>
                  <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                    Start First Thread
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thread
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Author
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Posts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {forum.threads.map((thread) => (
                      <tr key={thread.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {thread.isSticky && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Sticky
                              </span>
                            )}
                            {thread.isLocked && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                Locked
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/projects/${projectId}/forums/${forumId}/threads/${thread.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {thread.subject}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {thread.author?.name ?? 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {thread._count?.posts ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(thread.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Thread Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Start New Thread"
        description="Create a new discussion thread in this forum."
      >
        <form onSubmit={handleCreateThread} className="space-y-4">
          <Input
            label="Subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Thread subject"
            required
          />
          <Textarea
            label="First Post"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your first post..."
            rows={6}
            required
          />
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
              isLoading={createThread.isPending}
            >
              Create Thread
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}
