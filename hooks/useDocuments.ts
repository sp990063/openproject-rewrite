// hooks/useDocuments.ts
//
// Document + folder read hooks, project-scoped (Phase 3+ pattern).
// Calls the pre-existing project-scoped API:
//   GET /api/projects/[projectId]/document-folders
//   GET /api/projects/[projectId]/documents
// (Plus the standalone /api/documents/folders/[id]/breadcrumb for nav.)
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
  parentId?: string | null,
): Promise<FolderContents> {
  // Project-scoped endpoint returns the full folder tree for the project;
  // we filter by parentId client-side to keep the contract simple.
  const res = await fetch(`/api/projects/${projectId}/document-folders`)
  if (!res.ok) throw new Error('Failed to fetch document folders')
  const all: FolderWithMeta[] = await res.json()
  const folders = parentId
    ? all.filter((f) => f.parent?.id === parentId)
    : all.filter((f) => !f.parent)
  return { folders, documents: [], parentFolder: null }
}

async function fetchDocumentFolderBreadcrumb(
  folderId: string,
): Promise<ProjectDocumentFolder[]> {
  // Breadcrumb is not in the project-scoped API; use the non-scoped
  // standalone endpoint (still auth-gated, no projectId required).
  const res = await fetch(`/api/documents/folders/${folderId}/breadcrumb`)
  if (!res.ok) throw new Error('Failed to fetch folder breadcrumb')
  return res.json()
}

async function fetchDocuments(
  projectId: string,
  folderId?: string | null,
): Promise<DocumentWithMeta[]> {
  const params = new URLSearchParams()
  if (folderId) params.set('folderId', folderId)
  const url = `/api/projects/${projectId}/documents${
    params.toString() ? `?${params}` : ''
  }`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useDocumentFolders(
  projectId: string | undefined,
  parentId?: string | null,
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

export function useDocuments(
  projectId: string | undefined,
  folderId?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.documents(projectId ?? '', folderId),
    queryFn: () => fetchDocuments(projectId!, folderId),
    enabled: !!projectId,
  })
}
