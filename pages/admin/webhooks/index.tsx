export const dynamic = 'force-dynamic'
/**
 * Admin Webhooks Management Page
 * System-wide webhook configuration for administrators
 */
import React, { useState } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export default function AdminWebhooksPage() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [formData, setFormData] = useState<CreateWebhookRequest>({
    url: '',
    events: [],
    secret: '',
    active: true,
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
      setFormData({ url: '', events: [], secret: '', active: true })
      setSelectedEvents([])
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

  const handleEventToggle = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      url: formData.url,
      events: selectedEvents,
      secret: formData.secret || undefined,
      active: formData.active,
    })
  }

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
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showCreateForm ? 'Cancel' : 'Create Webhook'}
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Create New Webhook</h2>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                    Webhook URL *
                  </label>
                  <input
                    type="url"
                    id="url"
                    required
                    value={formData.url}
                    onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://example.com/webhook"
                  />
                </div>

                <div>
                  <label htmlFor="secret" className="block text-sm font-medium text-gray-700">
                    Secret (for HMAC signing)
                  </label>
                  <input
                    type="text"
                    id="secret"
                    value={formData.secret || ''}
                    onChange={e => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Optional HMAC secret"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEBHOOK_EVENTS.map(event => (
                      <label key={event} className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event)}
                          onChange={() => handleEventToggle(event)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {WEBHOOK_EVENT_DESCRIPTIONS[event]}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedEvents.length === 0 && (
                    <p className="mt-1 text-sm text-red-500">Select at least one event</p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                    Active immediately
                  </label>
                </div>

                {createMutation.isError && (
                  <p className="text-sm text-red-600">
                    {createMutation.error instanceof Error
                      ? createMutation.error.message
                      : 'Failed to create webhook'}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={selectedEvents.length === 0 || createMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
                  </button>
                </div>
              </form>
            </div>
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
