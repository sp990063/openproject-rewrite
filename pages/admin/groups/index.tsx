export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import Head from 'next/head'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { GroupCard } from '@/components/groups/GroupCard'
import { useGroups, useCreateGroup, useDeleteGroup } from '@/hooks/use-groups'
import { Button, Input } from '@/components/ui'

export default function GroupsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [newGroupName, setNewGroupName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data: groups, isLoading, error } = useGroups()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()

  // Redirect non-admins
  React.useEffect(() => {
    if (session && !session.user?.isSystemAdmin) {
      router.push('/dashboard')
    }
  }, [session, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    try {
      await createGroup.mutateAsync(newGroupName.trim())
      setNewGroupName('')
      setShowCreateForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create group')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return
    try {
      await deleteGroup.mutateAsync(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete group')
    }
  }

  if (!session?.user?.isSystemAdmin) {
    return null
  }

  return (
    <AuthenticatedLayout>
      <Head>
        <title>User Groups - Admin</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Groups</h1>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create Group'}
          </Button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={createGroup.isPending || !newGroupName.trim()}>
                {createGroup.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        )}

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading groups...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">Failed to load groups</div>
        )}

        {groups && groups.length === 0 && !showCreateForm && (
          <div className="text-center py-12 text-gray-500">
            No groups yet. Create your first group to get started.
          </div>
        )}

        <div className="space-y-3">
          {groups?.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onDelete={handleDelete}
              isDeleting={deleteGroup.isPending}
            />
          ))}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
