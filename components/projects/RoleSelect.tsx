// components/projects/RoleSelect.tsx
//
// Spec §5.4 — dropdown for picking a role when assigning / editing a
// project member. Wraps the design-system `Select` primitive so all
// existing Select styling / a11y carries through.
//
// Usage:
//   <RoleSelect
//     value={member.roleId}
//     onChange={(roleId) => updateRole.mutate({ memberId, roleId })}
//     disabled={!canManage}
//   />
//
// Behavior:
//   - Pulls the role list from `useRoles()` (TanStack Query, /api/roles)
//   - Maps each role to a `{ value, label }` option for the design-system
//     `Select` (which takes `options: { value, label }[]`)
//   - Shows a loading placeholder while the query is in-flight, and
//     an empty-state placeholder if the query resolves empty (should
//     not happen — seed always inserts at least 3 roles)
import React from 'react'
import { Select } from '@/components/ui'
import { useRoles } from '@/hooks/useRoles'

interface RoleSelectProps {
  /** Current roleId (Phase 1 Member.roleId FK pattern). */
  value: string
  /** Called with the new roleId when the user picks a different role. */
  onChange: (roleId: string) => void
  /** Disables interaction (e.g. when the user lacks `members.manage`). */
  disabled?: boolean
  /** Optional override for the "in flight" / "empty" placeholder labels. */
  loadingLabel?: string
  emptyLabel?: string
  /** Optional className passthrough for layout (e.g. w-48). */
  className?: string
  /** ARIA label for screen readers (defaults to "Role"). */
  ariaLabel?: string
}

export function RoleSelect({
  value,
  onChange,
  disabled = false,
  loadingLabel = 'Loading roles…',
  emptyLabel = 'No roles available',
  className,
  ariaLabel = 'Role',
}: RoleSelectProps) {
  const { data: roles, isLoading } = useRoles()

  if (isLoading) {
    return (
      <Select
        disabled
        aria-label={ariaLabel}
        className={className}
        value=""
        onChange={() => {
          /* no-op: disabled */
        }}
        options={[{ value: '', label: loadingLabel }]}
      />
    )
  }

  if (!roles || roles.length === 0) {
    return (
      <Select
        disabled
        aria-label={ariaLabel}
        className={className}
        value=""
        onChange={() => {
          /* no-op: disabled */
        }}
        options={[{ value: '', label: emptyLabel }]}
      />
    )
  }

  // Map Role[] → Select's { value, label }[] shape
  const options = roles.map((role) => ({ value: role.id, label: role.name }))

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      options={options}
    />
  )
}
