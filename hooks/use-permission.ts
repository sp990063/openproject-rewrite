// hooks/use-permission.ts
//
// Spec §4.4 — client-side permission check hook. Reads the current
// user's membership on a project (via `/api/projects/[id]/members/me`),
// then evaluates the requested permission against the role's
// `permissions` array (with `'*'` wildcard support via
// `hasProjectPermission`).
//
// Usage:
//   const canEdit = usePermission(projectId, 'project.edit')
//   const canManage = usePermission(projectId, 'members.manage')
//   if (!canManage) return <RoleGate role="admin">...</RoleGate>
//
// Returns `false` while loading or when the user is not a member.
import { useQuery } from '@tanstack/react-query'
import {
  hasProjectPermission,
  type ProjectPermission,
} from '@/lib/permissions/check'

interface MembershipResponse {
  success: true
  data: {
    id: string
    userId: string
    projectId: string
    role: {
      id: string
      name: string
      permissions: string[]
    }
  } | null
}

/**
 * Returns true when the current user is granted `permission` on the
 * given project. Always returns `false` while the query is loading,
 * when the user is not a member, or when the membership record has
 * not yet hydrated.
 */
export function usePermission(
  projectId: string | undefined,
  permission: ProjectPermission,
): boolean {
  const { data } = useQuery({
    queryKey: ['projects', projectId, 'membership'],
    queryFn: async (): Promise<MembershipResponse['data']> => {
      const res = await fetch(`/api/projects/${projectId}/members/me`)
      if (!res.ok) throw new Error('Failed to fetch membership')
      const json = (await res.json()) as MembershipResponse
      return json.data
    },
    enabled: !!projectId,
    // Membership is project-scoped and rarely changes mid-session.
    // Keep the cache warm for 30s so multiple `usePermission` calls
    // for the same project don't each refetch.
    staleTime: 30_000,
  })

  if (!data?.role?.permissions) return false
  return hasProjectPermission(data.role.permissions, permission)
}
