import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(401).json({ error: 'Unauthorized' });

  const { id, slug, version } = req.query;
  if (!id || typeof id !== 'string' || !slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  const versionNum = parseInt(version as string, 10);
  if (isNaN(versionNum)) {
    return res.status(400).json({ error: 'Invalid version number' });
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

  const versionRecord = await prisma.wikiPageVersion.findFirst({
    where: { wikiPageId: page.id, version: versionNum },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  if (!versionRecord) {
    return res.status(404).json({ error: 'Version not found' });
  }

  return res.json(versionRecord);
}
