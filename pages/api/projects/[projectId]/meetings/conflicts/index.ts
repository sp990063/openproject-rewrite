/**
 * GET /api/projects/[projectId]/meetings/conflicts
 *
 * Check scheduling conflicts for a proposed meeting time slot.
 * Query: ?startTime=ISO&endTime=ISO&attendeeIds=id1,id2&excludeMeetingId=X
 *
 * Sprint 4 (Meetings) — exposes the pre-existing checkMeetingConflict helper
 * as a project-scoped endpoint so the new-meeting form can preview conflicts
 * before submission.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkMeetingConflict } from '@/lib/meeting-conflict'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { query } = req
  const projectId = query.projectId as string
  const startTimeStr = query.startTime as string
  const endTimeStr = query.endTime as string
  const attendeeIdsParam = (query.attendeeIds as string | undefined) ?? ''
  const excludeMeetingId = query.excludeMeetingId as string | undefined

  if (!projectId || !startTimeStr || !endTimeStr) {
    return res.status(400).json({
      error: 'projectId, startTime, and endTime are required',
    })
  }

  const startTime = new Date(startTimeStr)
  const endTime = new Date(endTimeStr)
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return res.status(400).json({ error: 'Invalid startTime or endTime' })
  }
  if (endTime <= startTime) {
    return res.status(400).json({ error: 'endTime must be after startTime' })
  }

  const attendeeIds = attendeeIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const result = await checkMeetingConflict({
      projectId,
      attendees: attendeeIds,
      startTime,
      endTime,
      excludeMeetingId,
    })
    return res.status(200).json(result)
  } catch (error) {
    console.error('Error checking meeting conflicts:', error)
    return res.status(500).json({ error: 'Failed to check conflicts' })
  }
}
