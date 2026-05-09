import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(401).json({ error: 'Unauthorized' });

  const { id, slug } = req.query;
  if (!id || typeof id !== 'string' || !slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const page = await prisma.wikiPage.findUnique({
    where: { projectId_slug: { projectId: id, slug } },
  });

  if (!page) {
    return res.status(404).json({ error: 'Wiki page not found' });
  }

  const versions = await prisma.wikiPageVersion.findMany({
    where: { wikiPageId: page.id },
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { version: 'desc' },
  });

  return res.json(versions);
}
