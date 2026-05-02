import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await auth()
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const userId = session.user.id

  if (req.method === 'GET') {
    const { projectId } = req.query
    const queries = await prisma.savedQuery.findMany({
      where: {
        userId,
        ...(projectId ? { projectId: String(projectId) } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
    return res.status(200).json(queries)
  }

  if (req.method === 'POST') {
    const { name, projectId, filters, sortBy, groupBy, displayMode, isDefault } = req.body

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

    // If isDefault=true, unset other defaults for this user/project first
    if (isDefault) {
      await prisma.savedQuery.updateMany({
        where: { userId, projectId: projectId ?? null },
        data: { isDefault: false },
      })
    }

    const query = await prisma.savedQuery.create({
      data: {
        userId,
        projectId: projectId ?? null,
        name: name.trim(),
        filters: filters ?? {},
        sortBy: sortBy ?? [],
        groupBy: groupBy ?? null,
        displayMode: displayMode ?? 'table',
        isDefault: isDefault ?? false,
      },
    })
    return res.status(201).json(query)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
