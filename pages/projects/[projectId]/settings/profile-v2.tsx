// pages/projects/[projectId]/settings/profile-v2.tsx
//
// DEMO PAGE for the new `@/components/forms` layer built on
// `react-hook-form` + `@hookform/resolvers` (Zod 4).
//
// Form fields:
//   • name         (text, required, min 1 char)
//   • description  (textarea, optional, max 280 chars)
//   • visibility   (select: private | team | public)
//
// On submit, the values are logged to the console and a `window.alert` is shown
// to confirm the round trip. This page is intentionally side-effect-free —
// there are no API calls, mutations, or persistence. It exists to exercise the
// new form primitives end-to-end.

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui/Button'
import {
  FormField,
  FormSection,
  FormError,
  type FormFieldOption,
} from '@/components/forms'

const visibilityOptions: FormFieldOption[] = [
  { value: 'private', label: 'Private — only invited members' },
  { value: 'team', label: 'Team — anyone in the project' },
  { value: 'public', label: 'Public — visible to the whole instance' },
]

const profileSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(80, 'Keep the name under 80 characters'),
  description: z
    .string()
    .max(280, 'Description must be 280 characters or fewer')
    .optional()
    .or(z.literal('')),
  visibility: z.enum(['private', 'team', 'public'], {
    message: 'Pick a visibility level',
  }),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function ProjectProfileV2Page() {
  const router = useRouter()
  const { projectId } = router.query

  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, isValid },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      description: '',
      visibility: 'team',
    },
  })

  // Top-level form errors (rare, but useful for showing server-side / global
    // validation issues that don't bind to a single field).
  const [formError, setFormError] = useState<{
    issues: Array<{ path?: ReadonlyArray<PropertyKey>; message: string }>
  } | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    // Demo only: no API call. Just log and toast.
    // eslint-disable-next-line no-console
    console.log('[profile-v2] submit', values)
    // eslint-disable-next-line no-alert
    window.alert(
      `Profile v2 saved (demo)\n\n` +
        `Project: ${projectId ?? '(unknown)'}\n` +
        `Name: ${values.name}\n` +
        `Description: ${values.description || '—'}\n` +
        `Visibility: ${values.visibility}`
    )
    setSubmitMessage('Saved (demo).')
    reset(values, { keepValues: true })
  })

  return (
    <AuthenticatedLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href={`/projects/${projectId}/settings`}
              className="text-sm text-text-muted hover:text-text-default"
            >
              ← Back to project settings
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-text-default">
              Project profile (v2 form demo)
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              New <code>react-hook-form</code> + Zod 4 form layer. This is a
              demo only — no API calls are made.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {formError && <FormError error={formError} />}

          <FormSection
            title="Basics"
            description="The essentials — what is this project called?"
          >
            <FormField
              control={control}
              name="name"
              label="Project name"
              type="text"
              required
              placeholder="e.g. Mobile App Redesign"
              description="Shown in the sidebar and on every project page."
            />

            <FormField
              control={control}
              name="description"
              label="Description"
              type="textarea"
              placeholder="What is this project about? (optional)"
              description="Up to 280 characters. Markdown is not supported here."
            />
          </FormSection>

          <FormSection
            title="Visibility"
            description="Who can see and find this project?"
          >
            <FormField
              control={control}
              name="visibility"
              label="Visibility"
              type="select"
              required
              options={visibilityOptions}
            />
          </FormSection>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted" aria-live="polite">
              {submitMessage ?? 'Form is ' + (isDirty ? 'dirty' : 'pristine') + '.'}
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  reset()
                  setSubmitMessage(null)
                  setFormError(null)
                }}
                disabled={isSubmitting}
              >
                Reset
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={!isDirty || isSubmitting}
                aria-disabled={!isValid || isSubmitting}
              >
                Save (demo)
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  )
}
