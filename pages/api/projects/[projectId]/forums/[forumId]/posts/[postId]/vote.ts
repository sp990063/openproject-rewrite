import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId, forumId, postId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }
  if (!forumId || typeof forumId !== 'string') {
    return res.status(400).json({ error: 'INVALID_FORUM_ID' })
  }
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'INVALID_POST_ID' })
  }

  // Check project membership
  const membership = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
  })
  if (!membership) {
    return res.status(403).json({ error: 'FORBIDDEN' })
  }

  // Verify post exists and belongs to a thread in this forum
  const post = await prisma.forumPost.findFirst({
    where: {
      id: postId,
      thread: { forumId },
    },
    include: { thread: { select: { forumId: true } } },
  })
  if (!post) {
    return res.status(404).json({ error: 'POST_NOT_FOUND' })
  }

  // POST — toggle vote
  if (req.method === 'POST') {
    // Check if user already voted
    const existingVote = await prisma.forumVote.findUnique({
      where: {
        postId_userId: { postId, userId: session.user.id },
      },
    })

    let voteScore: number

    if (existingVote) {
      // Remove vote (toggle off)
      await prisma.forumVote.delete({
        where: { id: existingVote.id },
      })
      voteScore = post.voteScore - 1
    } else {
      // Add vote (toggle on)
      await prisma.forumVote.create({
        data: { postId, userId: session.user.id },
      })
      voteScore = post.voteScore + 1
    }

    // Update post vote score
    const updatedPost = await prisma.forumPost.update({
      where: { id: postId },
      data: { voteScore },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        votes: { where: { userId: session.user.id } },
      },
    })

    const hasVoted = updatedPost.votes.length > 0

    return res.status(200).json({ post: updatedPost, hasVoted, voteScore })
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
