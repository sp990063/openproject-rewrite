export const dynamic = 'force-dynamic'
/**
 * Admin Announcements Management Page
 * System-wide announcements for maintenance notices, new features, etc.
 */
import React, { useState } from 'react'
import Head from 'next/head'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Announcement {
  id: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  dismissible: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

interface CreateAnnouncementRequest {
  content: string
  type?: 'info' | 'warning' | 'success' | 'error'
  dismissible?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateAnnouncementRequest>({
    content: '',
    type: 'info',
    dismissible: true,
    startsAt: null,
    endsAt: null,
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
    mutationFn: async (data: CreateAnnouncementRequest) => {
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
      setFormData({ content: '', type: 'info', dismissible: true, startsAt: null, endsAt: null })
    },
  })

  // Update announcement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateAnnouncementRequest> }) => {
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
      setFormData({ content: '', type: 'info', dismissible: true, startsAt: null, endsAt: null })
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setFormData({
      content: announcement.content,
      type: announcement.type,
      dismissible: announcement.dismissible,
      startsAt: announcement.startsAt,
      endsAt: announcement.endsAt,
    })
    setShowCreateForm(true)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingId(null)
    setFormData({ content: '', type: 'info', dismissible: true, startsAt: null, endsAt: null })
  }

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
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showCreateForm ? 'Cancel' : 'Create Announcement'}
            </button>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  {editingId ? 'Edit Announcement' : 'Create New Announcement'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                    Content (Markdown supported) *
                  </label>
                  <textarea
                    id="content"
                    required
                    rows={3}
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter announcement content..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                      Type
                    </label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-6">
                    <input
                      type="checkbox"
                      id="dismissible"
                      checked={formData.dismissible}
                      onChange={e => setFormData(prev => ({ ...prev, dismissible: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="dismissible" className="ml-2 block text-sm text-gray-700">
                      User can dismiss
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startsAt" className="block text-sm font-medium text-gray-700">
                      Start Date (optional)
                    </label>
                    <input
                      type="datetime-local"
                      id="startsAt"
                      value={formData.startsAt || ''}
                      onChange={e => setFormData(prev => ({ ...prev, startsAt: e.target.value || null }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="endsAt" className="block text-sm font-medium text-gray-700">
                      End Date (optional)
                    </label>
                    <input
                      type="datetime-local"
                      id="endsAt"
                      value={formData.endsAt || ''}
                      onChange={e => setFormData(prev => ({ ...prev, endsAt: e.target.value || null }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                {(createMutation.isError || updateMutation.isError) && (
                  <p className="text-sm text-red-600">
                    {createMutation.error instanceof Error
                      ? createMutation.error.message
                      : updateMutation.error instanceof Error
                      ? updateMutation.error.message
                      : 'An error occurred'}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {(createMutation.isPending || updateMutation.isPending)
                      ? 'Saving...'
                      : editingId
                      ? 'Update Announcement'
                      : 'Create Announcement'}
                  </button>
                </div>
              </form>
            </div>
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
