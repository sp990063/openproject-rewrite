import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { FormField, FormSection, FormError } from '@/components/forms'
import { ParticipantGroup } from './ParticipantBadge'

export interface MeetingAttendeeInput {
  userId: string
  response: 'none' | 'accepted' | 'declined'
}

export interface MeetingFormData {
  title: string
  startTime: string
  endTime: string
  location: string
  attendeeIds: string[]
}

export interface MeetingFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MeetingFormData) => Promise<void>
  initialData?: Partial<MeetingFormData>
  projectMembers?: Array<{ id: string; name: string; email?: string; avatarUrl?: string | null }>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

// Zod schema (single source of truth for validation + types).
// Mirrors the validation behaviour of the previous useState-based form:
//   • title, startTime, endTime are required strings
//   • endTime must be strictly after startTime
//   • location is an optional string ('' is treated as "not set")
//   • attendeeIds is a string array
// Datetime-local inputs are always strings in the DOM, so we keep them as
// strings and validate the ordering with a top-level refine.
//
// We deliberately do NOT use `.default([])` on attendeeIds or
// `.optional()` on location in a way that would diverge the schema's input
// and output types — that breaks RHF's `Control<T, _, T>` variance.
const meetingFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    location: z.string(),
    attendeeIds: z.array(z.string()),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true
      const start = new Date(data.startTime)
      const end = new Date(data.endTime)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return true // let the min(1) checks above handle empty strings
      }
      return end > start
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )

type MeetingFormValues = z.infer<typeof meetingFormSchema>

function buildDefaultValues(initialData?: Partial<MeetingFormData>): MeetingFormValues {
  if (initialData) {
    return {
      title: initialData.title ?? '',
      startTime: initialData.startTime ?? '',
      endTime: initialData.endTime ?? '',
      location: initialData.location ?? '',
      attendeeIds: initialData.attendeeIds ?? [],
    }
  }
  // Default to tomorrow at 10:00 AM, 1 hour duration — matches the prior behaviour.
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  const endTime = new Date(tomorrow)
  endTime.setHours(11, 0, 0, 0)
  return {
    title: '',
    startTime: tomorrow.toISOString().slice(0, 16),
    endTime: endTime.toISOString().slice(0, 16),
    location: '',
    attendeeIds: [],
  }
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
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: buildDefaultValues(initialData),
    // Avoid showing errors on first render; only after the user submits or
    // changes a field — same UX as the previous manual-validate flow.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  // Reset form whenever the modal opens (mirrors the previous useEffect).
  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(initialData))
    }
  }, [open, initialData, reset])

  const submit = handleSubmit(async (values) => {
    // Preserve the previous onSubmit contract: convert local datetime strings
    // to ISO before handing them to the parent.
    await onSubmit({
      ...values,
      location: values.location ?? '',
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
    })
  })

  const toggleAttendee = (userId: string) => {
    const current = control._formValues.attendeeIds ?? []
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId]
    // Re-sync RHF state for the array field.
    reset(
      {
        ...(control._formValues as MeetingFormValues),
        attendeeIds: next,
      },
      { keepValues: true, keepDirty: true }
    )
  }

  const selectedAttendees = projectMembers.filter((m) =>
    (control._formValues.attendeeIds ?? []).includes(m.id)
  )

  // Build a list of issues for the top-of-form <FormError> summary. We only
  // surface this once the user has attempted to submit (matches the prior
  // behaviour where errors only appeared after clicking "Create Meeting").
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormSection
          title="Meeting details"
          description={mode === 'create' ? 'Create a new meeting and invite participants' : 'Update meeting details'}
        >
          {formErrorPayload && <FormError error={formErrorPayload} />}

          {/* Title */}
          <FormField
            control={control}
            name="title"
            label="Meeting Title"
            type="text"
            required
            placeholder="e.g., Sprint Planning, Design Review"
          />

          {/* Date/Time — FormField's typed enum does not include
              datetime-local, so we register these directly with the design
              system Input primitive. */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Time"
              required
              {...register('startTime')}
              error={errors.startTime?.message}
            />
            <Input
              type="datetime-local"
              label="End Time"
              required
              {...register('endTime')}
              error={errors.endTime?.message}
            />
          </div>

          {/* Location */}
          <FormField
            control={control}
            name="location"
            label="Location"
            type="text"
            placeholder="Room 101, Video Call, etc."
          />
        </FormSection>

        {/* Attendees (kept as a manual section — not a FormField — because the
            parent receives `attendeeIds: string[]` and we don't want to force
            a multi-select primitive here. Same UX as before. */}
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
            <MemberPicker
              members={projectMembers}
              selectedIds={control._formValues.attendeeIds ?? []}
              onToggle={toggleAttendee}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading || isSubmitting}
          >
            {mode === 'create' ? 'Create Meeting' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface MemberPickerProps {
  members: NonNullable<MeetingFormProps['projectMembers']>
  selectedIds: string[]
  onToggle: (userId: string) => void
}

function MemberPicker({ members, selectedIds, onToggle }: MemberPickerProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        {open ? 'Hide' : 'Show'} available participants
      </button>
      {open && (
        <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
          {members.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(member.id)}
                onChange={() => onToggle(member.id)}
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
  )
}
