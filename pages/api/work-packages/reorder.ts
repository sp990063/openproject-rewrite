import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

const reorderSchema = z.object({
  workPackageId: z.string().cuid(),
  position: z.number().int().min(0),
  groupBy: z.string().optional(),
  groupValue: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  if (process.env.NODE_ENV !== 'test') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  try {
    const { workPackageId, position: newPosition } = reorderSchema.parse(req.body)

    // Fetch current WP to get its current position
    const wp = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      select: { id: true, projectId: true, statusId: true, position: true },
    })
    if (!wp) {
      return res.status(404).json({ error: 'Work package not found' })
    }

    // No-op: already at target position
    if (wp.position === newPosition) {
      return res.status(200).json({ success: true })
    }

    const oldPosition = wp.position

    // Determine shift direction:
    // oldPos > newPos  → moving UP in list: shift items in [newPos, oldPos) by +1
    // oldPos < newPos  → moving DOWN in list: shift items in (oldPos, newPos] by -1
    await prisma.$transaction(async (tx) => {
      if (oldPosition > newPosition) {
        // Moving up: make room at newPosition by shifting intermediate items down
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: wp.statusId,
            position: { gte: newPosition, lt: oldPosition },
            id: { not: workPackageId },
          },
          data: { position: { increment: 1 } },
        })
      } else {
        // Moving down: make room at newPosition by shifting intermediate items up
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: wp.statusId,
            position: { gt: oldPosition, lte: newPosition },
            id: { not: workPackageId },
          },
          data: { position: { decrement: 1 } },
        })
      }

      // Place the moved item at its target position
      await tx.workPackage.update({
        where: { id: workPackageId },
        data: { position: newPosition },
      })
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error reordering work package:', error)
    return res.status(500).json({ error: 'Failed to reorder work package' })
  }
}
