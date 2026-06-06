// components/feedback/Skeleton.tsx
// v2 design system — loading placeholder primitive.
// Polymorphic over `as`; supports variants for the common loading patterns
// called out in the revamp-v2 design spec (text lines, avatars, cards,
// table rows, generic rectangles).
import * as React from 'react'
import { cn } from '@/lib/utils'

export type SkeletonVariant =
  | 'text'
  | 'circle'
  | 'rect'
  | 'card'
  | 'table-row'
  | 'avatar'

export interface SkeletonProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Visual variant. Default: 'text'. */
  variant?: SkeletonVariant
  /** Number of stacked text lines to render (only used with variant='text'). */
  lines?: number
  /** Element to render. Default: 'div'. */
  as?: React.ElementType
}

/** Per-variant shape classes. Width is overridable via `className`. */
const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  circle: 'rounded-full aspect-square',
  rect: 'h-32',
  card: 'h-48',
  'table-row': 'h-10',
  avatar: 'w-10 h-10 rounded-full',
}

/** Default widths to keep the placeholder visually balanced. */
const variantDefaultWidth: Record<SkeletonVariant, string> = {
  text: 'w-3/4',
  circle: 'w-12',
  rect: 'w-full',
  card: 'w-full',
  'table-row': 'w-full',
  avatar: '',
}

const baseClasses =
  // Skeleton base color has no semantic equivalent yet; slate-200/700 is the
  // canonical "loading placeholder" tone. Dark mode flips to slate-700 for
  // a slightly lighter silhouette against the dark surface.
  'bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md block'

/**
 * A loading placeholder. Renders a single block by default; for
 * `variant="text"` set `lines` to render a stacked group of text rows.
 */
export const Skeleton = React.forwardRef<HTMLElement, SkeletonProps>(
  (
    { variant = 'text', lines = 1, className, as: Component = 'div', ...rest },
    ref,
  ) => {
    const shapeCls = cn(baseClasses, variantClasses[variant])

    if (variant === 'text' && lines > 1) {
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="flex flex-col gap-2"
        >
          {Array.from({ length: lines }).map((_, i) => (
            <Component
              key={i}
              ref={i === 0 ? (ref as React.Ref<HTMLElement>) : undefined}
              className={cn(
                shapeCls,
                // Last line shorter to mimic real text rhythm.
                i === lines - 1 ? 'w-1/2' : variantDefaultWidth[variant],
                className,
              )}
              {...rest}
            />
          ))}
        </div>
      )
    }

    return (
      <Component
        ref={ref as React.Ref<HTMLElement>}
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn(
          shapeCls,
          variantDefaultWidth[variant],
          className,
        )}
        {...rest}
      />
    )
  },
)
Skeleton.displayName = 'Skeleton'
