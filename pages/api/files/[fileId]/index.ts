// pages/api/files/[fileId]/index.ts
// Phase 6: File metadata GET and DELETE operations
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { deleteFile } from '@/lib/s3';
import { assertProjectMembership } from '@/lib/auth/project';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore - next-auth types are complex
  const session = await getServerSession(req, res, authOptions);
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

  // Phase 3 Sprint 2 (RBAC-16 high): gate GET to project members (or
  // uploader, or system admin). Previously the GET branch returned the
  // full file metadata to any authenticated user. Mirror the existing
  // DELETE logic so both methods share the same access control.
  const isUploader = file.uploadedById === session.user.id;
  const isAdmin = !!session.user.isSystemAdmin;
  if (!isUploader && !isAdmin) {
    // Throws 403 FORBIDDEN if not a member; 404 if project doesn't exist.
    // Both DELETE and GET now route through this check.
    await assertProjectMembership(file.projectId, session.user.id, isAdmin);
  }

  // DELETE: 刪除檔案
  if (req.method === 'DELETE') {
    if (!isUploader) {
      // Phase 3 Sprint 2 (RBAC-17 high): use a role-permissions check via
      // the membership helper instead of string-comparing role.name ===
      // 'Admin'. The hardcoded string check (line 37 in the original)
      // bypassed the wildcard-aware permission system and broke for
      // custom roles with '*' wildcard permissions. We still treat the
      // uploader as authorized (already checked above).
      // assertProjectMembership above already verified project membership;
      // for DELETE we additionally require Admin role (not just any
      // membership). Re-fetch role to make the decision.
      const membership = await prisma.member.findUnique({
        where: { userId_projectId: { userId: session.user.id, projectId: file.projectId } },
        include: { role: true },
      });
      const rolePerms = membership?.role?.permissions ?? [];
      const hasAdminPerm = rolePerms.includes('*') || rolePerms.includes('files.delete') || membership?.role?.name === 'Admin';
      if (!hasAdminPerm) {
        return res.status(403).json(errorResponse('FORBIDDEN', 'Admin role required to delete files'));
      }
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
