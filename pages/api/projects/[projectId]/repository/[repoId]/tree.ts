import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTree } from '@/lib/vcs/git'

// GET /api/projects/[projectId]/repository/[repoId]/tree - Get file tree for a commit
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, repoId } = req.query
  const { sha = 'HEAD' } = req.query

  if (req.method === 'GET') {
    // Get the repository
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId as string,
        projectId: projectId as string,
      },
    })

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' })
    }

    if (!repository.localPath) {
      return res.status(400).json({ error: 'Repository has no local path configured' })
    }

    // Get tree from git
    const tree = getTree(repository.localPath, sha as string)

    return res.json({ tree })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}