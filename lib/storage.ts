// lib/storage.ts
//
// Unified file storage abstraction. Provides the same API as `lib/s3.ts`
// (generateUploadUrl, generateDownloadUrl, deleteFile) but with automatic
// fallback to local-disk storage when S3 env vars are not configured.
//
// Storage modes (auto-detected at call time):
//   1. S3 / R2 / MinIO — when S3_BUCKET_NAME + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY
//      are all set in process.env
//   2. Local disk — fallback; writes to `./uploads/` directory
//
// Switching from local to S3 in production: just set the env vars and
// the same code path returns S3 presigned URLs automatically. No code
// change required in calling components.
//
// Local-mode behavior:
//   - generateUploadUrl: returns a relative URL pointing to
//     /api/files/local-upload (handles multipart upload + saves to disk)
//   - generateDownloadUrl: returns a relative URL pointing to
//     /api/files/[fileId]/download (streams from disk)
//   - deleteFile: removes the file from disk

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import path from 'path'
import { promises as fs } from 'fs'

/** True when all required S3 env vars are present. */
export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET_NAME &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  )
}

/** Current storage mode for diagnostics. */
export function getStorageMode(): 's3' | 'local' {
  return isS3Configured() ? 's3' : 'local'
}

// ─── S3 client singleton ────────────────────────────────────────────────────

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      endpoint: process.env.S3_ENDPOINT, // For Cloudflare R2, MinIO
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    })
  }
  return s3Client
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate an upload URL (S3 presigned) OR a local-upload URL
 * depending on the storage mode. Callers do not need to branch.
 *
 * @param storageKey - Logical path of the file, e.g. "projects/cmo.../design.pdf"
 * @param contentType - MIME type
 * @param expiresIn - Seconds before the URL expires (default 1 hour)
 * @returns A URL the client can POST/PUT the file to
 */
export async function generateUploadUrl(
  storageKey: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  if (isS3Configured()) {
    const client = getS3Client()
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: storageKey,
      ContentType: contentType,
    })
    return getSignedUrl(client, command, { expiresIn })
  }

  // Local mode — return a URL pointing to our own upload endpoint.
  // The actual file content will be posted as multipart/form-data to
  // /api/files/local-upload, which validates + writes to disk.
  // We sign the storageKey in the URL so the receiver knows where to
  // write the file.
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'
  return `${base}/api/files/local-upload?key=${encodeURIComponent(storageKey)}`
}

/**
 * Generate a download URL (S3 presigned) OR a local file-stream URL.
 */
export async function generateDownloadUrl(
  storageKey: string,
  expiresIn = 3600,
): Promise<string> {
  if (isS3Configured()) {
    const client = getS3Client()
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: storageKey,
    })
    return getSignedUrl(client, command, { expiresIn })
  }

  // Local mode — return a URL pointing to our own download endpoint.
  // The receiver reads the file from ./uploads/<storageKey> and streams
  // it back to the client.
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'
  return `${base}/api/files/local-download?key=${encodeURIComponent(storageKey)}`
}

/**
 * Delete a file. No-op if the file does not exist.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  if (isS3Configured()) {
    const client = getS3Client()
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: storageKey,
    })
    await client.send(command)
    return
  }

  // Local mode — remove the file from ./uploads/
  const filePath = getLocalFilePath(storageKey)
  try {
    await fs.unlink(filePath)
  } catch (err) {
    // ENOENT (file not found) is fine — treat as already deleted
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }
}

// ─── Local-mode helpers ─────────────────────────────────────────────────────

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads')

/** Resolve a storage key to a local file path. Validates against path traversal. */
export function getLocalFilePath(storageKey: string): string {
  const normalized = path.normalize(storageKey)
  if (!normalized.startsWith('projects/') || normalized.includes('..')) {
    throw new Error('Invalid storage key')
  }
  return path.join(UPLOAD_ROOT, normalized)
}

/** Ensure the parent directory for a storage key exists. */
export async function ensureLocalDir(storageKey: string): Promise<string> {
  const filePath = getLocalFilePath(storageKey)
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  return filePath
}
