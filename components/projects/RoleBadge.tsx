// components/projects/RoleBadge.tsx
//
// Spec §5.4 — read-only display of a role name as a pill / badge.
// Looks the role up in the `useRoles()` cache (TanStack Query) so
// the same cache is shared with `RoleSelect` — no extra /api/roles
// round-trip per badge render.
//
// Usage:
//   <RoleBadge roleId={member.roleId} />
//   <RoleBadge roleId={member.roleId} size="sm" />
//
// Visual style matches the design-system `Badge` primitive so role
// pills look the same as status / category pills elsewhere in the app.
import React from 'react'
import { Badge } from '@/components/ui'
import { useRoles } from '@/hooks/useRoles'

interface RoleBadgeProps {
  /** Role id (FK to the Role table). */
  roleId: string
  /** Visual size — defaults to `sm` to fit inline in member tables. */
  size?: 'sm' | 'md'
  /** Show a leading color dot for quick visual differentiation. */
  showDot?: boolean
}

const SIZE_CLASS: Record<NonNullable<RoleBadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
}

// Map role name → semantic color (Admin = warning, Member = primary,
// Viewer = neutral, anything else = default)
function pickRoleVariant(roleName: string): 'warning' | 'primary' | 'default' {
  const n = roleName.toLowerCase()
  if (n.includes('admin') || n.includes('owner')) return 'warning'
  if (n.includes('member') || n.includes('editor')) return 'primary'
  return 'default'
}

export function RoleBadge({ roleId, size = 'sm', showDot = false }: RoleBadgeProps) {
  const { data: roles } = useRoles()
  const role = roles?.find((r) => r.id === roleId)
  // Defensive fallback: if the role id doesn't resolve (deleted role
  // or stale cache), show the raw id rather than rendering nothing.
  const label = role?.name ?? roleId
  const variant = pickRoleVariant(label)

  return (
    <Badge variant={variant} className={SIZE_CLASS[size]}>
      {showDot && (
        <span
          aria-hidden
          className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
            variant === 'warning'
              ? 'bg-warning-600'
              : variant === 'primary'
                ? 'bg-primary-600'
                : 'bg-slate-400'
          }`}
        />
      )}
      {label}
    </Badge>
  )
}
