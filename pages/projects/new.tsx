// pages/projects/new.tsx
//
// Two-step project creation flow:
//   1. "template" step — optionally pick a project template (multi-step UX state
//      stays in local useState; it isn't a form field).
//   2. "details" step  — the actual form, now driven by react-hook-form + Zod
//      via the `@/components/forms` primitives (FormField / FormSection / FormError).
//
// The submit behaviour (POST /api/projects, or POST /api/project-templates/:id/apply
// when a template is selected) is unchanged.
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FormField, FormSection, FormError } from '@/components/forms'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for validation + TS types for the
// "details" step. The two multi-step UI fields (step, selectedTemplateId) are
// intentionally outside the schema because they are page-flow state, not
// submitted form data.
// ---------------------------------------------------------------------------

// URL-safe identifier: lowercase letters, digits and hyphens only.
const IDENTIFIER_PATTERN = /^[a-z0-9-]+$/

const newProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(120, 'Keep the project name under 120 characters'),
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .max(60, 'Identifier must be 60 characters or fewer')
    .regex(IDENTIFIER_PATTERN, 'Use lowercase letters, numbers and hyphens only'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .or(z.literal('')),
})

type NewProjectFormValues = z.infer<typeof newProjectSchema>

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewProjectPage() {
  const router = useRouter()
  const qc = useQueryClient()

  // Multi-step UI state. Not part of the form schema — these decide which
  // view to render and which mutation to call on submit.
  const [step, setStep] = useState<'template' | 'details'>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )

  // Templates (server state via React Query).
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['project-templates'],
    queryFn: () => fetch('/api/project-templates').then((r) => r.json()),
  })

  // Form state.
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      identifier: '',
      description: '',
    },
  })

  // Watch the relevant fields so we can mirror the original "auto-derive
  // identifier from name when identifier is empty" UX behaviour.
  const watchedName = watch('name')
  const watchedIdentifier = watch('identifier')

  // Create project mutation.
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

  // Apply template mutation (for creating from template).
  const applyTemplate = useMutation({
    mutationFn: async ({
      templateId,
      data,
    }: {
      templateId: string
      data: CreateProjectInput
    }) => {
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
    // Pre-fill name and description from template. We use setValue so the
    // RHF form stays the single source of truth.
    setValue('name', template.name, { shouldDirty: true, shouldValidate: true })
    setValue(
      'description',
      template.description || '',
      { shouldDirty: true, shouldValidate: true }
    )
    // Auto-derive the identifier from the template name (only if the user
    // hasn't typed one manually — we treat the freshly-mounted form's empty
    // identifier as "not yet set").
    setValue(
      'identifier',
      slugifyIdentifier(template.name),
      { shouldDirty: true, shouldValidate: true }
    )
    setStep('details')
  }

  const handleSkipTemplate = () => {
    setSelectedTemplateId(null)
    setStep('details')
  }

  const onSubmit = handleSubmit(async (values) => {
    const data: CreateProjectInput = {
      name: values.name,
      description: values.description ? values.description : undefined,
      identifier: values.identifier, // already URL-safe by Zod + input filter
    }

    try {
      if (selectedTemplateId) {
        await applyTemplate.mutateAsync({
          templateId: selectedTemplateId,
          data,
        })
      } else {
        await createProject.mutateAsync(data)
      }
    } catch (err) {
      setError(
        'root',
        {
          type: 'server',
          message: err instanceof Error ? err.message : 'Save failed',
        },
        { shouldFocus: true }
      )
    }
  })

  // Mirror the original "auto-derive identifier from name when identifier is
  // empty" UX. We watch the current values via RHF and use a side-effect so
  // the FormField primitives can own the field's value/onChange.
  useEffect(() => {
    if (!watchedIdentifier) {
      setValue('identifier', slugifyIdentifier(watchedName), {
        shouldValidate: true,
      })
    }
    // We intentionally only depend on `watchedName`: re-running on
    // `watchedIdentifier` would create a feedback loop with our own
    // setValue call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName, setValue])

  const templateList: ProjectTemplate[] = templates ?? []
  const selectedTemplate = selectedTemplateId
    ? templateList.find((t) => t.id === selectedTemplateId)
    : undefined
  const isMutating = isSubmitting || createProject.isPending || applyTemplate.isPending

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
              <h2 className="text-lg font-semibold mb-2">
                Choose a Template (Optional)
              </h2>
              <p className="text-gray-500 mb-6">
                Select a template to pre-configure your project with modules,
                or start from scratch.
              </p>

              {templatesLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Loading templates...
                </div>
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
                          <h3 className="font-semibold text-gray-900">
                            {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.modules.map((module) => (
                              <Badge
                                key={module}
                                variant="secondary"
                                className="text-xs"
                              >
                                {module}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedTemplateId === template.id
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}
                        >
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
            <FormSection
              title="Project Details"
              description={
                selectedTemplate
                  ? `Using template: ${selectedTemplate.name}`
                  : 'Tell us a bit about this project.'
              }
              footer={
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('template')}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    ← Change Template
                  </button>
                  <div className="flex justify-end gap-3">
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
                      isLoading={isMutating}
                      disabled={isMutating}
                    >
                      Create Project
                    </Button>
                  </div>
                </div>
              }
            >
              {selectedTemplate && (
                <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Using template:</span>{' '}
                    {selectedTemplate.name}
                  </p>
                </div>
              )}

              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <FormError
                  error={
                    errors.root
                      ? {
                          issues: [
                            {
                              path: ['root'],
                              message: errors.root.message ?? 'Save failed',
                            },
                          ],
                        }
                      : null
                  }
                />

                <FormField
                  control={control}
                  name="name"
                  label="Project Name"
                  type="text"
                  required
                  placeholder="My Awesome Project"
                />

                <FormField
                  control={control}
                  name="identifier"
                  label="Identifier"
                  type="text"
                  required
                  placeholder="my-awesome-project"
                  description="URL-safe, lowercase letters, numbers, and hyphens"
                />

                <FormField
                  control={control}
                  name="description"
                  label="Description"
                  type="textarea"
                  placeholder="Optional project description"
                />
              </form>
            </FormSection>
          )}
        </div>
      </AuthenticatedLayout>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary string into the URL-safe identifier format
 * (lowercase letters, digits and hyphens). Whitespace is collapsed to
 * `-`; any other non-allowed character is dropped. This matches the
 * behaviour of the original `handleIdentifierChange` / `onChange` filter.
 */
function slugifyIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}
