import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCommits } from '@/lib/vcs/git'

// GET /api/projects/[projectId]/repository/[repoId]/commits - Get commits for a repository
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, repoId } = req.query

  if (req.method === 'GET') {
    const { limit = '50' } = req.query
    const limitNum = parseInt(limit as string, 10)

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

    // Get commits from git
    const gitCommits = getCommits(repository.localPath, limitNum)

    // Upsert commits in DB and return with IDs
    const commits = await Promise.all(
      gitCommits.map(async (gitCommit) => {
        const commit = await prisma.commit.upsert({
          where: { sha: gitCommit.sha },
          update: {
            message: gitCommit.message,
            authorName: gitCommit.authorName,
            authorEmail: gitCommit.authorEmail,
            committedAt: gitCommit.committedAt,
          },
          create: {
            repositoryId: repository.id,
            sha: gitCommit.sha,
            message: gitCommit.message,
            authorName: gitCommit.authorName,
            authorEmail: gitCommit.authorEmail,
            committedAt: gitCommit.committedAt,
          },
        })
        return commit
      })
    )

    return res.json({ commits })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}