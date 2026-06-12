// hooks/useDocumentMutations.ts
//
// Document + folder mutations, project-scoped (Phase 3+ pattern).
// Calls:
//   POST   /api/projects/[projectId]/documents
//   PATCH  /api/projects/[projectId]/documents/[id]
//   DELETE /api/projects/[projectId]/documents/[id]
//   POST   /api/projects/[projectId]/document-folders
//   PATCH  /api/projects/[projectId]/document-folders/[id]
//   DELETE /api/projects/[projectId]/document-folders/[id]
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ProjectDocument,
  ProjectDocumentFolder,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateFolderInput,
  UpdateFolderInput,
} from '@/types/document'
import { queryKeys } from '@/queries/queryKeys'

// ─── Document mutations ───────────────────────────────────────────────────────

async function createDocument(data: CreateDocumentInput): Promise<ProjectDocument> {
  const { projectId, ...body } = data
  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create document')
  return res.json()
}

async function updateDocument(
  projectId: string,
  id: string,
  data: UpdateDocumentInput,
): Promise<ProjectDocument> {
  const res = await fetch(`/api/projects/${projectId}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update document')
  return res.json()
}

async function deleteDocument(
  projectId: string,
  id: string,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/documents/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete document')
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDocument,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents(variables.projectId, variables.folderId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolders(variables.projectId, variables.folderId),
      })
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, id, data }: { projectId: string; id: string; data: UpdateDocumentInput }) =>
      updateDocument(projectId, id, data),
    onSuccess: (data, variables) => {
      // HS-13 + HS-10 fix: prefer the server-confirmed folderId, fall back
      // to the input folderId. Then do a broad prefix invalidation to
      // catch any folder-scoped list that might also display this doc.
      const folderId = data?.folderId ?? (variables as { folderId?: string | null }).folderId
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents(variables.projectId, folderId ?? null),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolders(variables.projectId, folderId ?? null),
      })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      deleteDocument(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// ─── Folder mutations ─────────────────────────────────────────────────────────

async function createFolder(data: CreateFolderInput): Promise<ProjectDocumentFolder> {
  const { projectId, ...body } = data
  const res = await fetch(`/api/projects/${projectId}/document-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  return res.json()
}

async function updateFolder(
  projectId: string,
  id: string,
  data: UpdateFolderInput,
): Promise<ProjectDocumentFolder> {
  const res = await fetch(`/api/projects/${projectId}/document-folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update folder')
  return res.json()
}

async function deleteFolder(
  projectId: string,
  id: string,
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/document-folders/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete folder')
}

export function useCreateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createFolder,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolders(variables.projectId, variables.parentId),
      })
      void queryClient.invalidateQueries({ queryKey: ['document-folders'] })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, id, data }: { projectId: string; id: string; data: UpdateFolderInput }) =>
      updateFolder(projectId, id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolderBreadcrumb(variables.id),
      })
      void queryClient.invalidateQueries({ queryKey: ['document-folders'] })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: string }) =>
      deleteFolder(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-folders'] })
    },
  })
}
