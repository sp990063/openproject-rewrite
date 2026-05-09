// lib/s3.ts
// Phase 6: S3-compatible file storage utilities
// Supports AWS S3, Cloudflare R2, MinIO, etc.

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 client singleton
let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!process.env.S3_BUCKET_NAME) return null;
  
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      endpoint: process.env.S3_ENDPOINT, // For Cloudflare R2, MinIO
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      } : undefined,
      // Force path style for MinIO and R2
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export async function generateUploadUrl(
  storageKey: string,
  contentType: string,
  expiresIn = 3600 // 1 hour
): Promise<string> {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 not configured');
  }

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: storageKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function generateDownloadUrl(
  storageKey: string,
  expiresIn = 3600
): Promise<string> {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 not configured');
  }

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: storageKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteFile(storageKey: string): Promise<void> {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: storageKey,
  });

  await client.send(command);
}
