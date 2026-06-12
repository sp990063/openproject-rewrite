import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Forum, ForumThread, ForumPost, CreateForumInput, CreateThreadInput, CreatePostInput } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Forum mutations ─────────────────────────────────────────────────────────

async function createForum(data: CreateForumInput): Promise<Forum> {
  const res = await fetch(`/api/projects/${data.projectId}/forums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create forum')
  return res.json()
}

async function updateForum(projectId: string, forumId: string, id: string, data: Partial<CreateForumInput>): Promise<Forum> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update forum')
  return res.json()
}

async function deleteForum(projectId: string, forumId: string, id: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete forum')
}

export function useCreateForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createForum,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forums(variables.projectId) })
    },
  })
}

export function useUpdateForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id, data }: { projectId: string; forumId: string; id: string; data: Partial<CreateForumInput> }) =>
      updateForum(projectId, forumId, id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forum(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['forums'] })
    },
  })
}

export function useDeleteForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id }: { projectId: string; forumId: string; id: string }) =>
      deleteForum(projectId, forumId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forums'] })
    },
  })
}

// ─── Thread mutations ────────────────────────────────────────────────────────

async function createThread(data: CreateThreadInput): Promise<ForumThread> {
  const res = await fetch(`/api/projects/${data.projectId}/forums/${data.forumId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create thread')
  return res.json()
}

async function updateThread(
  projectId: string,
  forumId: string,
  id: string,
  data: { subject?: string; isSticky?: boolean; isLocked?: boolean }
): Promise<ForumThread> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}/threads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update thread')
  return res.json()
}

async function deleteThread(projectId: string, forumId: string, id: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}/threads/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete thread')
}

export function useCreateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createThread,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThreads(variables.forumId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.forum(variables.forumId) })
    },
  })
}

export function useUpdateThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id, data }: { projectId: string; forumId: string; id: string; data: { subject?: string; isSticky?: boolean; isLocked?: boolean } }) =>
      updateThread(projectId, forumId, id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.id) })
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id }: { projectId: string; forumId: string; id: string }) =>
      deleteThread(projectId, forumId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
    },
  })
}

// ─── Post mutations ─────────────────────────────────────────────────────────

async function createPost(data: CreatePostInput): Promise<ForumPost> {
  const res = await fetch(`/api/projects/${data.projectId}/forums/${data.forumId}/threads/${data.threadId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create post')
  return res.json()
}

async function updatePost(
  projectId: string,
  forumId: string,
  threadId: string,
  id: string,
  data: { content: string }
): Promise<ForumPost> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update post')
  return res.json()
}

async function deletePost(projectId: string, forumId: string, threadId: string, id: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/posts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete post')
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPost,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumPosts(variables.threadId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.threadId) })
    },
  })
}

export function useUpdatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, threadId, id, data }: { projectId: string; forumId: string; threadId: string; id: string; data: { content: string } }) =>
      updatePost(projectId, forumId, threadId, id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, threadId, id }: { projectId: string; forumId: string; threadId: string; id: string }) =>
      deletePost(projectId, forumId, threadId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
    },
  })
}

// ─── Lock/Unlock helpers ─────────────────────────────────────────────────────

export function useLockThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id }: { projectId: string; forumId: string; id: string }) =>
      updateThread(projectId, forumId, id, { isLocked: true }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.id) })
    },
  })
}

export function useUnlockThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, forumId, id }: { projectId: string; forumId: string; id: string }) =>
      updateThread(projectId, forumId, id, { isLocked: false }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.id) })
    },
  })
}

// ─── Pin/Unpin helpers ───────────────────────────────────────────────────────
//
// HS-8 fix: previously useUnpinThread was byte-identical to usePinThread —
// both POSTed to /pin with no body, so the server could not distinguish
// pin from unpin. The two endpoints now differ by a `?action=` query
// parameter, mirroring REST best-practice for action-only POST endpoints.

export function usePinThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, forumId, threadId }: { projectId: string; forumId: string; threadId: string }) => {
      const res = await fetch(
        `/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/pin?action=pin`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to pin thread')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.threadId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThreads(variables.forumId) })
    },
  })
}

export function useUnpinThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, forumId, threadId }: { projectId: string; forumId: string; threadId: string }) => {
      const res = await fetch(
        `/api/projects/${projectId}/forums/${forumId}/threads/${threadId}/pin?action=unpin`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to unpin thread')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.threadId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThreads(variables.forumId) })
    },
  })
}

// ─── Vote helper ─────────────────────────────────────────────────────────────

export function useVotePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, forumId, postId, threadId }: { projectId: string; forumId: string; postId: string; threadId: string }) => {
      const res = await fetch(
        `/api/projects/${projectId}/forums/${forumId}/posts/${postId}/vote`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error('Failed to vote')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumPosts(variables.threadId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.threadId) })
    },
  })
}
