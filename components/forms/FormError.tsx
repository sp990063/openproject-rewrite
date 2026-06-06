// components/forms/FormError.tsx
// Renders a Zod error (or any error with a `.issues` array) as a list of
// validation issues. Useful for displaying top-level / form-wide errors that
// aren't bound to a specific field.
import * as React from 'react'
import type { $ZodIssue } from 'zod/v4/core'
import { cn } from '@/lib/utils'

export interface FormErrorIssue {
  /** The path to the field that failed validation. */
  path?: ReadonlyArray<PropertyKey>
  /** The human-readable error message. */
  message: string
}

export interface FormErrorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Anything with an `issues` array (ZodError, Zod 4's `$ZodError`, or our
   * loose `FormErrorIssue[]`). When `null`/`undefined`/empty, nothing renders.
   */
  error?:
    | { issues: ReadonlyArray<FormErrorIssue | $ZodIssue> }
    | ReadonlyArray<FormErrorIssue | $ZodIssue>
    | null
  /** Title rendered above the issue list. Defaults to "Please fix the following errors". */
  title?: React.ReactNode
}

/**
 * Display a list of validation issues returned by a Zod resolver.
 * Tolerant of both Zod 3 (`ZodError.issues`) and Zod 4 (`$ZodError.issues`)
 * shapes. Issues are deduplicated by message.
 */
export const FormError = React.forwardRef<HTMLDivElement, FormErrorProps>(
  function FormError({ error, title, className, ...rest }, ref) {
    const issues = React.useMemo<{ path: PropertyKey[]; message: string }[]>(() => {
      if (!error) return []
      const issuesArr: ReadonlyArray<FormErrorIssue | $ZodIssue> = Array.isArray(error)
        ? (error as ReadonlyArray<FormErrorIssue | $ZodIssue>)
        : (error as { issues: ReadonlyArray<FormErrorIssue | $ZodIssue> }).issues
      if (!issuesArr || issuesArr.length === 0) return []
      return issuesArr.map((issue: FormErrorIssue | $ZodIssue) => ({
        path: ((issue as FormErrorIssue).path ?? (issue as $ZodIssue).path ?? []) as PropertyKey[],
        message:
          (issue as FormErrorIssue).message ?? (issue as $ZodIssue).message ?? '',
      }))
    }, [error])

    if (issues.length === 0) return null

    const seen = new Set<string>()
    const deduped = issues.filter((i: { path: PropertyKey[]; message: string }) => {
      const key = `${i.path.join('.')}:${i.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'rounded-md border border-error bg-error/5 px-4 py-3 text-sm text-error-700',
          className
        )}
        {...rest}
      >
        <p className="font-medium">
          {title ?? 'Please fix the following errors:'}
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {deduped.map((issue: { path: PropertyKey[]; message: string }, idx: number) => {
            const fieldPath: Array<string | number> = []
            for (const p of issue.path) {
              if (typeof p === 'string' || typeof p === 'number') {
                fieldPath.push(p)
              }
            }
            return (
              <li key={`${fieldPath.join('.')}-${idx}`}>
                {fieldPath.length > 0 && (
                  <span className="font-mono text-xs text-error-700/80">
                    {fieldPath.join('.')}:{' '}
                  </span>
                )}
                {issue.message}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
)

FormError.displayName = 'FormError'

export default FormError
