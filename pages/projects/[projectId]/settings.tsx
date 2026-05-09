import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Input, Select, Modal, Tabs, TabsList, TabsTrigger } from '@/components/ui'
import type { ProjectDetail, ProjectMember, Role, ModuleType, ProjectStatus } from '@/types/project'

export const dynamic = 'force-dynamic'

const MODULE_OPTIONS: { value: ModuleType; label: string }[] = [
  { value: 'work_packages', label: 'Work Packages' },
  { value: 'gantt', label: 'Gantt Chart' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'wiki', label: 'Wiki' },
  { value: 'forums', label: 'Forums' },
  { value: 'documents', label: 'Documents' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'time_tracking', label: 'Time Tracking' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'archived', label: 'Archived' },
]

interface ProjectSettingsProps {
  projectId: string
}

async function fetchProject(projectId: string): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to fetch project')
  return res.json()
}

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch('/api/roles')
  if (!res.ok) throw new Error('Failed to fetch roles')
  return res.json()
}

async function updateProject(projectId: string, data: { name?: string; description?: string; status?: ProjectStatus }): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update project')
  return res.json()
}

async function updateModules(projectId: string, modules: Array<{ module: ModuleType; enabled: boolean }>): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/modules`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modules }),
  })
  if (!res.ok) throw new Error('Failed to update modules')
}

async function addMember(projectId: string, userId: string, roleId: string): Promise<ProjectMember> {
  const res = await fetch(`/api/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roleId }),
  })
  if (!res.ok) throw new Error('Failed to add member')
  return res.json()
}

async function updateMember(projectId: string, memberId: string, roleId: string): Promise<ProjectMember> {
  const res = await fetch(`/api/projects/${projectId}/members`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId, memberId }),
  })
  if (!res.ok) throw new Error('Failed to update member')
  return res.json()
}

