import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { generateSlug } from '@/lib/markdown';

const UpdateWikiPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const rawProjectId = req.query['projectId'];
  const rawSlug = req.query['slug'];
  const projectId = typeof rawProjectId === 'string' ? rawProjectId : undefined;
  const slug = typeof rawSlug === 'string' ? rawSlug : undefined;

  if (!projectId || !slug) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'Invalid parameters' });
  }

  if (req.method === 'GET') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        parent: { select: { id: true, title: true, slug: true } },
        children: { select: { id: true, title: true, slug: true } },
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!page) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Wiki page not found' });
    }

    return res.json(page);
  }

  if (req.method === 'PUT') {
    const parsed = UpdateWikiPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() });
    }

    const currentPage = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });

    if (!currentPage) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Wiki page not found' });
    }

    if (parsed.data.title && parsed.data.title !== currentPage.title) {
      const newSlug = generateSlug(parsed.data.title);
      const existing = await prisma.wikiPage.findUnique({
        where: { projectId_slug: { projectId, slug: newSlug } },
      });
      if (existing && existing.id !== currentPage.id) {
        return res.status(409).json({ error: 'CONFLICT', message: 'A wiki page with this title already exists' });
      }
    }

    let updated;
    await prisma.$transaction(async (tx) => {
      // Create version record for current content (before overwriting)
      await tx.wikiPageVersion.create({
        data: {
          wikiPageId: currentPage.id,
          content: currentPage.content,
          authorId: session.user.id,
          version: currentPage.version,
        },
      });

      // Update page — optimistic lock: only succeeds if version unchanged
      updated = await tx.wikiPage.update({
        where: {
          id: currentPage.id,
          version: currentPage.version,
        },
        data: {
          ...parsed.data,
          version: { increment: 1 },
        },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });
    });

    if (!updated) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'The page was modified by another request. Please reload and try again.',
      });
    }

    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });

    if (!page) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Wiki page not found' });
    }

    await prisma.wikiPage.delete({
      where: { projectId_slug: { projectId, slug } },
    });

    return res.json({ deleted: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
}
