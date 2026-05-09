import { useQuery } from '@tanstack/react-query'
import type { ForumThread, ForumPost } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// Standalone response type (API shape with relations)
interface ThreadWithDetails {
  id: string
  forumId: string
  subject: string
  authorId: string
  isSticky: boolean
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  forum: { id: string; name: string }
  posts: (ForumPost & { author: { id: string; name: string; email?: string; avatarUrl?: string | null } })[]
  _count: { posts: number }
}

async function fetchForumThread(id: string): Promise<ThreadWithDetails> {
  const res = await fetch(`/api/forums/threads/${id}`)
  if (!res.ok) throw new Error('Failed to fetch forum thread')
  return res.json()
}

export function useForumThread(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forumThread(id ?? ''),
    queryFn: () => fetchForumThread(id!),
    enabled: !!id,
  })
}

// Separate hook for just thread metadata (lighter query)
async function fetchForumThreadMeta(id: string): Promise<ForumThread> {
  const res = await fetch(`/api/forums/threads/${id}/meta`)
  if (!res.ok) throw new Error('Failed to fetch thread metadata')
  return res.json()
}

export function useForumThreadMeta(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forumThread(id ?? ''),
    queryFn: () => fetchForumThreadMeta(id!),
    enabled: !!id,
  })
}
