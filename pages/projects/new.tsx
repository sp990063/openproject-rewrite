export const dynamic = 'force-dynamic'
// pages/projects/new.tsx
import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  modules: string[]
}

interface CreateProjectInput {
  name: string
  description?: string
  identifier: string
  moduleTypes?: string[]
}

export default function NewProjectPage() {
  const router = useRouter()
  const qc = useQueryClient()

  // Step state: 'template' or 'details'
  const [step, setStep] = useState<'template' | 'details'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [identifier, setIdentifier] = useState('')

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => fetch('/api/project-templates').then((r) => r.json()),
  })

  // Create project mutation
  const createProject = useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create project')
      }
      return res.json()
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.push(`/projects/${project.id}`)
    },
  })

  // Apply template mutation (for creating from template)
  const applyTemplate = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: CreateProjectInput }) => {
      const res = await fetch(`/api/project-templates/${templateId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create project from template')
      }
      return res.json()
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.push(`/projects/${project.id}`)
    },
  })

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplateId(template.id)
    // Pre-fill name and description from template
    setName(template.name)
    setDescription(template.description || '')
    setStep('details')
  }

  const handleSkipTemplate = () => {
    setSelectedTemplateId(null)
    setStep('details')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name,
      description: description || undefined,
      identifier: identifier.toLowerCase().replace(/\s+/g, '-'),
    }

    if (selectedTemplateId) {
      applyTemplate.mutate({ templateId: selectedTemplateId, data })
    } else {
      createProject.mutate(data)
    }
  }

  const handleIdentifierChange = (value: string) => {
    // Auto-generate identifier from name if empty
    if (!identifier && value) {
      setIdentifier(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    } else {
      setIdentifier(value)
    }
  }

  const templateList: ProjectTemplate[] = templates ?? []

  return (
    <>
      <Head>
        <title>New Project</title>
      </Head>
      <AuthenticatedLayout>
        <div className="max-w-3xl mx-auto py-8">
          <h1 className="text-2xl font-bold mb-6">Create New Project</h1>

          {step === 'template' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-2">Choose a Template (Optional)</h2>
              <p className="text-gray-500 mb-6">
                Select a template to pre-configure your project with modules, or start from scratch.
              </p>

              {templatesLoading ? (
                <div className="text-center py-12 text-gray-500">Loading templates...</div>
              ) : templateList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 mb-6">
                  <p className="mb-4">No templates available yet.</p>
                  <Button variant="secondary" onClick={handleSkipTemplate}>
                    Start from Scratch
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {templateList.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:border-blue-300 ${
                        selectedTemplateId === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.modules.map((module) => (
                              <Badge key={module} variant="secondary" className="text-xs">
                                {module}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedTemplateId === template.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedTemplateId === template.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleSkipTemplate}>
                  Start from Scratch
                </Button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Project Details</h2>
                <button
                  type="button"
                  onClick={() => setStep('template')}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  ← Change Template
                </button>
              </div>

              {selectedTemplateId && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Using template:</span>{' '}
                    {templateList.find((t) => t.id === selectedTemplateId)?.name}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Project Name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    handleIdentifierChange(e.target.value)
                  }}
                  placeholder="My Awesome Project"
                  required
                />
                <Input
                  label="Identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-awesome-project"
                  helperText="URL-safe, lowercase letters, numbers, and hyphens"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional project description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setStep('template')}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    isLoading={createProject.isPending || applyTemplate.isPending}
                    disabled={!name || !identifier}
                  >
                    Create Project
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </AuthenticatedLayout>
    </>
  )
}
