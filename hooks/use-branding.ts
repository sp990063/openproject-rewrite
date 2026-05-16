import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type Branding = {
  id: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  updatedAt: string
}

export function useBranding() {
  return useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: async () => {
      const res = await fetch('/api/admin/branding')
      if (!res.ok) throw new Error('Failed to fetch branding')
      return res.json()
    },
  })
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { logoUrl?: string | null; faviconUrl?: string | null; primaryColor?: string }) => {
      const res = await fetch('/api/admin/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update branding')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
  })
}
