// components/forms/index.ts
// Barrel export for the form-layer primitives built on top of
// `react-hook-form`, `@hookform/resolvers`, and the project's `components/ui`
// design system. Import from `@/components/forms` to get the full set.
export { FormField } from './FormField'
export type {
  FormFieldProps,
  FormFieldType,
  FormFieldOption,
} from './FormField'

export { FormSection } from './FormSection'
export type { FormSectionProps } from './FormSection'

export { FormError } from './FormError'
export type { FormErrorProps, FormErrorIssue } from './FormError'
