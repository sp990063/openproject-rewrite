import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

// Response type for news list API
interface NewsListResponse {
  news: NewsItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface NewsItem {
  id: string
  projectId: string
  authorId: string
  title: string
  slug: string
  summary: string | null
  content: string
  createdAt: Date | string
  updatedAt: Date | string
  author: {
    id: string
    name: string
    email?: string
    avatarUrl?: string | null
  }
}

async function fetchNewsList(projectId: string, page: number = 1, limit: number = 20): Promise<NewsListResponse> {
  const res = await fetch(`/api/projects/${projectId}/news?page=${page}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch news')
  return res.json()
}

async function fetchNewsItem(projectId: string, slug: string): Promise<{ news: NewsItem & { comments: NewsComment[] } }> {
  const res = await fetch(`/api/projects/${projectId}/news/${slug}`)
  if (!res.ok) throw new Error('Failed to fetch news')
  return res.json()
}

export function useNewsList(projectId: string | undefined, page: number = 1) {
  return useQuery({
    queryKey: queryKeys.newsList(projectId ?? '', page),
    queryFn: () => fetchNewsList(projectId!, page),
    enabled: !!projectId,
  })
}

export function useNewsItem(projectId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.newsItem(projectId ?? '', slug ?? ''),
    queryFn: () => fetchNewsItem(projectId!, slug!),
    enabled: !!projectId && !!slug,
  })
}

// NewsComment type
export interface NewsComment {
  id: string
  newsId: string
  authorId: string
  content: string
  createdAt: Date | string
  updatedAt: Date | string
  author: {
    id: string
    name: string
    email?: string
    avatarUrl?: string | null
  }
}
