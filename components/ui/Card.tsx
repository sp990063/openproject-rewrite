// components/ui/Card.tsx
// v2 design system — Card with elevation variants (spec §8.4)
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  [
    'rounded-lg bg-raised text-text-default',
    'border border-border-subtle',
  ],
  {
    variants: {
      elevation: {
        none: 'shadow-none',
        xs:   'shadow-xs',
        sm:   'shadow-sm',
        md:   'shadow-md',
        lg:   'shadow-lg',
      },
      padding: {
        none: '',
        sm:   'p-3',
        md:   'p-6',
        lg:   'p-8',
      },
      interactive: {
        true: 'transition-shadow duration-base ease-out hover:shadow-md cursor-pointer',
      },
    },
    defaultVariants: {
      elevation: 'sm',
      padding: 'none',
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ elevation, padding, interactive }), className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

// ── Sub-components ─────────────────────────────────────────────────────────

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-4 border-b border-border-subtle flex flex-col gap-1.5',
      className
    )}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-tight text-text-default', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-text-muted', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-4 border-t border-border-subtle flex items-center justify-end gap-2',
      className
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { cardVariants }
