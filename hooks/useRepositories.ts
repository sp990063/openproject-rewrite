import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

interface Repository {
  id: string
  projectId: string
  type: string
  name: string
  url: string | null
  localPath: string | null
  createdAt: Date
}

interface Commit {
  id: string
  repositoryId: string
  sha: string
  message: string
  authorName: string
  authorEmail: string
  committedAt: Date
}

interface GitTreeEntry {
  name: string
  type: 'blob' | 'tree'
  path: string
  sha: string
}

async function fetchRepositories(projectId: string): Promise<Repository[]> {
  const res = await fetch(`/api/projects/${projectId}/repository`)
  if (!res.ok) throw new Error('Failed to fetch repositories')
  const data = await res.json()
  return data.repositories
}

export function useRepositories(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.repositories(projectId ?? ''),
    queryFn: () => fetchRepositories(projectId!),
    enabled: !!projectId,
  })
}

async function fetchCommits(projectId: string, repoId: string, limit = 50): Promise<Commit[]> {
  const res = await fetch(`/api/projects/${projectId}/repository/${repoId}/commits?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch commits')
  const data = await res.json()
  return data.commits
}

export function useRepositoryCommits(projectId: string | undefined, repoId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: queryKeys.repositoryCommits(projectId ?? '', repoId ?? ''),
    queryFn: () => fetchCommits(projectId!, repoId!, limit),
    enabled: !!projectId && !!repoId,
  })
}

async function fetchTree(projectId: string, repoId: string, sha = 'HEAD'): Promise<GitTreeEntry[]> {
  const res = await fetch(`/api/projects/${projectId}/repository/${repoId}/tree?sha=${sha}`)
  if (!res.ok) throw new Error('Failed to fetch tree')
  const data = await res.json()
  return data.tree
}

export function useRepositoryTree(projectId: string | undefined, repoId: string | undefined, sha = 'HEAD') {
  return useQuery({
    queryKey: queryKeys.repositoryTree(projectId ?? '', repoId ?? ''),
    queryFn: () => fetchTree(projectId!, repoId!, sha),
    enabled: !!projectId && !!repoId,
  })
}
