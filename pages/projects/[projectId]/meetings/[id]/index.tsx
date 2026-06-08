export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { MeetingDetailHeader } from '@/components/meetings/MeetingDetailHeader'
import { MeetingParticipantList } from '@/components/meetings/MeetingParticipantList'
import { MeetingAgendaTab } from '@/components/meetings/MeetingAgendaTab'
import { MeetingMinutesTab } from '@/components/meetings/MeetingMinutesTab'
import { useMeeting, useMeetings } from '@/hooks/useMeetings'
import {
  useUpdateMeeting,
  useDeleteMeeting,
  useCreateMinutes,
  useUpdateMinutes,
  useCreateAgendaItem,
  useUpdateAgendaItem,
  useDeleteAgendaItem,
  MeetingApiError,
} from '@/hooks/useMeetingMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDateTime } from '@/lib/utils'

export default function MeetingDetailPage() {
  const router = useRouter()
  const { projectId, id } = router.query

  const [activeTab, setActiveTab] = useState('overview')

  const { data, isLoading, error } = useMeeting(projectId as string | undefined, id as string | undefined)
  const { data: projectMeetings } = useMeetings(projectId as string | undefined)
  const deleteMeeting = useDeleteMeeting()
  const createMinutes = useCreateMinutes()
  const updateMinutes = useUpdateMinutes()
  const createAgendaItem = useCreateAgendaItem()
  const updateAgendaItem = useUpdateAgendaItem()
  const deleteAgendaItem = useDeleteAgendaItem()
  const { user: currentUser } = useCurrentUser()

  const meeting = data

  // Phase 7 Sprint B-2: surface 401/403/404 distinctly so users see a real
  // explanation instead of "Failed to load meeting. Please try again."
  const accessDenied =
    error instanceof MeetingApiError &&
    (error.status === 401 || error.status === 403 || error.status === 404)

  const handleDelete = async () => {
    if (!projectId || !id || !confirm('Are you sure you want to delete this meeting?')) {
      return
    }

    try {
      await deleteMeeting.mutateAsync(id as string)
      router.push(`/projects/${projectId}/meetings`)
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      const msg =
        err instanceof MeetingApiError
          ? err.message
          : 'Failed to delete meeting. Please try again.'
      alert(msg)
    }
  }

  const handleEdit = () => {
    router.push(`/projects/${projectId}/meetings/${id}/edit`)
  }

  // Determine if user can edit/delete
  const isAuthor = currentUser?.id === meeting?.authorId
  const isAdmin = currentUser?.isSystemAdmin ?? false
  const canModify = isAuthor || isAdmin

  // Sprint B-2: minutes save handler. Creates on first save, patches on update.
  const meetingId = typeof id === 'string' ? id : undefined
  const handleSaveMinutes = async (content: string) => {
    if (!meetingId) return
    if (meeting?.minutes) {
      await updateMinutes.mutateAsync({ meetingId, data: { content } })
    } else {
      await createMinutes.mutateAsync({ meetingId, data: { content } })
    }
  }

  // Sprint B-2: agenda CRUD handlers. Each invalidates the meeting query
  // (handled in the mutation hooks) which refetches and gives us fresh
  // agenda + minutes + attendees in one shot.
  const handleCreateAgendaItem = async (input: { title: string; notes?: string; duration?: number; position?: number }) => {
    if (!meetingId) return
    await createAgendaItem.mutateAsync({
      meetingId,
      data: {
        title: input.title,
        notes: input.notes,
        duration: input.duration,
        position: input.position ?? (meeting?.agenda?.length ?? 0),
      },
    })
  }

  const handleUpdateAgendaItem = async (
    agendaId: string,
    input: { title?: string; notes?: string | null; duration?: number | null; position?: number }
  ) => {
    if (!meetingId) return
    await updateAgendaItem.mutateAsync({ meetingId, agendaId, data: input })
  }

  const handleDeleteAgendaItem = async (agendaId: string) => {
    if (!meetingId || !confirm('Delete this agenda item?')) return
    await deleteAgendaItem.mutateAsync({ meetingId, agendaId })
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

  if (accessDenied) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link
              href={`/projects/${projectId}/meetings`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Meetings
            </Link>
          </div>
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">
              {(error as MeetingApiError).status === 404
                ? 'Meeting not found'
                : "You don't have access to this meeting"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {(error as MeetingApiError).message}
            </p>
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (error || !meeting) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-5xl mx-auto">
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <MeetingDetailHeader
          meeting={meeting}
          onEdit={canModify ? handleEdit : undefined}
          onDelete={canModify ? handleDelete : undefined}
          isLoading={deleteMeeting.isPending}
        />

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="px-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="minutes">Minutes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Participants */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Participants
                  </h3>
                  <MeetingParticipantList attendees={meeting.attendees} />
                </div>

                {/* Meeting Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Details
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Start Time
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(meeting.startTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        End Time
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDateTime(meeting.endTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Location
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {meeting.location || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Project
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {meeting.project?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Agenda Tab */}
            <TabsContent value="agenda" className="px-6 pb-6">
              <MeetingAgendaTab
                agendaItems={meeting.agenda}
                canModify={canModify}
                onCreate={handleCreateAgendaItem}
                onUpdate={handleUpdateAgendaItem}
                onDelete={handleDeleteAgendaItem}
              />
            </TabsContent>

            {/* Minutes Tab */}
            <TabsContent value="minutes" className="px-6 pb-6">
              <MeetingMinutesTab
                minutes={meeting.minutes}
                onSave={canModify ? handleSaveMinutes : undefined}
                isLoading={createMinutes.isPending || updateMinutes.isPending}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
