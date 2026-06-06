// components/ui/Badge.tsx
// v2 design system — Semantic Badge variants (spec §8.6)
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
    'text-xs font-medium leading-none',
    'transition-colors duration-fast ease-out',
  ],
  {
    variants: {
      variant: {
        // Semantic
        info: 'bg-info-100 text-info-700 border-transparent',
        success: 'bg-success-100 text-success-700 border-transparent',
        warning: 'bg-warning-100 text-warning-700 border-transparent',
        error: 'bg-error-100 text-error-700 border-transparent',

        // Neutral
        default: 'bg-slate-100 text-slate-700 border-transparent',
        outline: 'bg-transparent text-text-default border-border-default',
        primary: 'bg-primary-100 text-primary-700 border-transparent',

        // Status (work-package + project) — per spec §3.8
        'status-new':
          'bg-status-new-bg text-status-new border-transparent',
        'status-in-progress':
          'bg-status-in-progress-bg text-status-in-progress border-transparent',
        'status-in-review':
          'bg-status-in-review-bg text-status-in-review border-transparent',
        'status-done':
          'bg-status-done-bg text-status-done border-transparent',
        'status-closed':
          'bg-status-closed-bg text-status-closed border-transparent',
        'status-on-hold':
          'bg-status-on-hold-bg text-status-on-hold border-transparent',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {leftIcon && <span className="[&_svg]:size-3">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="[&_svg]:size-3">{rightIcon}</span>}
      </span>
    )
  }
)
Badge.displayName = 'Badge'

export { badgeVariants }
