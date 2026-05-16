import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[projectId]/repository - List repositories for a project
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId } = req.query

  if (req.method === 'GET') {
    const repositories = await prisma.repository.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ repositories })
  }

  if (req.method === 'POST') {
    const { name, type, url, localPath } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })

    const repository = await prisma.repository.create({
      data: {
        name,
        type: type || 'GIT',
        url: url || null,
        localPath: localPath || null,
        projectId: projectId as string,
      },
    })
    return res.json({ repository })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}