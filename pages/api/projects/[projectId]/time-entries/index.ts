import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity } from '@/lib/activity'

const createTimeEntrySchema = z.object({
  workPackageId: z.string().min(1),
  hours: z.number().positive(),
  comment: z.string().optional(),
  spentOn: z.string(), // ISO date string
  userTimezone: z.string().optional().default('UTC'),
})

const updateTimeEntrySchema = z.object({
  hours: z.number().positive().optional(),
  comment: z.string().nullable().optional(),
  spentOn: z.string().optional(),
  userTimezone: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }

  // GET /api/projects/[projectId]/time-entries — list time entries for project
  if (req.method === 'GET') {
    const { from, to, userId } = req.query

    const where: Record<string, unknown> = {
      workPackage: { projectId },
      deletedAt: null,
    }

    if (userId) where.userId = userId as string

    if (from || to) {
      where.spentOn = {}
      if (from) (where.spentOn as Record<string, unknown>).gte = new Date(from as string)
      if (to) (where.spentOn as Record<string, unknown>).lte = new Date(to as string)
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true },
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { spentOn: 'desc' },
    })

    return res.json({ entries })
  }

  // POST /api/projects/[projectId]/time-entries — create time entry
  if (req.method === 'POST') {
    const parsed = createTimeEntrySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const { workPackageId, hours, comment, spentOn, userTimezone } = parsed.data

    // Verify work package belongs to this project
    const workPackage = await prisma.workPackage.findFirst({
      where: { id: workPackageId, projectId },
    })
    if (!workPackage) {
      return res.status(400).json({ error: 'Work package not found in this project' })
    }

    const entry = await prisma.timeEntry.create({
      data: {
        workPackageId,
        userId: session.user.id,
        hours,
        comment,
        spentOn: new Date(spentOn),
        userTimezone,
        status: 'pending',
      },
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true },
        },
        user: { select: { id: true, name: true } },
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'time_entry',
      subjectId: entry.id,
      action: 'created',
      reference: { type: 'time_entry', id: entry.id, subject: `${hours}h on ${workPackage.subject}` },
    })

    return res.status(201).json({ entry })
  }

  // DELETE /api/projects/[projectId]/time-entries — bulk delete or delete by query
  if (req.method === 'DELETE') {
    const { ids } = req.query
    if (!ids || typeof ids !== 'string') {
      return res.status(400).json({ error: 'Entry IDs required' })
    }

    const entryIds = ids.split(',').filter(Boolean)
    if (entryIds.length === 0) {
      return res.status(400).json({ error: 'Entry IDs required' })
    }

    // Verify entries belong to this project
    const entries = await prisma.timeEntry.findMany({
      where: {
        id: { in: entryIds },
        workPackage: { projectId },
        deletedAt: null,
      },
      include: {
        workPackage: { select: { subject: true } },
      },
    })

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No entries found' })
    }

    // Soft delete
    await prisma.timeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { deletedAt: new Date() },
    })

    // Emit activity for each deleted entry
    for (const entry of entries) {
      await emitActivity({
        projectId,
        userId: session.user.id,
        subjectType: 'time_entry',
        subjectId: entry.id,
        action: 'deleted',
        reference: { type: 'time_entry', id: entry.id, subject: `${entry.hours}h on ${entry.workPackage.subject}` },
      })
    }

    return res.json({ success: true, deleted: entries.length })
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
