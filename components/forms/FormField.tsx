// components/forms/FormField.tsx
// Typed wrapper around the design-system Input / Textarea / Select primitives
// that integrates with `react-hook-form` via the `Controller` component.
//
// Usage:
//   const { control } = useForm<FormValues>({ resolver: zodResolver(schema) })
//   <FormField
//     control={control}
//     name="email"
//     label="Email"
//     type="email"
//     description="We'll never share this with anyone."
//   />
import * as React from 'react'
import {
  Controller,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form'
import * as Label from '@radix-ui/react-label'
import { Input, Textarea, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

export type FormFieldType = 'text' | 'email' | 'number' | 'textarea' | 'select'

export interface FormFieldOption {
  value: string
  label: string
}

export interface FormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  /** react-hook-form control object from `useForm()`. */
  control: Control<TFieldValues>
  /** Field name as defined in the form schema. */
  name: FieldPath<TFieldValues>
  /** Visible label rendered above the input. */
  label?: string
  /** Helper text rendered below the input. */
  description?: string
  /** Placeholder for text-like inputs. */
  placeholder?: string
  /** Whether the field is required (renders an asterisk next to the label). */
  required?: boolean
  /** Disable the underlying control. */
  disabled?: boolean
  /** Extra classes applied to the outer wrapper. */
  className?: string
  /** Mark the input as read-only. */
  readOnly?: boolean
  /** Field variant. */
  type: FormFieldType
  /** Options for `type="select"`. */
  options?: FormFieldOption[]
}

/**
 * Internal non-generic rendering implementation. We expose a generic wrapper
 * component below that just casts to this; the generic is purely a typing
 * affordance for callers and is not part of the runtime identity.
 */
function FormFieldInner(
  props: FormFieldProps<FieldValues>,
  ref: React.Ref<HTMLDivElement>
) {
  const {
    control,
    name,
    label,
    description,
    placeholder,
    required,
    disabled,
    readOnly,
    className,
    type,
    options,
  } = props

  const fieldId = React.useId()
  const inputId = `${fieldId}-input`
  const descriptionId = description ? `${fieldId}-desc` : undefined
  const errorId = `${fieldId}-error`

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const { onChange, onBlur, value, ref: fieldRef } = field
        const errorMessage = fieldState.error?.message

        const ariaDescribedBy =
          [descriptionId, errorMessage ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined

        return (
          <div
            ref={ref}
            className={cn('w-full space-y-1.5', className)}
            data-form-field={String(name)}
          >
            {label && (
              <Label.Root
                htmlFor={inputId}
                className="block text-sm font-medium text-text-default"
              >
                {label}
                {required && (
                  <span aria-hidden="true" className="ml-0.5 text-error-700">
                    *
                  </span>
                )}
              </Label.Root>
            )}

            {description && (
              <p id={descriptionId} className="text-xs text-text-muted">
                {description}
              </p>
            )}

            {type === 'textarea' ? (
              <Textarea
                id={inputId}
                value={(value as string | undefined) ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                ref={fieldRef as React.Ref<HTMLTextAreaElement>}
                placeholder={placeholder}
                disabled={disabled}
                readOnly={readOnly}
                error={errorMessage}
                aria-invalid={errorMessage ? 'true' : undefined}
                aria-describedby={ariaDescribedBy}
              />
            ) : type === 'select' ? (
              <Select
                id={inputId}
                value={(value as string | undefined) ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                ref={fieldRef as React.Ref<HTMLSelectElement>}
                disabled={disabled}
                error={errorMessage}
                options={options ?? []}
                placeholder={placeholder}
                aria-invalid={errorMessage ? 'true' : undefined}
                aria-describedby={ariaDescribedBy}
              />
            ) : (
              <Input
                id={inputId}
                type={type}
                value={(value as string | number | undefined) ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                ref={fieldRef as React.Ref<HTMLInputElement>}
                placeholder={placeholder}
                disabled={disabled}
                readOnly={readOnly}
                error={errorMessage}
                aria-invalid={errorMessage ? 'true' : undefined}
                aria-describedby={ariaDescribedBy}
              />
            )}

            {errorMessage && (
              <p
                id={errorId}
                role="alert"
                className="text-xs text-error-700"
              >
                {errorMessage}
              </p>
            )}
          </div>
        )
      }}
    />
  )
}

interface FormFieldComponent {
  <TFieldValues extends FieldValues = FieldValues>(
    props: FormFieldProps<TFieldValues> & { ref?: React.Ref<HTMLDivElement> }
  ): React.ReactElement
}

const FormField = React.forwardRef(FormFieldInner) as unknown as FormFieldComponent

;(FormField as unknown as { displayName: string }).displayName = 'FormField'

export { FormField }
export default FormField
