// ─── Phase 4: Forum Types ────────────────────────────────────────────────────

import type { Project, User } from './index'

export interface Forum {
  id: string
  projectId: string
  name: string
  description: string | null
  authorId: string
  createdAt: Date
  project?: Pick<Project, 'id' | 'name' | 'identifier'>
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  threads?: ForumThread[]
  _count?: { threads: number }
}

export interface ForumThread {
  id: string
  forumId: string
  subject: string
  authorId: string
  isSticky: boolean
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  forum?: Forum
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  posts?: ForumPost[]
  _count?: { posts: number }
}

export interface ForumPost {
  id: string
  threadId: string
  content: string
  authorId: string
  createdAt: Date
  updatedAt: Date
  thread?: ForumThread
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateForumInput {
  projectId: string
  name: string
  description?: string
  authorId: string
}

export interface UpdateForumInput {
  name?: string
  description?: string
}

export interface CreateThreadInput {
  forumId: string
  subject: string
  authorId: string
  isSticky?: boolean
  isLocked?: boolean
}

export interface UpdateThreadInput {
  subject?: string
  isSticky?: boolean
  isLocked?: boolean
}

export interface CreatePostInput {
  threadId: string
  content: string
  authorId: string
}

export interface UpdatePostInput {
  content: string
}


