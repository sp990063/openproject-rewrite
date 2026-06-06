export const dynamic = 'force-dynamic'
/**
 * Admin Webhooks Management Page
 * System-wide webhook configuration for administrators
 */
import React, { useState } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormField, FormSection, FormError } from '@/components/forms'
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_DESCRIPTIONS } from '@/lib/webhooks/event-types'

interface Webhook {
  id: string
  url: string
  events: string[]
  active: boolean
  projectId: string | null
  project?: { id: string; name: string; identifier: string } | null
  createdAt: string
  updatedAt: string
  _count: { deliveries: number }
}

interface CreateWebhookRequest {
  url: string
  events: string[]
  secret?: string
  active?: boolean
}

/**
 * Zod schema (single source of truth for types + validation).
 *
 * - `name` is the human-readable label of the webhook; required, 1-120 chars.
 * - `url` must be a valid absolute URL.
 * - `events` must be a non-empty array of strings.
 * - `secret` is optional ('' is treated as "not set" and dropped from the
 *   payload, matching the previous behaviour).
 * - `active` defaults to true (matches the prior `formData.active: true`).
 *
 * The schema's input and output types are kept identical (no `.transform()`,
 * no divergent `.optional()`/`.default()`) so RHF's `Control<T, _, T>` variance
 * is preserved — same approach used in `pages/admin/announcements/index.tsx`
 * and `components/meetings/MeetingForm.tsx`.
 */
const createWebhookSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(120, 'Name must be 120 characters or fewer'),
  url: z
    .string()
    .min(1, 'Webhook URL is required')
    .url('Enter a valid URL (e.g. https://example.com/webhook)'),
  events: z
    .array(z.string())
    .min(1, 'Select at least one event'),
  secret: z.string().max(256, 'Secret must be 256 characters or fewer'),
  active: z.boolean(),
})

type CreateWebhookFormValues = z.infer<typeof createWebhookSchema>

const defaultValues: CreateWebhookFormValues = {
  name: '',
  url: '',
  events: [],
  secret: '',
  active: true,
}

/**
 * Map form values to the API payload. The server treats empty `secret` as
 * "not set"; we send `undefined` so the schema can mark it optional.
 */
function toApiPayload(values: CreateWebhookFormValues): CreateWebhookRequest {
  return {
    url: values.url,
    events: values.events,
    secret: values.secret.length > 0 ? values.secret : undefined,
    active: values.active,
  }
}

export default function AdminWebhooksPage() {
  const queryClient = useQueryClient()
  // `showCreateForm` is UI flow state (whether the form section is open),
  // not form data — it stays as plain useState, as in the other admin
  // pages.
  const [showCreateForm, setShowCreateForm] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CreateWebhookFormValues>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues,
  })

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ['admin', 'webhooks'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks')
      if (!res.ok) throw new Error('Failed to fetch webhooks')
      return res.json()
    },
  })

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateWebhookRequest) => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create webhook')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] })
      setShowCreateForm(false)
      reset(defaultValues)
    },
  })

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete webhook')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] })
    },
  })

  // Toggle webhook active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) throw new Error('Failed to update webhook')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] })
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const payload = toApiPayload(values)
    try {
      await createMutation.mutateAsync(payload)
    } catch (err) {
      setError('root', {
        type: 'server',
        message: err instanceof Error ? err.message : 'Failed to create webhook',
      })
    }
  })

  const handleCancel = () => {
    setShowCreateForm(false)
    reset(defaultValues)
  }

  // Build the top-of-form error payload. Mirrors the announcement page
  // pattern: collect root + per-field issues into a list suitable for
  // <FormError>. We only surface this after the user has attempted to
  // submit (matches the prior behaviour).
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
        <title>Webhooks - Admin - OpenProject</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure system-wide webhooks to receive notifications about project events
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
              {showCreateForm ? 'Cancel' : 'Create Webhook'}
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <form onSubmit={onSubmit} className="mb-8" noValidate>
              <FormSection
                title="Create New Webhook"
                description="Configure a webhook endpoint to receive event notifications"
              >
                {formErrorPayload && <FormError error={formErrorPayload} />}

                <FormField
                  control={control}
                  name="name"
                  label="Name"
                  type="text"
                  required
                  placeholder="e.g. CI notifications, Slack bridge"
                />

                <FormField
                  control={control}
                  name="url"
                  label="Webhook URL"
                  type="text"
                  required
                  placeholder="https://example.com/webhook"
                  description="Must be a valid absolute URL. The endpoint will receive POST requests."
                />

                <FormField
                  control={control}
                  name="secret"
                  label="Secret (for HMAC signing)"
                  type="text"
                  placeholder="Optional HMAC secret"
                  description="If set, the payload is signed with HMAC-SHA256 using this secret."
                />

                {/* Events — multi-select checkbox group. FormField only handles
                    single-value fields, so we use Controller directly. */}
                <Controller
                  name="events"
                  control={control}
                  render={({ field, fieldState }) => {
                    const selected: string[] = Array.isArray(field.value)
                      ? (field.value as string[])
                      : []
                    const toggle = (event: string) => {
                      const next = selected.includes(event)
                        ? selected.filter((e) => e !== event)
                        : [...selected, event]
                      field.onChange(next)
                    }
                    return (
                      <div className="w-full space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Events
                          <span aria-hidden="true" className="ml-0.5 text-red-700">
                            *
                          </span>
                        </label>
                        <p className="text-xs text-gray-500">
                          Select the events that should trigger this webhook.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {WEBHOOK_EVENTS.map((event) => (
                            <label
                              key={event}
                              className="inline-flex items-center"
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(event)}
                                onChange={() => toggle(event)}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {WEBHOOK_EVENT_DESCRIPTIONS[event]}
                              </span>
                            </label>
                          ))}
                        </div>
                        {fieldState.error?.message && (
                          <p role="alert" className="text-xs text-red-700">
                            {fieldState.error.message}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />

                {/* Active immediately — boolean checkbox, mapped to FormField
                    would require a dedicated type, so we use Controller here
                    too, matching the announcements page. */}
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="active"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor="active"
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Active immediately
                      </label>
                    </div>
                  )}
                />

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
                    disabled={isSubmitting || createMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isSubmitting || createMutation.isPending
                      ? 'Creating...'
                      : 'Create Webhook'}
                  </button>
                </div>
              </FormSection>
            </form>
          )}

          {/* Webhooks List */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading webhooks...</p>
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deliveries
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {webhooks.map(webhook => (
                    <tr key={webhook.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {webhook.url}
                        </div>
                        {webhook.project && (
                          <div className="text-xs text-gray-500">
                            Project: {webhook.project.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map(event => (
                            <span
                              key={event}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() =>
                            toggleMutation.mutate({ id: webhook.id, active: !webhook.active })
                          }
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            webhook.active
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {webhook.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {webhook._count.deliveries}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this webhook?')) {
                              deleteMutation.mutate(webhook.id)
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
              <p className="text-gray-500">No webhooks configured yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Create your first webhook
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
