import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePostSchema = z.object({
  content: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.postId as string

  if (!id) {
    return res.status(400).json({ error: 'Post ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getPost(req, res, id)
    case 'PATCH':
      return updatePost(req, res, id)
    case 'DELETE':
      return deletePost(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getPost(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        thread: {
          select: { id: true, subject: true, forum: { select: { id: true, name: true } } },
        },
      },
    })

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    return res.status(200).json(post)
  } catch (error) {
    console.error('Error fetching post:', error)
    return res.status(500).json({ error: 'Failed to fetch post' })
  }
}

async function updatePost(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updatePostSchema.parse(req.body)

    const existing = await prisma.forumPost.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const post = await prisma.forumPost.update({
      where: { id },
      data: { content: data.content },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        thread: { select: { id: true, subject: true } },
      },
    })

    return res.status(200).json(post)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating post:', error)
    return res.status(500).json({ error: 'Failed to update post' })
  }
}

async function deletePost(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const post = await prisma.forumPost.findUnique({ where: { id } })
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    await prisma.forumPost.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting post:', error)
    return res.status(500).json({ error: 'Failed to delete post' })
  }
}
