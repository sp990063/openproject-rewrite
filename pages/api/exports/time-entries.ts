import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'You must be logged in' })
    }

    const { projectId, userId, from, to, format } = req.query

    // Build where clause
    const where: Record<string, unknown> = { deletedAt: null }

    if (userId) where.userId = userId as string
    if (projectId) {
      where.workPackage = { projectId: projectId as string }
    }

    // Date range filter
    if (from || to) {
      where.spentOn = {}
      if (from) (where.spentOn as Record<string, unknown>).gte = new Date(from as string)
      if (to) (where.spentOn as Record<string, unknown>).lte = new Date(to as string)
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true }
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { spentOn: 'desc' },
    })

    // Return based on format
    if (format === 'pdf') {
      // Calculate totals
      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
      const entriesWithStrings = entries.map((entry) => ({
        ...entry,
        spentOn: entry.spentOn.toISOString(),
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        deletedAt: entry.deletedAt?.toISOString() ?? null,
      }))

      return res.status(200).json({
        success: true,
        data: {
          entries: entriesWithStrings,
          summary: {
            totalEntries: entries.length,
            totalHours,
            period: from && to ? `${from} to ${to}` : 'All time',
          },
        },
      })
    }

    // Default: return JSON
    return res.status(200).json({
      success: true,
      data: {
        entries: entries.map((entry) => ({
          ...entry,
          spentOn: entry.spentOn.toISOString(),
          approvedAt: entry.approvedAt?.toISOString() ?? null,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
          deletedAt: entry.deletedAt?.toISOString() ?? null,
        })),
      },
    })
  } catch (error) {
    console.error('Error exporting time entries:', error)
    return res.status(500).json({ error: 'Failed to export time entries' })
  }
}
