// hooks/useForum.ts
//
// Fetch a single forum + its thread list. Project-scoped URL
// (Phase 3+ pattern: `/api/projects/[projectId]/forums/[forumId]`).
// Requires both `projectId` and `forumId` because the project-scoped
// endpoint verifies the forum belongs to the given project.
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

// Standalone response type (API shape with relations)
export interface ForumThreadSummary {
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

export interface ForumWithRelations {
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

async function fetchForum(
  projectId: string,
  forumId: string,
): Promise<ForumWithRelations> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}`)
  if (!res.ok) throw new Error('Failed to fetch forum')
  return res.json()
}

export function useForum(
  projectId: string | undefined,
  forumId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.forum(forumId ?? ''),
    queryFn: () => fetchForum(projectId!, forumId!),
    enabled: !!projectId && !!forumId,
  })
}
