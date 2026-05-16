// components/custom-fields/CustomFieldsForm.tsx
import React from 'react'
import { CustomFieldInput } from './CustomFieldInput'

interface CustomField {
  id: string
  name: string
  fieldFormat: string
  possibleValues: string[]
  defaultValue: string | null
  required: boolean
  searchable: boolean
  filterable: boolean
  editable: boolean
  visible: boolean
  entityType: string
}

interface CustomFieldsFormProps {
  fields: CustomField[]
  values: Record<string, string | boolean | string[]>
  onChange: (fieldId: string, value: string | boolean | string[]) => void
  errors?: Record<string, string>
}

export function CustomFieldsForm({ fields, values, onChange, errors = {} }: CustomFieldsFormProps) {
  if (fields.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Custom Fields</h3>
      <div className="grid grid-cols-1 gap-4">
        {fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            fieldFormat={field.fieldFormat}
            name={`customField_${field.id}`}
            label={field.name}
            value={values[field.id]}
            onChange={(val) => onChange(field.id, val)}
            required={field.required}
            possibleValues={field.possibleValues}
            error={errors[field.id]}
            helperText={
              !field.required && field.fieldFormat === 'list'
                ? 'Leave blank to not set any value'
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
