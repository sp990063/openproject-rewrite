// pages/api/files/[fileId]/download.ts
// Phase 6: Generate pre-signed download URL for project file
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateDownloadUrl } from '@/lib/s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore - next-auth types are complex
  const session = await getServerSession(authOptions);
  if (!session) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'));
  }

  const { fileId } = req.query;
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json(errorResponse('INVALID_PARAMS', 'File ID required'));
  }

  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return res.status(404).json(errorResponse('NOT_FOUND', 'File not found'));
  }

  // 授權：上傳者或項目成員
  const isUploader = file.uploadedById === session.user.id;
  const membership = await prisma.member.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId: file.projectId } },
  });
  if (!isUploader && !membership) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Not authorized'));
  }

  try {
    const downloadUrl = await generateDownloadUrl(file.storageKey);
    return res.json(successResponse({ downloadUrl }));
  } catch (e) {
    console.error('[Files] generateDownloadUrl failed:', e);
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to generate download URL'));
  }
}
