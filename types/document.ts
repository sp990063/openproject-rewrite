// ─── Phase 4: Document Types ────────────────────────────────────────────────────

export interface Document {
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
  folder?: DocumentFolder | null
}

export interface DocumentFolder {
  id: string
  projectId: string
  name: string
  parentId: string | null
  createdAt: Date
  parent?: DocumentFolder | null
  children?: DocumentFolder[]
  documents?: Document[]
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  projectId: string
  title: string
  description?: string
  folderId?: string
  authorId: string
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  folderId?: string | null
}

export interface CreateDocumentFolderInput {
  projectId: string
  name: string
  parentId?: string
}

export interface UpdateDocumentFolderInput {
  name?: string
  parentId?: string | null
}

// ─── Shared picks ────────────────────────────────────────────────────────────

type User = {
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
}

type Project = {
  id: string
  name: string
  identifier: string
}
