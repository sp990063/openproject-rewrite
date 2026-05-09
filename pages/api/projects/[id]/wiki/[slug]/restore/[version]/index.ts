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

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const page = await prisma.wikiPage.findUnique({
    where: { projectId_slug: { projectId: id, slug } },
  });

  if (!page) {
    return res.status(404).json({ error: 'Wiki page not found' });
  }

  // Find the version to restore
  const targetVersion = await prisma.wikiPageVersion.findFirst({
    where: { wikiPageId: page.id, version: versionNum },
  });

  if (!targetVersion) {
    return res.status(404).json({ error: 'Version not found' });
  }

  // Restore: save current content as a version, then update page with old content
  let restored;
  await prisma.$transaction(async (tx) => {
    // Save current content as a new version
    await tx.wikiPageVersion.create({
      data: {
        wikiPageId: page.id,
        content: page.content,
        authorId: page.authorId,
        version: page.version,
      },
    });

    // Restore the old content
    restored = await tx.wikiPage.update({
      where: { id: page.id },
      data: {
        content: targetVersion.content,
        version: { increment: 1 },
      },
      include: { author: { select: { id: true, name: true } } },
    });
  });

  return res.json(restored);
}
