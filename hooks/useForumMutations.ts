import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Forum, ForumThread, ForumPost, CreateForumInput, CreateThreadInput, CreatePostInput } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Forum mutations ─────────────────────────────────────────────────────────

async function createForum(data: CreateForumInput): Promise<Forum> {
  const res = await fetch('/api/forums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create forum')
  return res.json()
}

async function updateForum(id: string, data: Partial<CreateForumInput>): Promise<Forum> {
  const res = await fetch(`/api/forums/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update forum')
  return res.json()
}

async function deleteForum(id: string): Promise<void> {
  const res = await fetch(`/api/forums/${id}`, { method: 'DELETE' })
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateForumInput> }) =>
      updateForum(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forum(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['forums'] })
    },
  })
}

export function useDeleteForum() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteForum,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forums'] })
    },
  })
}

// ─── Thread mutations ────────────────────────────────────────────────────────

async function createThread(data: CreateThreadInput): Promise<ForumThread> {
  const res = await fetch('/api/forums/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create thread')
  return res.json()
}

async function updateThread(
  id: string,
  data: { subject?: string; isSticky?: boolean; isLocked?: boolean }
): Promise<ForumThread> {
  const res = await fetch(`/api/forums/threads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update thread')
  return res.json()
}

async function deleteThread(id: string): Promise<void> {
  const res = await fetch(`/api/forums/threads/${id}`, { method: 'DELETE' })
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
    mutationFn: ({ id, data }: { id: string; data: { subject?: string; isSticky?: boolean; isLocked?: boolean } }) =>
      updateThread(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(variables.id) })
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteThread,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
    },
  })
}

// ─── Post mutations ─────────────────────────────────────────────────────────

async function createPost(data: CreatePostInput): Promise<ForumPost> {
  const res = await fetch('/api/forums/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create post')
  return res.json()
}

async function updatePost(id: string, data: { content: string }): Promise<ForumPost> {
  const res = await fetch(`/api/forums/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update post')
  return res.json()
}

async function deletePost(id: string): Promise<void> {
  const res = await fetch(`/api/forums/posts/${id}`, { method: 'DELETE' })
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
    mutationFn: ({ id, data }: { id: string; data: { content: string } }) => updatePost(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
    },
  })
}

// ─── Lock/Unlock helpers ─────────────────────────────────────────────────────

export function useLockThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => updateThread(id, { isLocked: true }),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(id) })
    },
  })
}

export function useUnlockThread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => updateThread(id, { isLocked: false }),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forumThread(id) })
    },
  })
}
