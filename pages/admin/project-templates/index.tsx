export const dynamic = 'force-dynamic'
// pages/admin/project-templates/index.tsx
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'

const ALL_MODULES = [
  'work_packages',
  'gantt',
  'board',
  'calendar',
  'wiki',
  'forums',
  'documents',
  'meetings',
  'time_tracking',
]

interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  modules: string[]
  createdAt: string
  updatedAt: string
}

export default function ProjectTemplatesListPage() {
  const qc = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateModules, setNewTemplateModules] = useState<string[]>(ALL_MODULES)

  const { data, isLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => fetch('/api/project-templates').then((r) => r.json()),
  })

  const createMut = useMutation({
    mutationFn: async (data: { name: string; description?: string; modules: string[] }) =>
      fetch('/api/project-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] })
      setIsCreateModalOpen(false)
      setNewTemplateName('')
      setNewTemplateDescription('')
      setNewTemplateModules(ALL_MODULES)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/project-templates/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates'] }),
  })

  const templates: ProjectTemplate[] = data ?? []

  const toggleModule = (module: string) => {
    setNewTemplateModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    )
  }

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate({
      name: newTemplateName,
      description: newTemplateDescription || undefined,
      modules: newTemplateModules,
    })
  }

  return (
    <>
      <Head>
        <title>Project Templates — Admin</title>
      </Head>
      <div className="container mx-auto max-w-6xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Project Templates</h1>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            + New Template
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No project templates configured yet.</p>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Create your first template
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-gray-500">
                      {template.description || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.modules.map((module) => (
                          <Badge key={module} variant="secondary">
                            {module}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/admin/project-templates/${template.id}/edit`}>
                          <Button size="sm" variant="secondary">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (confirm(`Delete "${template.name}"?`)) {
                              deleteMut.mutate(template.id)
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Project Template"
        description="Create a reusable project template with pre-configured modules."
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <Input
            label="Template Name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="e.g., Scrum Project"
            required
          />
          <Input
            label="Description"
            value={newTemplateDescription}
            onChange={(e) => setNewTemplateDescription(e.target.value)}
            placeholder="Optional description"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modules
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((module) => (
                <button
                  key={module}
                  type="button"
                  onClick={() => toggleModule(module)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    newTemplateModules.includes(module)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {module}
                </button>
              ))}
            </div>
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
              isLoading={createMut.isPending}
              disabled={newTemplateModules.length === 0}
            >
              Create Template
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
