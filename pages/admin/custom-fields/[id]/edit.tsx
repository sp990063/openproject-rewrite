export const dynamic = 'force-dynamic'

import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const FIELD_FORMATS = ['string', 'int', 'float', 'bool', 'date', 'list', 'user', 'version']
const ENTITY_TYPES = ['WorkPackage', 'Project', 'User']

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

export default function CustomFieldEditPage() {
  const router = useRouter()
  const { id } = router.query
  const isNew = id === 'new'

  const [form, setForm] = useState({
    name: '',
    fieldFormat: 'string',
    possibleValues: [] as string[],
    possibleValuesText: '',
    defaultValue: '',
    required: false,
    searchable: false,
    filterable: false,
    editable: true,
    visible: true,
    entityType: 'WorkPackage',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['custom-field', id],
    queryFn: () => fetch(`/api/custom-fields/${id}`).then((r) => r.json()),
    enabled: !isNew && !!id,
  })

  // Populate form when data loads
  if (data?.field && !form.name) {
    const f = data.field as CustomField
    setForm({
      name: f.name,
      fieldFormat: f.fieldFormat,
      possibleValues: f.possibleValues || [],
      possibleValuesText: (f.possibleValues || []).join('\n'),
      defaultValue: f.defaultValue ?? '',
      required: f.required,
      searchable: f.searchable,
      filterable: f.filterable,
      editable: f.editable,
      visible: f.visible,
      entityType: f.entityType,
    })
  }

  const createMut = useMutation({
    mutationFn: (payload: typeof form) => {
      const data = {
        ...payload,
        possibleValues: (payload.possibleValuesText || '')
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
      }
      return fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json())
    },
    onSuccess: (res) => {
      if (!res.error) {
        router.push('/admin/custom-fields')
      }
    },
  })

  const updateMut = useMutation({
    mutationFn: (payload: typeof form) => {
      const data = {
        ...payload,
        possibleValues: (payload.possibleValuesText || '')
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
      }
      return fetch(`/api/custom-fields/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json())
    },
    onSuccess: (res) => {
      if (!res.error) {
        router.push('/admin/custom-fields')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isNew) {
      createMut.mutate(form)
    } else {
      updateMut.mutate(form)
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{isNew ? 'New Custom Field' : 'Edit Custom Field'} — Admin</title>
      </Head>
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{isNew ? 'New Custom Field' : 'Edit Custom Field'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Field Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g., Customer Priority"
              />
              <Select
                label="Entity Type"
                value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}
              >
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Field Format"
                value={form.fieldFormat}
                onChange={(e) => setForm({ ...form, fieldFormat: e.target.value })}
              >
                {FIELD_FORMATS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                  </option>
                ))}
              </Select>
              <Input
                label="Default Value"
                value={form.defaultValue}
                onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                placeholder="Optional default value"
              />
            </div>

            {form.fieldFormat === 'list' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Possible Values (one per line)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  value={form.possibleValuesText}
                  onChange={(e) => setForm({ ...form, possibleValuesText: e.target.value })}
                  placeholder="Option A&#10;Option B&#10;Option C"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter one value per line for list-type fields.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-medium">Field Options</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Required</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.searchable}
                  onChange={(e) => setForm({ ...form, searchable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Searchable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.filterable}
                  onChange={(e) => setForm({ ...form, filterable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Filterable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.editable}
                  onChange={(e) => setForm({ ...form, editable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Editable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.visible}
                  onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Visible</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" isLoading={createMut.isPending || updateMut.isPending}>
              {isNew ? 'Create Custom Field' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/admin/custom-fields')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
