// components/ui/Button.tsx
// v2 design system — CVA-driven variants per design spec §8.1
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base — shared across every variant.
  [
    'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap',
    'rounded-md select-none',
    'transition-colors duration-fast ease-out',
    'focus-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-text-onPrimary hover:bg-primary-700 active:bg-primary-800 shadow-xs',
        secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 border border-border-subtle',
        outline:
          'bg-transparent text-slate-900 border border-border-default hover:bg-slate-100 active:bg-slate-200',
        ghost:
          'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
        destructive:
          'bg-error text-text-onPrimary hover:bg-error-700 active:bg-red-800 shadow-xs',
        link:
          'bg-transparent text-primary-700 hover:text-primary-800 hover:underline underline-offset-4 px-0 py-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { buttonVariants }
