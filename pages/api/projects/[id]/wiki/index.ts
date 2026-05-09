import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/markdown';

const CreateWikiPageSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().default(''),
  parentId: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  if (req.method === 'GET') {
    const pages = await prisma.wikiPage.findMany({
      where: { projectId: id, parentId: null },
      include: {
        author: { select: { id: true, name: true } },
        children: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { title: 'asc' },
    });

    const pagesWithCount = await Promise.all(
      pages.map(async (page) => {
        const versionCount = await prisma.wikiPageVersion.count({
          where: { wikiPageId: page.id },
        });
        return { ...page, versionCount };
      })
    );

    return res.json(pagesWithCount);
  }

  if (req.method === 'POST') {
    const parsed = CreateWikiPageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
    }

    const slug = generateSlug(parsed.data.title);

    // Check slug uniqueness within project
    const existing = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId: id, slug } },
    });

    if (existing) {
      return res.status(409).json({ error: 'A wiki page with this title already exists' });
    }

    const page = await prisma.wikiPage.create({
      data: {
        projectId: id,
        title: parsed.data.title,
        slug,
        content: parsed.data.content,
        parentId: parsed.data.parentId ?? null,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(page);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
