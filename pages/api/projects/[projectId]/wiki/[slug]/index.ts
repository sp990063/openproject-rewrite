import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/markdown';

const UpdateWikiPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.query['id'];
  const rawSlug = req.query['slug'];
  const id = typeof rawId === 'string' ? rawId : undefined;
  const slug = typeof rawSlug === 'string' ? rawSlug : undefined;

  if (!id || !slug) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  if (req.method === 'GET') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId: id, slug } },
      include: {
        author: { select: { id: true, name: true } },
        parent: true,
        children: { select: { id: true, title: true, slug: true } },
        _count: { select: { versions: true } },
      },
    });

    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' });
    }

    return res.json({ ...page, versionCount: page._count.versions });
  }

  if (req.method === 'PATCH') {
    const parsed = UpdateWikiPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const currentPage = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId: id, slug } },
    });

    if (!currentPage) {
      return res.status(404).json({ error: 'Wiki page not found' });
    }

    if (parsed.data.title && parsed.data.title !== currentPage.title) {
      const newSlug = generateSlug(parsed.data.title);
      const existing = await prisma.wikiPage.findUnique({
        where: { projectId_slug: { projectId: id, slug: newSlug } },
      });
      if (existing && existing.id !== currentPage.id) {
        return res.status(409).json({ error: 'A wiki page with this title already exists' });
      }
    }

    let updated;
    await prisma.$transaction(async (tx) => {
      await tx.wikiPageVersion.create({
        data: {
          wikiPageId: currentPage.id,
          content: currentPage.content,
          authorId: currentPage.authorId,
          version: currentPage.version,
        },
      });

      updated = await tx.wikiPage.update({
        where: {
          id: currentPage.id,
          version: currentPage.version,
        },
        data: {
          ...parsed.data,
          version: { increment: 1 },
        },
        include: { author: { select: { id: true, name: true } } },
      });
    });

    if (!updated) {
      return res.status(409).json({
        error: 'The page was modified by another request. Please reload and try again.',
      });
    }

    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId: id, slug } },
    });

    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' });
    }

    await prisma.wikiPage.delete({
      where: { projectId_slug: { projectId: id, slug } },
    });

    return res.json({ deleted: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
