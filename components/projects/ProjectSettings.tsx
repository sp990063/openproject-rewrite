import React, { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import type { ProjectDetail, ProjectStatus } from '@/types/project'

interface ProjectSettingsProps {
  project: ProjectDetail
  onSave: (data: {
    name?: string
    description?: string
    status?: ProjectStatus
  }) => void
  isSaving?: boolean
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'archived', label: 'Archived' },
]

export function ProjectSettings({ project, onSave, isSaving }: ProjectSettingsProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name !== project.name ? name : undefined,
      description: description !== (project.description || '') ? description : undefined,
      status: status !== project.status ? status : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <Input
        label="Project Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter project name"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter project description"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        options={STATUS_OPTIONS}
      />

      <div className="flex items-center gap-3 pt-4">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </form>
  )
}