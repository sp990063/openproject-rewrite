import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


const VALID_SUBJECT_TYPES = [
  'work_package',
  'wiki_page',
  'forum_post',
  'document',
  'meeting',
  'news',
  'time_entry',
  'member',
  'version',
] as const

type SubjectType = typeof VALID_SUBJECT_TYPES[number]

interface ActivityItem {
  id: string
  projectId: string
  userId: string
  subjectType: string
  subjectId: string
  action: string
  details: unknown
  mentionIds: string[]
  reference: unknown
  isArchived: boolean
  createdAt: Date
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  comments: Array<{
    id: string
    userId: string
    content: string
    createdAt: Date
    author: {
      id: string
      name: string
      avatarUrl: string | null
    }
  }>
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Project membership check
  const membership = await prisma.member.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  })

  if (!membership) {
    return res.status(403).json({ error: 'Forbidden: not a project member' })
  }

  if (req.method === 'GET') {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const skip = (page - 1) * limit

    // Parse filter (subjectTypes)
    let subjectTypes: SubjectType[] = []
    if (req.query.filter && typeof req.query.filter === 'string') {
      const filterValues = req.query.filter.split(',').map((f) => f.trim())
      subjectTypes = filterValues.filter((f): f is SubjectType =>
        VALID_SUBJECT_TYPES.includes(f as SubjectType)
      )
    }

    // Parse includeArchived (default false)
    const includeArchived = req.query.includeArchived === 'true'

    // Build where clause
    const where: Parameters<typeof prisma.activity.findMany>[0]['where'] = {
      projectId,
    }

    if (!includeArchived) {
      where.isArchived = false
    }

    if (subjectTypes.length > 0) {
      where.subjectType = { in: subjectTypes }
    }

    // Fetch total count (ungrouped) for pagination
    const total = await prisma.activity.count({ where })

    // Fetch raw activities ordered by createdAt desc
    const rawActivities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Group activities: within 5 minutes of each other with same (subjectType, subjectId, userId)
    // aggregate them — we keep the first (newest) activity and merge details/comments
    const FIVE_MINUTES_MS = 5 * 60 * 1000

    const activities: ActivityItem[] = []
    let lastGroupKey: string | null = null
    let lastGroupCreatedAt: Date | null = null

    for (const activity of rawActivities) {
      const groupKey = `${activity.subjectType}:${activity.subjectId}:${activity.userId}`
      const isSameGroup =
        lastGroupKey === groupKey &&
        lastGroupCreatedAt !== null &&
        activity.createdAt.getTime() - lastGroupCreatedAt.getTime() <= FIVE_MINUTES_MS

      if (isSameGroup && activities.length > 0) {
        // Merge into the previous activity
        const last = activities[activities.length - 1]
        // Merge details arrays
        if (activity.details && Array.isArray(activity.details)) {
          last.details = [...(Array.isArray(last.details) ? last.details : []), activity.details]
        }
        // Merge mentionIds
        if (activity.mentionIds.length > 0) {
          last.mentionIds = Array.from(new Set([...last.mentionIds, ...activity.mentionIds]))
        }
        // Merge comments
        for (const comment of activity.comments) {
          last.comments.push({
            id: comment.id,
            userId: comment.userId,
            content: comment.content,
            createdAt: comment.createdAt,
            author: comment.author,
          })
        }
      } else {
        // New group item
        activities.push({
          id: activity.id,
          projectId: activity.projectId,
          userId: activity.userId,
          subjectType: activity.subjectType,
          subjectId: activity.subjectId,
          action: activity.action,
          details: activity.details,
          mentionIds: activity.mentionIds,
          reference: activity.reference,
          isArchived: activity.isArchived,
          createdAt: activity.createdAt,
          user: activity.user,
          comments: activity.comments.map((c) => ({
            id: c.id,
            userId: c.userId,
            content: c.content,
            createdAt: c.createdAt,
            author: c.author,
          })),
        })

        lastGroupKey = groupKey
        lastGroupCreatedAt = activity.createdAt
      }
    }

    return res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
