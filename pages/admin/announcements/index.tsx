export const dynamic = 'force-dynamic'
/**
 * Admin Announcements Management Page
 * System-wide announcements for maintenance notices, new features, etc.
 */
import React, { useState } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormField, FormSection, FormError, type FormFieldOption } from '@/components/forms'
import { Input } from '@/components/ui/Input'

interface Announcement {
  id: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  dismissible: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

/**
 * Zod schema (single source of truth for types + validation).
 *
 * Mirrors the server-side schema in `pages/api/announcements/index.ts`. We
 * deliberately keep input and output types identical — no `.transform()` and
 * no divergent `.optional()`/`.default()` shapes — because RHF's
 * `Control<TFieldValues, TContext, TTransformedValues>` third generic breaks
 * variance when the resolver's output type differs from its input.
 *
 * Datetime-local inputs are always strings in the DOM, so we keep them as
 * strings. `''` is treated as "not set" and converted to `null` in the API
 * payload mapper below.
 */
const announcementSchema = z
  .object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(2000, 'Content must be 2000 characters or fewer'),
    type: z.enum(['info', 'warning', 'success', 'error'], {
      message: 'Pick a type',
    }),
    dismissible: z.boolean(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .refine(
    (data) => {
      // Cross-field validation: if both dates are set, start must be <= end.
      if (data.startsAt && data.endsAt) {
        const start = new Date(data.startsAt)
        const end = new Date(data.endsAt)
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          return start <= end
        }
      }
      return true
    },
    { message: 'Start date must be before end date', path: ['endsAt'] }
  )

type AnnouncementFormValues = z.infer<typeof announcementSchema>

const typeOptions: FormFieldOption[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
]

/**
 * Map form values to the API payload. The API expects `startsAt`/`endsAt`
 * as ISO strings (or `null`); empty strings from the form mean "not set".
 */
function toApiPayload(values: AnnouncementFormValues): {
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  dismissible: boolean
  startsAt: string | null
  endsAt: string | null
} {
  return {
    content: values.content,
    type: values.type,
    dismissible: values.dismissible,
    startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
    endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
  }
}

const defaultValues: AnnouncementFormValues = {
  content: '',
  type: 'info',
  dismissible: true,
  startsAt: '',
  endsAt: '',
}

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues,
  })

  // Fetch announcements
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['admin', 'announcements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements')
      if (!res.ok) throw new Error('Failed to fetch announcements')
      return res.json()
    },
  })

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: ReturnType<typeof toApiPayload>) => {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create announcement')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      setShowCreateForm(false)
      setEditingId(null)
      reset(defaultValues)
    },
  })

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: ReturnType<typeof toApiPayload>
    }) => {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update announcement')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      setEditingId(null)
      setShowCreateForm(false)
      reset(defaultValues)
    },
  })

  // Delete announcement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete announcement')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const payload = toApiPayload(values)
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
    } catch (err) {
      setError('root', {
        type: 'server',
        message: err instanceof Error ? err.message : 'Save failed',
      })
    }
  })

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    reset({
      content: announcement.content,
      type: announcement.type,
      dismissible: announcement.dismissible,
      // datetime-local inputs need values in local-time "YYYY-MM-DDTHH:mm" format
      startsAt: announcement.startsAt
        ? toDatetimeLocal(new Date(announcement.startsAt))
        : '',
      endsAt: announcement.endsAt
        ? toDatetimeLocal(new Date(announcement.endsAt))
        : '',
    })
    setShowCreateForm(true)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingId(null)
    reset(defaultValues)
  }

  // Build the top-of-form error payload. Mirrors the `MeetingForm` pattern:
  // collect root + per-field issues into a list suitable for <FormError>.
  const rootError = errors.root?.message
  const issueList: Array<{ path?: ReadonlyArray<PropertyKey>; message: string }> = []
  if (submitCount > 0) {
    for (const [name, err] of Object.entries(errors)) {
      if (name === 'root') continue
      const message = err?.message
      if (typeof message === 'string' && message.length > 0) {
        issueList.push({ path: [name], message })
      }
    }
  }
  const formErrorPayload = rootError
    ? { issues: [{ message: rootError }, ...issueList] }
    : issueList.length > 0
    ? { issues: issueList }
    : null

  return (
    <>
      <Head>
        <title>Announcements - Admin - OpenProject</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
              <p className="mt-1 text-sm text-gray-500">
                System-wide banners for maintenance notices, new features, and more
              </p>
            </div>
            <button
              onClick={() => {
                if (showCreateForm) {
                  handleCancel()
                } else {
                  setShowCreateForm(true)
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showCreateForm ? 'Cancel' : 'Create Announcement'}
            </button>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <form onSubmit={onSubmit} className="mb-8" noValidate>
              <FormSection
                title={editingId ? 'Edit Announcement' : 'Create New Announcement'}
                description="Announcements are shown to every user. Use scheduling to limit visibility."
              >
                {formErrorPayload && <FormError error={formErrorPayload} />}

                <FormField
                  control={control}
                  name="content"
                  label="Content"
                  type="textarea"
                  required
                  placeholder="Enter announcement content... (Markdown supported)"
                  description="Up to 2000 characters. Markdown is supported."
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="type"
                    label="Type"
                    type="select"
                    options={typeOptions}
                  />

                  <Controller
                    name="dismissible"
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center pt-6">
                        <input
                          type="checkbox"
                          id="dismissible"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label
                          htmlFor="dismissible"
                          className="ml-2 block text-sm text-gray-700"
                        >
                          User can dismiss
                        </label>
                      </div>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="startsAt"
                    control={control}
                    render={({ field, fieldState }) => (
                      <div>
                        <label
                          htmlFor="startsAt"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Start Date (optional)
                        </label>
                        <Input
                          id="startsAt"
                          type="datetime-local"
                          value={(field.value as string | undefined) ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          error={fieldState.error?.message}
                          className="mt-1"
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name="endsAt"
                    control={control}
                    render={({ field, fieldState }) => (
                      <div>
                        <label
                          htmlFor="endsAt"
                          className="block text-sm font-medium text-gray-700"
                        >
                          End Date (optional)
                        </label>
                        <Input
                          id="endsAt"
                          type="datetime-local"
                          value={(field.value as string | undefined) ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          error={fieldState.error?.message}
                          className="mt-1"
                        />
                      </div>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting || createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingId
                      ? 'Update Announcement'
                      : 'Create Announcement'}
                  </button>
                </div>
              </FormSection>
            </form>
          )}

          {/* Announcements List */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading announcements...</p>
            </div>
          ) : announcements && announcements.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dismissible
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {announcements.map(announcement => (
                    <tr key={announcement.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-md truncate">
                          {announcement.content}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          announcement.type === 'info' ? 'bg-blue-100 text-blue-800' :
                          announcement.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          announcement.type === 'success' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {announcement.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {announcement.startsAt && (
                            <div>Start: {new Date(announcement.startsAt).toLocaleDateString()}</div>
                          )}
                          {announcement.endsAt && (
                            <div>End: {new Date(announcement.endsAt).toLocaleDateString()}</div>
                          )}
                          {!announcement.startsAt && !announcement.endsAt && (
                            <span className="text-gray-400">Always visible</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          announcement.dismissible ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {announcement.dismissible ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this announcement?')) {
                              deleteMutation.mutate(announcement.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-white shadow rounded-lg">
              <p className="text-gray-500">No announcements yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Create your first announcement
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Format a Date as the `YYYY-MM-DDTHH:mm` string expected by
 * `<input type="datetime-local">` (local time, not UTC).
 */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
