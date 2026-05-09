import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().min(1),
  projectId: z.string().optional(),
  types: z.array(z.enum(['wiki', 'forum', 'document', 'meeting', 'work_package'])).optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const params = req.method === 'POST'
      ? searchSchema.safeParse(req.body)
      : searchSchema.safeParse(req.query)

    if (!params.success) {
      return res.status(400).json({ error: 'Validation failed', details: params.error.flatten() })
    }

    const { q, projectId, types, limit, offset } = params.data
    const query = q.trim()
    const typeFilters = types ?? ['wiki', 'forum', 'document', 'meeting', 'work_package']
    const results: unknown[] = []
    let total = 0

    // Build project filter
    const projectFilter = projectId ? { projectId } : {}

    // Search wiki pages
    if (typeFilters.includes('wiki')) {
      const wikiResults = await prisma.wikiPage.findMany({
        where: {
          ...projectFilter,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: { select: { id: true, name: true, identifier: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      })

      for (const page of wikiResults) {
        results.push({
          id: page.id,
          type: 'wiki',
          title: page.title,
          summary: page.content.substring(0, 200),
          projectId: page.projectId,
          projectName: page.project.name,
          url: `/projects/${page.project.identifier}/wiki/${page.slug}`,
          updatedAt: page.updatedAt,
        })
      }
    }

    // Search forum threads
    if (typeFilters.includes('forum')) {
      const forumResults = await prisma.forumThread.findMany({
        where: {
          ...projectFilter,
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { forum: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: {
          forum: { include: { project: { select: { id: true, name: true, identifier: true } } } },
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      })

      for (const thread of forumResults) {
        results.push({
          id: thread.id,
          type: 'forum',
          title: thread.subject,
          summary: null,
          projectId: thread.forum.projectId,
          projectName: thread.forum.project.name,
          url: `/forums/${thread.forumId}/threads/${thread.id}`,
          updatedAt: thread.updatedAt,
        })
      }
    }

    // Search documents
    if (typeFilters.includes('document')) {
      const docResults = await prisma.document.findMany({
        where: {
          ...projectFilter,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: { select: { id: true, name: true, identifier: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      })

      for (const doc of docResults) {
        results.push({
          id: doc.id,
          type: 'document',
          title: doc.title,
          summary: doc.description,
          projectId: doc.projectId,
          projectName: doc.project.name,
          url: `/documents/${doc.id}`,
          updatedAt: doc.updatedAt,
        })
      }
    }

    // Search meetings
    if (typeFilters.includes('meeting')) {
      const meetingResults = await prisma.meeting.findMany({
        where: {
          ...projectFilter,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: { select: { id: true, name: true, identifier: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      })

      for (const meeting of meetingResults) {
        results.push({
          id: meeting.id,
          type: 'meeting',
          title: meeting.title,
          summary: meeting.location ?? null,
          projectId: meeting.projectId,
          projectName: meeting.project.name,
          url: `/meetings/${meeting.id}`,
          updatedAt: meeting.updatedAt,
        })
      }
    }

    // Search work packages
    if (typeFilters.includes('work_package')) {
      const wpResults = await prisma.workPackage.findMany({
        where: {
          ...projectFilter,
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          project: { select: { id: true, name: true, identifier: true } },
          type: { select: { id: true, name: true, color: true } },
          status: { select: { id: true, name: true, color: true } },
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      })

      for (const wp of wpResults) {
        results.push({
          id: wp.id,
          type: 'work_package',
          title: wp.subject,
          summary: wp.description?.substring(0, 200) ?? null,
          projectId: wp.projectId,
          projectName: wp.project.name,
          url: `/work-packages/${wp.id}`,
          updatedAt: wp.updatedAt,
        })
      }
    }

    // Sort all results by updatedAt
    results.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    // Apply pagination to combined results
    const paginatedResults = results.slice(offset, offset + limit)
    total = results.length

    return res.status(200).json({
      query,
      results: paginatedResults,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error searching:', error)
    return res.status(500).json({ error: 'Search failed' })
  }
}
