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
import { useUpdateMeeting, useDeleteMeeting } from '@/hooks/useMeetingMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDateTime } from '@/lib/utils'

export default function MeetingDetailPage() {
  const router = useRouter()
  const { projectId, id } = router.query

  const [activeTab, setActiveTab] = useState('overview')

  const { data, isLoading, error } = useMeeting(projectId as string | undefined, id as string | undefined)
  const { data: projectMeetings } = useMeetings(projectId as string | undefined)
  const deleteMeeting = useDeleteMeeting()
  const { user: currentUser } = useCurrentUser()

  const meeting = data

  const handleDelete = async () => {
    if (!projectId || !id || !confirm('Are you sure you want to delete this meeting?')) {
      return
    }

    try {
      await deleteMeeting.mutateAsync(id as string)
      router.push(`/projects/${projectId}/meetings`)
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      alert('Failed to delete meeting. Please try again.')
    }
  }

  const handleEdit = () => {
    router.push(`/projects/${projectId}/meetings/${id}/edit`)
  }

  // Determine if user can edit/delete
  const isAuthor = currentUser?.id === meeting?.authorId
  const isAdmin = currentUser?.isSystemAdmin ?? false
  const canModify = isAuthor || isAdmin

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
              <MeetingAgendaTab agendaItems={meeting.agenda} />
            </TabsContent>

            {/* Minutes Tab */}
            <TabsContent value="minutes" className="px-6 pb-6">
              <MeetingMinutesTab minutes={meeting.minutes} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
