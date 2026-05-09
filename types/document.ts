// ─── Phase 4: Document Types ───────────────────────────────────────────────────

import type { Project, User } from './index'

export interface ProjectDocument {
  id: string
  projectId: string
  title: string
  description: string | null
  folderId: string | null
  authorId: string
  createdAt: Date
  updatedAt: Date
  project?: Pick<Project, 'id' | 'name' | 'identifier'>
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  folder?: ProjectDocumentFolder | null
}

export interface ProjectDocumentFolder {
  id: string
  projectId: string
  name: string
  parentId: string | null
  createdAt: Date
  project?: Pick<Project, 'id' | 'name' | 'identifier'>
  parent?: ProjectDocumentFolder | null
  children?: ProjectDocumentFolder[]
  documents?: ProjectDocument[]
  _count?: { documents: number; children: number }
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  projectId: string
  title: string
  description?: string
  folderId?: string | null
  authorId: string
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  folderId?: string | null
}

export interface CreateFolderInput {
  projectId: string
  name: string
  parentId?: string | null
}

export interface UpdateFolderInput {
  name?: string
  parentId?: string | null
}
