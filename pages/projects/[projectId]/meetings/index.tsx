export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { MeetingCard } from '@/components/meetings/MeetingCard'
import { MeetingForm } from '@/components/meetings/MeetingForm'
import { useMeetings } from '@/hooks/useMeetings'
import { useCreateMeeting } from '@/hooks/useMeetingMutations'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/Button'

export default function MeetingsListPage() {
  const router = useRouter()
  const { projectId } = router.query

  const [showCreateModal, setShowCreateModal] = useState(false)
  const { data: meetings, isLoading } = useMeetings(projectId as string | undefined)
  const createMeeting = useCreateMeeting()
  const { user: currentUser } = useCurrentUser()

  const handleCreateMeeting = async (data: {
    title: string
    startTime: string
    endTime: string
    location: string
    attendeeIds: string[]
  }) => {
    if (!projectId || !currentUser) return

    const meeting = await createMeeting.mutateAsync({
      projectId: projectId as string,
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      authorId: currentUser.id,
      attendeeIds: data.attendeeIds,
    })

    setShowCreateModal(false)
    router.push(`/projects/${projectId}/meetings/${meeting.id}`)
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Schedule and manage project meetings
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Meeting
          </Button>
        </div>

        {/* Meetings List */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading meetings...</div>
        ) : meetings && meetings.length > 0 ? (
          <div className="grid gap-4">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onClick={() => router.push(`/projects/${projectId}/meetings/${meeting.id}`)}
                onEdit={() => router.push(`/projects/${projectId}/meetings/${meeting.id}/edit`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">No meetings scheduled</p>
            <p className="text-sm text-gray-400 mt-1">
              Create a meeting to get started
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="mt-4"
            >
              Schedule Meeting
            </Button>
          </div>
        )}

        {/* Create Meeting Modal */}
        <MeetingForm
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSubmit={handleCreateMeeting}
          isLoading={createMeeting.isPending}
          mode="create"
        />
      </div>
    </AuthenticatedLayout>
  )
}
