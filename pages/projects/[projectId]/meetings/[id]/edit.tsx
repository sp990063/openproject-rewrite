export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMeeting } from '@/hooks/useMeetings'
import { useUpdateMeeting } from '@/hooks/useMeetingMutations'
import { formatDateTime } from '@/lib/utils'

interface MeetingFormData {
  title: string
  startTime: string
  endTime: string
  location: string
}

export default function EditMeetingPage() {
  const router = useRouter()
  const { projectId, id } = router.query

  const { data, isLoading, error } = useMeeting(id as string | undefined)
  const updateMeeting = useUpdateMeeting()

  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    startTime: '',
    endTime: '',
    location: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const meeting = data

  useEffect(() => {
    if (meeting) {
      const startDate = new Date(meeting.startTime)
      const endDate = new Date(meeting.endTime)

      setFormData({
        title: meeting.title || '',
        startTime: startDate.toISOString().slice(0, 16),
        endTime: endDate.toISOString().slice(0, 16),
        location: meeting.location || '',
      })
    }
  }, [meeting])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required'
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required'
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime)
      const end = new Date(formData.endTime)
      if (end <= start) {
        newErrors.endTime = 'End time must be after start time'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !id) return

    setIsSaving(true)
    try {
      await updateMeeting.mutateAsync({
        id: id as string,
        data: {
          title: formData.title,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          location: formData.location || null,
        },
      })
      router.push(`/projects/${projectId}/meetings/${id}`)
    } catch (err) {
      console.error('Failed to update meeting:', err)
      setErrors({ form: 'Failed to update meeting. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  if (!projectId || !id) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (error || !meeting) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link
              href={`/projects/${projectId}/meetings`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Meetings
            </Link>
          </div>
          <div className="text-center py-12 text-red-500">
            Failed to load meeting. Please try again.
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}/meetings/${id}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Meeting
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Meeting</h1>

          {errors.form && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Sprint Planning, Design Review"
                error={errors.title}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  error={errors.startTime}
                />
                {errors.startTime && (
                  <p className="mt-1 text-sm text-red-500">{errors.startTime}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  error={errors.endTime}
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-500">{errors.endTime}</p>
                )}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <Input
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Room 101, Video Call, etc."
              />
            </div>

            {/* Current meeting info */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p>
                <span className="font-medium">Created:</span>{' '}
                {formatDateTime(meeting.createdAt)}
              </p>
              <p>
                <span className="font-medium">Organized by:</span>{' '}
                {meeting.author?.name || 'Unknown'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
