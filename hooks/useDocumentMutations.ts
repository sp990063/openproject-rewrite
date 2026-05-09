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
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create document')
  return res.json()
}

async function updateDocument(
  id: string,
  data: UpdateDocumentInput
): Promise<ProjectDocument> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update document')
  return res.json()
}

async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete document')
}

export function useCreateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDocument,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolders(variables.projectId, variables.folderId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents(variables.projectId),
      })
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentInput }) =>
      updateDocument(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents(variables.id),
      })
      void queryClient.invalidateQueries({
        queryKey: ['documents'],
      })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// ─── Folder mutations ─────────────────────────────────────────────────────────

async function createFolder(data: CreateFolderInput): Promise<ProjectDocumentFolder> {
  const res = await fetch('/api/documents/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  return res.json()
}

async function updateFolder(
  id: string,
  data: UpdateFolderInput
): Promise<ProjectDocumentFolder> {
  const res = await fetch(`/api/documents/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update folder')
  return res.json()
}

async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/documents/folders/${id}`, { method: 'DELETE' })
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
      void queryClient.invalidateQueries({
        queryKey: ['document-folders'],
      })
    },
  })
}

export function useUpdateFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFolderInput }) =>
      updateFolder(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentFolderBreadcrumb(variables.id),
      })
      void queryClient.invalidateQueries({
        queryKey: ['document-folders'],
      })
    },
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-folders'] })
    },
  })
}