async function removeMember(projectId: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/members?memberId=${memberId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to remove member')
}

export default function ProjectSettingsPage() {
  const router = useRouter()
  const { projectId } = router.query
  const queryClient = useQueryClient()

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId as string),
    enabled: !!projectId,
  })

  // Fetch roles for member management
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  })

  // State for forms
  const [activeTab, setActiveTab] = useState('general')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('active')
  const [localModules, setLocalModules] = useState<Array<{ module: ModuleType; enabled: boolean }>>([])

  // Add member modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newMemberRoleId, setNewMemberRoleId] = useState('')

  // Edit member role modal state
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null)
  const [editingRoleId, setEditingRoleId] = useState('')

  // Initialize form when project loads
  React.useEffect(() => {
    if (project) {
      setProjectName(project.name)
      setProjectDescription(project.description || '')
      setProjectStatus(project.status)
      setLocalModules(project.modules.map(m => ({ module: m.module as ModuleType, enabled: m.enabled })))
    }
  }, [project])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; status?: ProjectStatus }) =>
      updateProject(projectId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  // Modules update mutation
  const modulesMutation = useMutation({
    mutationFn: (modules: Array<{ module: ModuleType; enabled: boolean }>) =>
      updateModules(projectId as string, modules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      addMember(projectId as string, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setIsAddMemberOpen(false)
      setNewMemberUserId('')
      setNewMemberRoleId('')
    },
  })

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: string; roleId: string }) =>
      updateMember(projectId as string, memberId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setEditingMember(null)
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(projectId as string, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  // Handle project details save
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      name: projectName,
      description: projectDescription,
      status: projectStatus,
    })
  }

  // Handle module toggle
  const handleModuleToggle = (module: ModuleType) => {
    const updated = localModules.map(m =>
      m.module === module ? { ...m, enabled: !m.enabled } : m
    )
    setLocalModules(updated)
  }

  // Handle modules save
  const handleSaveModules = () => {
    modulesMutation.mutate(localModules)
  }

  // Handle add member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (newMemberUserId && newMemberRoleId) {
      addMemberMutation.mutate({ userId: newMemberUserId, roleId: newMemberRoleId })
    }
  }

  // Handle edit member role
  const handleEditMember = (member: ProjectMember) => {
    setEditingMember(member)
    setEditingRoleId(member.roleId)
  }

  const handleSaveMemberRole = () => {
    if (editingMember && editingRoleId) {
      updateMemberMutation.mutate({ memberId: editingMember.id, roleId: editingRoleId })
    }
  }

  // Handle remove member
  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      removeMemberMutation.mutate(memberId)
    }
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (projectLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading project settings...</div>
      </AuthenticatedLayout>
    )
  }

  if (!project) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Project not found</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-500">
            Back to projects
          </Link>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
            <p className="text-gray-500 text-sm mt-1">{project.name}</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="px-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <div className="p-6">
              {activeTab === 'general' && (
                <form onSubmit={handleSaveDetails} className="space-y-6 max-w-lg">
                  <Input
                    label="Project Name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Enter project description"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <Select
                    label="Status"
                    value={projectStatus}
                    onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                    options={STATUS_OPTIONS}
                  />

                  <div className="flex items-center gap-3 pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={updateMutation.isPending}
                    >
                      Save Changes
                    </Button>
                    {updateMutation.isSuccess && (
                      <span className="text-sm text-green-600">Changes saved!</span>
                    )}
                    {updateMutation.isError && (
                      <span className="text-sm text-red-600">Failed to save changes</span>
                    )}
                  </div>
                </form>
              )}

              {/* Modules Tab */}
              {activeTab === 'modules' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      Enable or disable modules for this project. Changes will take effect immediately.
                    </p>
                  </div>

                  <div className="space-y-3 max-w-lg">
                    {localModules.map((module) => (
                      <div
                        key={module.module}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {MODULE_OPTIONS.find(m => m.value === module.module)?.label || module.module}
                          </p>
                          <p className="text-sm text-gray-500">{module.module}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleModuleToggle(module.module)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            module.enabled ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              module.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <Button
                      variant="primary"
                      onClick={handleSaveModules}
                      isLoading={modulesMutation.isPending}
                    >
                      Save Modules
                    </Button>
                    {modulesMutation.isSuccess && (
                      <span className="text-sm text-green-600">Modules updated!</span>
                    )}
                    {modulesMutation.isError && (
                      <span className="text-sm text-red-600">Failed to update modules</span>
                    )}
                  </div>
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                      <p className="text-sm text-gray-500">{project.members.length} members</p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => setIsAddMemberOpen(true)}
                    >
                      Add Member
                    </Button>
                  </div>

                  {project.members.length === 0 ? (
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
                          {project.members.map((member) => (
                            <tr key={member.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                                    {member.user?.name?.charAt(0) || '?'}
                                  </div>
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">
                                      {member.user?.name || 'Unknown'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <p className="text-sm text-gray-500">{member.user?.email || '-'}</p>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {member.role?.name || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                <button
                                  onClick={() => handleEditMember(member)}
                                  className="text-blue-600 hover:text-blue-900 mr-4"
                                >
                                  Edit Role
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-red-600 hover:text-red-900"
                                  disabled={removeMemberMutation.isPending}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        title="Add Member"
        description="Add a new member to this project."
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="User ID"
            value={newMemberUserId}
            onChange={(e) => setNewMemberUserId(e.target.value)}
            placeholder="Enter user ID"
            required
          />
          <Select
            label="Role"
            value={newMemberRoleId}
            onChange={(e) => setNewMemberRoleId(e.target.value)}
            options={roles.map(r => ({ value: r.id, label: r.name }))}
            placeholder="Select a role"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsAddMemberOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={addMemberMutation.isPending}
            >
              Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Role Modal */}
      <Modal
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        title="Edit Member Role"
        description="Change the role for this team member."
      >
        <div className="space-y-4">
          <Select
            label="Role"
            value={editingRoleId}
            onChange={(e) => setEditingRoleId(e.target.value)}
            options={roles.map(r => ({ value: r.id, label: r.name }))}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setEditingMember(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveMemberRole}
              isLoading={updateMemberMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </AuthenticatedLayout>
  )
}
