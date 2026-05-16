export const dynamic = 'force-dynamic'
// pages/admin/project-templates/[id]/edit.tsx
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

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

export default function EditProjectTemplatePage() {
  const router = useRouter()
  const { id } = router.query
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modules, setModules] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  const { data: template, isLoading } = useQuery({
    queryKey: ['project-templates', id],
    queryFn: async () => {
      const res = await fetch(`/api/project-templates/${id}`)
      if (!res.ok) throw new Error('Failed to fetch template')
      return res.json() as Promise<ProjectTemplate>
    },
    enabled: !!id,
  })

  // Initialize form when template loads
  if (template && !isInitialized) {
    setName(template.name)
    setDescription(template.description || '')
    setModules(template.modules)
    setIsInitialized(true)
  }

  const updateMut = useMutation({
    mutationFn: async (data: { name: string; description?: string; modules: string[] }) => {
      const res = await fetch(`/api/project-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update template')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-templates'] })
      alert('Template updated successfully')
    },
  })

  const toggleModule = (module: string) => {
    setModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMut.mutate({
      name,
      description: description || undefined,
      modules,
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center py-12 text-gray-500">Template not found</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Edit {template.name} — Project Templates</title>
      </Head>
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <Link
            href="/admin/project-templates"
            className="text-blue-600 hover:text-blue-500 text-sm"
          >
            ← Back to Templates
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold mb-6">Edit Template</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Scrum Project"
              required
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                      modules.includes(module)
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {module}
                  </button>
                ))}
              </div>
              {modules.length === 0 && (
                <p className="text-sm text-red-500 mt-1">At least one module is required</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Link href="/admin/project-templates">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                type="submit"
                isLoading={updateMut.isPending}
                disabled={modules.length === 0 || !name}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
