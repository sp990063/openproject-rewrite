// components/forms/FormSection.tsx
// Card-like section that groups form fields under a title and description.
// Built on top of the design-system Card primitive.
import * as React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui'
import { cn } from '@/lib/utils'

export interface FormSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Section title. */
  title?: React.ReactNode
  /** Section description, rendered under the title in a smaller font. */
  description?: React.ReactNode
  /** Form fields or any other content rendered in the body. */
  children: React.ReactNode
  /** Optional footer slot (typically action buttons). */
  footer?: React.ReactNode
  /** Extra classes applied to the underlying Card. */
  className?: string
  /** The HTML element used to render the outer wrapper. Defaults to `<section>`. */
  as?: 'section' | 'div' | 'article'
}

/**
 * A form section is a logical group of form fields. Renders as a Card with
 * header (title + description), body, and optional footer (for action buttons).
 */
export const FormSection = React.forwardRef<HTMLElement, FormSectionProps>(
  function FormSection(
    { title, description, children, footer, className, as: Tag = 'section', ...rest },
    ref
  ) {
    const TagComponent = Tag as React.ElementType
    return (
      <TagComponent
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn('block', className)}
        {...rest}
      >
        <Card elevation="sm" padding="none">
          {(title || description) && (
            <CardHeader>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
          )}
          <CardContent className="space-y-4">{children}</CardContent>
          {footer && <CardFooter>{footer}</CardFooter>}
        </Card>
      </TagComponent>
    )
  }
)

FormSection.displayName = 'FormSection'

export default FormSection
