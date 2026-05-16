import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

export interface WatchStatus {
  isWatching: boolean
  count: number
}

async function fetchWatchStatus(workPackageId: string): Promise<WatchStatus> {
  const res = await fetch(`/api/work-packages/${workPackageId}/watch`)
  if (!res.ok) throw new Error('Failed to fetch watch status')
  return res.json()
}

async function watchWorkPackage(workPackageId: string): Promise<WatchStatus> {
  const res = await fetch(`/api/work-packages/${workPackageId}/watch`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to watch work package')
  return res.json()
}

async function unwatchWorkPackage(workPackageId: string): Promise<WatchStatus> {
  const res = await fetch(`/api/work-packages/${workPackageId}/watch`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to unwatch work package')
  return res.json()
}

/**
 * Hook to fetch and toggle watch status for a work package.
 * Provides { isWatching, count } and toggle function.
 */
export function useWatchWorkPackage(workPackageId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.workPackageWatchers(workPackageId ?? ''),
    queryFn: () => fetchWatchStatus(workPackageId!),
    enabled: !!workPackageId,
  })

  const watchMutation = useMutation({
    mutationFn: () => watchWorkPackage(workPackageId!),
    onSuccess: (data) => {
      if (workPackageId) {
        queryClient.setQueryData(queryKeys.workPackageWatchers(workPackageId), data)
      }
    },
  })

  const unwatchMutation = useMutation({
    mutationFn: () => unwatchWorkPackage(workPackageId!),
    onSuccess: (data) => {
      if (workPackageId) {
        queryClient.setQueryData(queryKeys.workPackageWatchers(workPackageId), data)
      }
    },
  })

  const toggle = () => {
    if (query.data?.isWatching) {
      unwatchMutation.mutate()
    } else {
      watchMutation.mutate()
    }
  }

  return {
    isWatching: query.data?.isWatching ?? false,
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isToggling: watchMutation.isPending || unwatchMutation.isPending,
    toggle,
  }
}
