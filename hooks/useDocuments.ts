import { useQuery } from '@tanstack/react-query'
import type { ProjectDocument, ProjectDocumentFolder } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Response types with relations (API shape) ────────────────────────────────

export type DocumentWithMeta = ProjectDocument & {
  author?: { id: string; name: string; email?: string; avatarUrl?: string | null }
  folder?: Pick<ProjectDocumentFolder, 'id' | 'name'> | null
}

export type FolderWithMeta = ProjectDocumentFolder & {
  _count?: { documents: number; children: number }
  author?: { id: string; name: string; email?: string; avatarUrl?: string | null }
  parent?: Pick<ProjectDocumentFolder, 'id' | 'name'> | null
}

export interface FolderContents {
  folders: FolderWithMeta[]
  documents: DocumentWithMeta[]
  parentFolder: Pick<ProjectDocumentFolder, 'id' | 'name'> | null
}

// ─── Fetch functions ─────────────────────────────────────────────────────────

async function fetchDocumentFolders(
  projectId: string,
  parentId?: string | null
): Promise<FolderContents> {
  const params = new URLSearchParams({ projectId })
  if (parentId) params.set('parentId', parentId)
  const res = await fetch(`/api/documents/folders?${params}`)
  if (!res.ok) throw new Error('Failed to fetch document folders')
  return res.json()
}

async function fetchDocumentFolderBreadcrumb(
  folderId: string
): Promise<ProjectDocumentFolder[]> {
  const res = await fetch(`/api/documents/folders/${folderId}/breadcrumb`)
  if (!res.ok) throw new Error('Failed to fetch folder breadcrumb')
  return res.json()
}

async function fetchDocuments(projectId: string): Promise<DocumentWithMeta[]> {
  const res = await fetch(`/api/documents?projectId=${projectId}`)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useDocumentFolders(
  projectId: string | undefined,
  parentId?: string | null
) {
  return useQuery({
    queryKey: queryKeys.documentFolders(projectId ?? '', parentId),
    queryFn: () => fetchDocumentFolders(projectId!, parentId),
    enabled: !!projectId,
  })
}

export function useDocumentFolderBreadcrumb(folderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documentFolderBreadcrumb(folderId ?? ''),
    queryFn: () => fetchDocumentFolderBreadcrumb(folderId!),
    enabled: !!folderId,
  })
}

export function useDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents(projectId ?? ''),
    queryFn: () => fetchDocuments(projectId!),
    enabled: !!projectId,
  })
}
