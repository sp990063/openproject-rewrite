export const dynamic = 'force-dynamic'

import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useRepositories, useRepositoryCommits } from '@/hooks/useRepositories'
import { formatDate } from '@/lib/utils'

export default function RepositoryDetailPage() {
  const router = useRouter()
  const { projectId, repoId } = router.query

  const { data: repositories } = useRepositories(projectId as string | undefined)
  const repository = repositories?.find(r => r.id === repoId)

  const { data: commits, isLoading, error } = useRepositoryCommits(
    projectId as string | undefined,
    repoId as string | undefined,
    100
  )

  if (!projectId || !repoId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}/repository`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Repositories
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {repository?.name ?? 'Repository'}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {repository?.type === 'GIT' ? 'Git' : 'SVN'} repository
                {repository?.localPath && ` — ${repository.localPath}`}
              </p>
            </div>
            {repository?.url && (
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View Remote →
              </a>
            )}
          </div>
        </div>

        {/* Commit List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Commits</h2>
          </div>

          {isLoading && (
            <div className="text-center py-12 text-gray-500">Loading commits...</div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500">
              Failed to load commits. Please try again.
            </div>
          )}

          {!isLoading && !error && commits?.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No commits found</h3>
              <p className="text-gray-500">
                This repository has no commits or the local path is not configured.
              </p>
            </div>
          )}

          {!isLoading && !error && commits && commits.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SHA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commits.map((commit) => (
                  <tr key={commit.sha} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                        {commit.sha.substring(0, 8)}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-900">{commit.message}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{commit.authorName}</div>
                      <div className="text-xs text-gray-400">{commit.authorEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(commit.committedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}