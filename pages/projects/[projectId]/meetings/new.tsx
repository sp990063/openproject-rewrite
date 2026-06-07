export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateMeeting } from '@/hooks/useMeetingMutations'

interface MeetingFormData {
  title: string
  startTime: string
  endTime: string
  location: string
  attendeeIds: string
}

/**
 * /projects/[projectId]/meetings/new — create a new meeting
 *
 * Sprint 4 (Meetings) — fills the gap left by the pre-existing
 * list / detail / edit pages which had no new-meeting page.
 *
 * Mirrors the style of `[id]/edit.tsx` (useState + manual validate)
 * to stay consistent with the existing meetings UI.
 */
export default function NewMeetingPage() {
  const router = useRouter()
  const { projectId } = router.query

  const createMeeting = useCreateMeeting()

  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    startTime: '',
    endTime: '',
    location: '',
    attendeeIds: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
    setSubmitError(null)
    if (!validate() || !projectId) return

    setIsSaving(true)
    try {
      const attendeeIds = formData.attendeeIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const created = await createMeeting.mutateAsync({
        projectId: projectId as string,
        title: formData.title,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        location: formData.location || undefined,
        attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
        authorId: 'self', // API overwrites with session.user.id
      })
      // Navigate to the new meeting's detail page
      const newId = (created as { meeting?: { id: string }; id?: string })?.meeting?.id ??
        (created as { id?: string })?.id
      if (newId) {
        router.push(`/projects/${projectId}/meetings/${newId}`)
      } else {
        router.push(`/projects/${projectId}/meetings`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create meeting'
      setSubmitError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="p-6 text-gray-500">Loading…</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          <Link href={`/projects/${projectId}/meetings`} className="hover:underline">
            Meetings
          </Link>
          <span>/</span>
          <span className="text-gray-900">New meeting</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-6">New meeting</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Sprint planning"
              required
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="startTime">
                Start
              </label>
              <Input
                id="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
              {errors.startTime && <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="endTime">
                End
              </label>
              <Input
                id="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
              {errors.endTime && <p className="mt-1 text-sm text-red-600">{errors.endTime}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="location">
              Location
            </label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Conference room A / Zoom link"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="attendeeIds">
              Attendees (comma-separated user IDs)
            </label>
            <Input
              id="attendeeIds"
              value={formData.attendeeIds}
              onChange={(e) => setFormData({ ...formData, attendeeIds: e.target.value })}
              placeholder="user-1, user-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use the member picker in a future iteration. For now paste user IDs.
            </p>
          </div>

          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create meeting'}
            </Button>
            <Link href={`/projects/${projectId}/meetings`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  )
}
