import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

// Standalone response type (API shape with relations)
interface ForumThreadSummary {
  id: string
  forumId: string
  subject: string
  authorId: string
  isSticky: boolean
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  _count: { posts: number }
}

interface ForumWithRelations {
  id: string
  projectId: string
  name: string
  description: string | null
  authorId: string
  createdAt: Date
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  project: { id: string; name: string; identifier: string }
  threads: ForumThreadSummary[]
  _count: { threads: number }
}

async function fetchForum(id: string): Promise<ForumWithRelations> {
  const res = await fetch(`/api/forums/${id}`)
  if (!res.ok) throw new Error('Failed to fetch forum')
  return res.json()
}

export function useForum(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forum(id ?? ''),
    queryFn: () => fetchForum(id!),
    enabled: !!id,
  })
}
