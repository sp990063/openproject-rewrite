// pages/api/files/local-upload.ts
//
// Local-mode upload endpoint. Receives a multipart/form-data POST,
// writes the file to ./uploads/<storageKey>, and returns the file
// metadata. Used by the local-disk fallback in `lib/storage.ts` when
// S3 env vars are not configured.
//
// Authentication: caller must be a project member of the project
// encoded in the storageKey path "projects/<projectId>/...".
//
// File size + content type limits match the S3-mode endpoint
// (MAX_FILE_SIZE from types/file-storage.ts).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import formidable from 'formidable'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureLocalDir } from '@/lib/storage'
import {
  isAllowedContentType,
  MAX_FILE_SIZE,
} from '@/types/file-storage'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { key } = req.query
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'MISSING_KEY' })
  }

  // Authorize: extract projectId from "projects/<projectId>/..."
  const projectIdMatch = key.match(/^projects\/([^/]+)\//)
  if (!projectIdMatch) {
    return res.status(400).json({ error: 'INVALID_KEY_FORMAT' })
  }
  const projectId = projectIdMatch[1]

  const membership = await prisma.member.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { id: true },
  })
  if (!membership) {
    return res.status(403).json({ error: 'FORBIDDEN' })
  }

  // Parse multipart form
  let filePath: string
  let fileSize = 0
  let contentType = ''
  let fileName = ''
  try {
    filePath = await ensureLocalDir(key)
  } catch {
    return res.status(400).json({ error: 'INVALID_KEY' })
  }

  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: false,
  })

  try {
    const [fields, files] = await form.parse(req)
    const file = Array.isArray(files.file) ? files.file[0] : files.file
    if (!file) {
      return res.status(400).json({ error: 'NO_FILE' })
    }
    fileName = file.originalFilename ?? 'upload'
    contentType = file.mimetype ?? 'application/octet-stream'
    fileSize = file.size

    if (!isAllowedContentType(contentType)) {
      return res.status(415).json({ error: 'UNSUPPORTED_CONTENT_TYPE' })
    }

    // Stream the formidable temp file to our destination
    const src = createReadStream(file.filepath)
    const dest = createWriteStream(filePath)
    await pipeline(src, dest)
  } catch (err) {
    console.error('[local-upload] failed:', err)
    return res.status(500).json({ error: 'UPLOAD_FAILED' })
  }

  return res.status(201).json({
    success: true,
    data: {
      storageKey: key,
      fileName,
      contentType,
      size: fileSize,
      uploadedById: session.user.id,
      projectId,
    },
  })
}
