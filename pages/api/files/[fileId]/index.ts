// pages/api/files/[fileId]/index.ts
// Phase 6: File metadata GET and DELETE operations
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { deleteFile } from '@/lib/s3';

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

  // DELETE: 刪除檔案
  if (req.method === 'DELETE') {
    const isUploader = file.uploadedById === session.user.id;
    // 獲取成員及其角色（需select role）
    const membership = await prisma.member.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId: file.projectId } },
      include: { role: true },
    });

    // 可刪除者：上傳者、或有 Admin 角色的成員
    if (!isUploader && membership?.role?.name !== 'Admin') {
      return res.status(403).json(errorResponse('FORBIDDEN', 'Not authorized to delete this file'));
    }

    try {
      await deleteFile(file.storageKey);
    } catch (e) {
      console.error('[Files] S3 delete failed:', e);
      // 即使 S3 刪除失敗，仍繼續刪除資料庫記錄
    }

    await prisma.projectFile.delete({ where: { id: fileId } });
    return res.json(successResponse({ deleted: true }));
  }

  // GET: 返回檔案元數據
  if (req.method === 'GET') {
    return res.json(successResponse({ file }));
  }

  return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed'));
}
