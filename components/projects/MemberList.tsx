import React, { useState } from 'react'
import { Button, Modal, Input, Select } from '@/components/ui'
import { MemberCard } from './MemberCard'
import type { ProjectMember, Role } from '@/types/project'

interface MemberListProps {
  projectId: string
  members: ProjectMember[]
  roles: Role[]
  isLoading?: boolean
  onAddMember?: (userId: string, roleId: string) => void
  onEditRole?: (member: ProjectMember, roleId: string) => void
  onRemoveMember?: (memberId: string) => void
}

export function MemberList({
  members,
  roles,
  isLoading,
  onAddMember,
  onEditRole,
  onRemoveMember,
}: MemberListProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null)
  const [newUserId, setNewUserId] = useState('')
  const [newRoleId, setNewRoleId] = useState('')
  const [editRoleId, setEditRoleId] = useState('')
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (newUserId && newRoleId && onAddMember) {
      onAddMember(newUserId, newRoleId)
      setIsAddModalOpen(false)
      setNewUserId('')
      setNewRoleId('')
    }
  }

  const handleEditRole = (member: ProjectMember) => {
    setEditingMember(member)
    setEditRoleId(member.roleId)
    setIsEditModalOpen(true)
  }

  const handleSaveEditRole = () => {
    if (editingMember && editRoleId && onEditRole) {
      onEditRole(editingMember, editRoleId)
      setIsEditModalOpen(false)
      setEditingMember(null)
      setEditRoleId('')
    }
  }

  const handleRemove = (memberId: string) => {
    if (onRemoveMember) {
      setRemovingMemberId(memberId)
      onRemoveMember(memberId)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-10 bg-gray-200 rounded w-1/4" />
        <div className="animate-pulse h-20 bg-gray-200 rounded" />
        <div className="animate-pulse h-20 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500">{members.length} members</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No members yet. Add your first team member.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onEditRole={handleEditRole}
                  onRemove={handleRemove}
                  isRemoving={removingMemberId === member.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        title="Add Member"
        description="Add a new member to this project."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="User ID"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="Enter user ID"
            required
          />
          <Select
            label="Role"
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Select a role"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Role Modal */}
      <Modal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title="Edit Member Role"
        description="Change the role for this team member."
      >
        <div className="space-y-4">
          <Select
            label="Role"
            value={editRoleId}
            onChange={(e) => setEditRoleId(e.target.value)}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEditRole}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}