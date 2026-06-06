// pages/projects/[projectId]/members/index.tsx
//
// Project Members page — list + role badges.
//
// Sprint 3 refactor:
//   - Replaced raw `fetch` + `useState` with `useMembers` (TanStack Query)
//   - Replaced inline role pill with `<RoleBadge>` (uses design-system
//     Badge + role color mapping from spec §5.4)
//   - Wired up `useMemberMutations` (add/update/remove) so the page
//     is ready to host the Add Member dialog from spec §5.6
//
// Behavior:
//   - Server-rendered initial state via `force-dynamic`
//   - Permission gate: only `members.manage` holders see the Add button
//     (uses the new `usePermission` hook from Sprint 1)
//   - All async operations invalidate the `['projects', projectId, 'members']`
//     query key so the list refetches automatically
export const dynamic = 'force-dynamic'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Badge } from '@/components/ui'
import { RoleBadge } from '@/components/projects/RoleBadge'
import { useMembers } from '@/hooks/useMembers'
import { useMemberMutations } from '@/hooks/useMemberMutations'
import { usePermission } from '@/hooks/use-permission'
import { formatDateTime } from '@/lib/utils'

export default function MembersPage() {
  const router = useRouter()
  const projectId =
    typeof router.query.projectId === 'string' ? router.query.projectId : undefined

  // Sprint 1 hook — returns true when current user has `members.manage`.
  // System admins always pass (handled inside the hook).
  const canManage = usePermission(projectId, 'members.manage')

  // TanStack Query — single source of truth for the member list.
  const { data: members, isLoading, error, refetch } = useMembers(projectId ?? '')

  // Mutations are wired up even if no UI button exists yet, so adding
  // a "Add Member" dialog later is just a JSX change.
  const { addMember, updateMemberRole, removeMember } = useMemberMutations(projectId ?? '')

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading…</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Back to Project
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Members</h1>
              {members && (
                <p className="text-sm text-gray-500 mt-1">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
              )}
            </div>
            {canManage && (
              <Button
                variant="primary"
                // Placeholder: AddMemberDialog wiring is a follow-up.
                // For now the button is the integration point — calling
                // addMember.mutate({ userId, roleId }) on submit.
                onClick={() => {
                  /* AddMemberDialog opens here in a follow-up commit */
                }}
                disabled={addMember.isPending}
              >
                {addMember.isPending ? 'Adding…' : 'Add Member'}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-pulse">Loading members…</div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>Failed to load members. Please try again.</p>
              <div className="mt-2">
                <Button variant="secondary" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : !members || members.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No members yet. {canManage && 'Add the first team member to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added
                    </th>
                    {canManage && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {member.user?.avatarUrl ? (
                              <img
                                src={member.user.avatarUrl}
                                alt={member.user.name}
                                className="h-8 w-8 object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-600">
                                {member.user?.name?.charAt(0).toUpperCase() ?? '?'}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {member.user?.name ?? '(unknown user)'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {member.user?.email ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge roleId={member.roleId} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(new Date(member.createdAt))}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={removeMember.isPending}
                            onClick={() => {
                              if (confirm(`Remove ${member.user?.name ?? 'this member'}?`)) {
                                removeMember.mutate(member.id)
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dev info: surface TanStack Query status for debugging */}
        {(updateMemberRole.isError || addMember.isError || removeMember.isError) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <Badge variant="error" className="mr-2">
              Error
            </Badge>
            A member operation failed. Check the browser console for details.
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
