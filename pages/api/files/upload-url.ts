// pages/api/files/upload-url.ts
// Phase 6: Generate pre-signed upload URL for project files
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateUploadUrl } from '@/lib/s3';
import { isAllowedContentType, MAX_FILE_SIZE } from '@/types/file-storage';
import path from 'path';

const UploadUrlSchema = z.object({
  projectId: z.string().cuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  size: z.number().optional(),
});

function validateStorageKey(storageKey: string): boolean {
  const normalized = path.normalize(storageKey);
  return normalized.startsWith('projects/') && !normalized.includes('..');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore - next-auth types are complex
  const session = await getServerSession(authOptions);
  if (!session) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'));
  }

  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed'));
  }

  const parsed = UploadUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input'));
  }

  const { projectId, filename, contentType, size } = parsed.data;

  // 檢查檔案大小
  if (size && size > MAX_FILE_SIZE) {
    return res.status(400).json(errorResponse('FILE_TOO_LARGE', `Max file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`));
  }

  // 檢查內容類型
  if (!isAllowedContentType(contentType)) {
    return res.status(400).json(errorResponse('INVALID_CONTENT_TYPE', 'File type not allowed'));
  }

  // 驗證用戶是項目成員
  const membership = await prisma.member.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  });
  if (!membership) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Not a project member'));
  }

  // 生成 storage key
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `projects/${projectId}/files/${Date.now()}-${safeFilename}`;

  if (!validateStorageKey(storageKey)) {
    return res.status(400).json(errorResponse('INVALID_STORAGE_KEY', 'Invalid storage key'));
  }

  try {
    const uploadUrl = await generateUploadUrl(storageKey, contentType);

    const file = await prisma.projectFile.create({
      data: {
        projectId,
        filename,
        storageKey,
        contentType,
        size: size ?? 0,
        uploadedById: session.user.id,
      },
    });

    return res.status(201).json(successResponse({
      fileId: file.id,
      uploadUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    }));
  } catch (e) {
    console.error('[Files] generateUploadUrl failed:', e);
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to generate upload URL'));
  }
}
