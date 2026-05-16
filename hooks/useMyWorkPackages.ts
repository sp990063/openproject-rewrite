import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './use-current-user'

export function useMyWorkPackages() {
  const { user } = useCurrentUser()

  return useQuery({
    queryKey: ['work-packages', 'my'],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch(`/api/work-packages?assignedToId=${(user as any).id}&status=open`)
      if (!res.ok) throw new Error('Failed to fetch work packages')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })
}
