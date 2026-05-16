export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { MemberList } from '@/components/groups/MemberList'
import { useGroup, useUpdateGroup, useAddGroupMember, useRemoveGroupMember } from '@/hooks/use-groups'
import { Button, Input } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'

export default function GroupDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const { data: group, isLoading, error } = useGroup(id as string)
  const updateGroup = useUpdateGroup()
  const addMember = useAddGroupMember()
  const removeMember = useRemoveGroupMember()

  const handleUpdateName = async () => {
    if (!nameValue.trim() || !id) return
    try {
      await updateGroup.mutateAsync({ id: id as string, name: nameValue.trim() })
      setEditingName(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update group name')
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberEmail.trim() || !id) return

    try {
      // In a real app, we'd look up the user by email first
      // For now, we'll just add by email assumption
      await addMember.mutateAsync({ groupId: id as string, userId: newMemberEmail.trim() })
      setNewMemberEmail('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!id) return
    if (!confirm('Remove this member from the group?')) return
    try {
      await removeMember.mutateAsync({ groupId: id as string, userId })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (error || !group) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-red-500">Group not found</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <Head>
        <title>{group.name} - User Groups</title>
      </Head>

      <div className="max-w-2xl mx-auto">
        <Link href="/admin/groups" className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Groups</span>
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            {editingName ? (
              <div className="flex gap-2 flex-1">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleUpdateName} disabled={updateGroup.isPending}>
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setEditingName(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                <Button variant="secondary" size="sm" onClick={() => {
                  setNameValue(group.name)
                  setEditingName(true)
                }}>
                  Edit Name
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Created {new Date(group.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Members</h2>

          <form onSubmit={handleAddMember} className="mb-4">
            <div className="flex gap-2">
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Enter user ID to add"
                className="flex-1"
              />
              <Button type="submit" disabled={addMember.isPending || !newMemberEmail.trim()}>
                {addMember.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </form>

          <MemberList
            members={group.members}
            onRemove={handleRemoveMember}
            isRemoving={removeMember.isPending}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
