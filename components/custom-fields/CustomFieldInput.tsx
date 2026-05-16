// components/custom-fields/CustomFieldInput.tsx
import React from 'react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface CustomFieldInputProps {
  fieldFormat: string
  name: string
  label: string
  value?: string | boolean | string[]
  onChange: (value: string | string[] | boolean) => void
  required?: boolean
  possibleValues?: string[]
  error?: string
  helperText?: string
}

export function CustomFieldInput({
  fieldFormat,
  name,
  label,
  value,
  onChange,
  required,
  possibleValues = [],
  error,
  helperText,
}: CustomFieldInputProps) {
  switch (fieldFormat) {
    case 'bool':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={name}
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={name} className="text-sm text-gray-700">
            {label}
          </label>
        </div>
      )

    case 'list':
      return (
        <Select
          label={label}
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          helperText={helperText}
        >
          <option value="">Select...</option>
          {possibleValues.map((val) => (
            <option key={val} value={val}>
              {val}
            </option>
          ))}
        </Select>
      )

    case 'int':
      return (
        <Input
          type="number"
          label={label}
          name={name}
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          error={error}
          helperText={helperText}
        />
      )

    case 'float':
      return (
        <Input
          type="number"
          step="any"
          label={label}
          name={name}
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          error={error}
          helperText={helperText}
        />
      )

    case 'date':
      return (
        <Input
          type="date"
          label={label}
          name={name}
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          error={error}
          helperText={helperText}
        />
      )

    case 'string':
    case 'user':
    case 'version':
    default:
      return (
        <Input
          type="text"
          label={label}
          name={name}
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          error={error}
          helperText={helperText}
        />
      )
  }
}
