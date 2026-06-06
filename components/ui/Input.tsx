// components/ui/Input.tsx
// v2 design system — Input with error/success states (spec §8.5)
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-raised text-text-default placeholder:text-text-subtle',
    'h-10 px-3 py-2 text-sm',
    'transition-colors duration-fast ease-out',
    'focus-ring',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-sunken',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-default',
  ],
  {
    variants: {
      state: {
        default: 'border-border-default focus:border-border-focus',
        error:
          'border-error text-error-700 placeholder:text-error-600/60 focus:border-error',
        success:
          'border-success-600 text-text-default focus:border-success',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-10 px-3 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'md',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  success?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      success,
      helperText,
      leftIcon,
      rightIcon,
      size,
      state: stateProp,
      id,
      ...props
    },
    ref
  ) => {
    const auto = React.useId()
    const inputId = id || auto
    const state = error ? 'error' : success ? 'success' : (stateProp ?? 'default')
    const message = error || success || helperText
    const messageTone =
      state === 'error'
        ? 'text-error-700'
        : state === 'success'
        ? 'text-success-700'
        : 'text-text-muted'

    const input = (
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-subtle [&_svg]:size-4">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={state === 'error' || undefined}
          aria-describedby={message ? `${inputId}-msg` : undefined}
          className={cn(
            inputVariants({ state, size }),
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-text-subtle [&_svg]:size-4">
            {rightIcon}
          </span>
        )}
      </div>
    )

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-default"
          >
            {label}
          </label>
        )}
        {input}
        {message && (
          <p
            id={`${inputId}-msg`}
            role={state === 'error' ? 'alert' : undefined}
            className={cn('text-xs', messageTone)}
          >
            {message}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { inputVariants }
