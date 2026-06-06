// pages/api/files/local-download.ts
//
// Local-mode download endpoint. Streams a file from ./uploads/<storageKey>
// to the client. Used by the local-disk fallback in `lib/storage.ts` when
// S3 env vars are not configured.
//
// Authentication: the caller must be a project member OR the uploader
// (we look up the ProjectFile by storageKey via the leading projectId
// in the key path "projects/<projectId>/...").
//
// NOT a presigned-URL endpoint — this one streams the bytes directly
// (Phase 6 S3 endpoints return presigned URLs; local fallback can't
// do that without an actual S3 backend).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLocalFilePath } from '@/lib/storage'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
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

  const isUploader = await prisma.projectFile.findFirst({
    where: { storageKey: key, uploadedById: session.user.id },
    select: { id: true },
  })
  const membership = await prisma.member.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { id: true },
  })
  if (!isUploader && !membership) {
    return res.status(403).json({ error: 'FORBIDDEN' })
  }

  let filePath: string
  try {
    filePath = getLocalFilePath(key)
  } catch {
    return res.status(400).json({ error: 'INVALID_KEY' })
  }

  try {
    const info = await stat(filePath)
    res.setHeader('Content-Length', info.size)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key.split('/').pop() ?? 'download'}"`,
    )
    const nodeStream = createReadStream(filePath)
    // Cast Node Readable to Web ReadableStream for Next.js response
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream
    return res.status(200).send(webStream as never)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return res.status(404).json({ error: 'FILE_NOT_FOUND' })
    }
    console.error('[local-download] failed:', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
}
