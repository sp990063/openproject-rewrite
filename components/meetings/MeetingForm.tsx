import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { ParticipantGroup } from './ParticipantBadge'
import type { AgendaItemInput } from './AgendaEditor'
import type { User } from '@/types'

interface MeetingAttendeeInput {
  userId: string
  response: 'none' | 'accepted' | 'declined'
}

interface MeetingFormData {
  title: string
  startTime: string
  endTime: string
  location: string
  attendeeIds: string[]
}

interface MeetingFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MeetingFormData) => Promise<void>
  initialData?: Partial<MeetingFormData>
  projectMembers?: Array<{ id: string; name: string; email?: string; avatarUrl?: string | null }>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

export function MeetingForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  projectMembers = [],
  isLoading = false,
  mode = 'create',
}: MeetingFormProps) {
  const [formData, setFormData] = useState<MeetingFormData>({
    title: '',
    startTime: '',
    endTime: '',
    location: '',
    attendeeIds: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showMemberPicker, setShowMemberPicker] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          startTime: initialData.startTime || '',
          endTime: initialData.endTime || '',
          location: initialData.location || '',
          attendeeIds: initialData.attendeeIds || [],
        })
      } else {
        // Default to tomorrow at 10:00 AM, 1 hour duration
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(10, 0, 0, 0)
        const endTime = new Date(tomorrow)
        endTime.setHours(11, 0, 0, 0)

        setFormData({
          title: '',
          startTime: tomorrow.toISOString().slice(0, 16),
          endTime: endTime.toISOString().slice(0, 16),
          location: '',
          attendeeIds: [],
        })
      }
      setErrors({})
    }
  }, [open, initialData])

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
    if (!validate()) return

    await onSubmit({
      ...formData,
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
    })
  }

  const toggleAttendee = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      attendeeIds: prev.attendeeIds.includes(userId)
        ? prev.attendeeIds.filter((id) => id !== userId)
        : [...prev.attendeeIds, userId],
    }))
  }

  const selectedAttendees = projectMembers.filter((m) =>
    formData.attendeeIds.includes(m.id)
  )

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Schedule Meeting' : 'Edit Meeting'}
      description={
        mode === 'create'
          ? 'Create a new meeting and invite participants'
          : 'Update meeting details'
      }
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Title *
          </label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              error={errors.startTime}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Time *
            </label>
            <Input
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Room 101, Video Call, etc."
          />
        </div>

        {/* Attendees */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Participants
          </label>
          <div className="border border-gray-200 rounded-lg p-3 min-h-[60px]">
            {selectedAttendees.length > 0 ? (
              <div className="flex items-center gap-2">
                <ParticipantGroup
                  attendees={selectedAttendees.map((u) => ({
                    id: u.id,
                    userId: u.id,
                    response: 'none' as const,
                    user: u,
                  }))}
                  size="sm"
                />
                <span className="text-sm text-gray-500 ml-2">
                  {selectedAttendees.length} selected
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No participants selected</p>
            )}
          </div>

          {projectMembers.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowMemberPicker(!showMemberPicker)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showMemberPicker ? 'Hide' : 'Show'} available participants
              </button>

              {showMemberPicker && (
                <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {projectMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.attendeeIds.includes(member.id)}
                        onChange={() => toggleAttendee(member.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{member.name}</span>
                      {member.email && (
                        <span className="text-xs text-gray-400">{member.email}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {mode === 'create' ? 'Create Meeting' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
