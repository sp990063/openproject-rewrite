import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCommit } from '@/lib/vcs/git'

// GET /api/projects/[projectId]/repository/[repoId]/commit/[sha] - Get a single commit
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, repoId, sha } = req.query

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

    // Get commit from git
    const gitCommit = getCommit(repository.localPath, sha as string)

    if (!gitCommit) {
      return res.status(404).json({ error: 'Commit not found' })
    }

    // Upsert in DB
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

    // Get linked work packages
    const linkedWPs = await prisma.commitWorkPackage.findMany({
      where: { commitId: commit.id },
      include: { workPackage: true },
    })

    return res.json({ commit, workPackages: linkedWPs.map(cwp => cwp.workPackage) })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}