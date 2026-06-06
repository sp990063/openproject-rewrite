// components/feedback/EmptyState.tsx
// v2 design system — centered empty-state placeholder.
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional icon node (e.g. a lucide-react icon) rendered above the title. */
  icon?: React.ReactNode
  /** Required headline. */
  title: string
  /** Optional supporting copy. */
  description?: string
  /** Optional CTA node (typically one or more <Button> elements). */
  action?: React.ReactNode
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center',
          'py-12 px-6 text-center',
          'border border-dashed border-border-subtle rounded-lg',
          'bg-surface-raised',
          className,
        )}
        {...rest}
      >
        {icon ? (
          <div className="mb-4 text-text-muted" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h3 className="text-base font-semibold text-text-default">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-text-muted max-w-sm">{description}</p>
        ) : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    )
  },
)
EmptyState.displayName = 'EmptyState'
