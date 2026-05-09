// types/file-storage.ts
// Phase 6: File storage types for S3-compatible object storage

export interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  storageKey: string;
  contentType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  // Populated
  project?: { id: string; name: string };
  uploadedBy?: { id: string; name: string };
}

export interface UploadUrlResponse {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
}

export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
] as const;

export function isAllowedContentType(type: string): boolean {
  return ALLOWED_CONTENT_TYPES.includes(type as any);
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
