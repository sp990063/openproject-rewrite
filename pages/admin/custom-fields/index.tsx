export const dynamic = 'force-dynamic'
// pages/admin/custom-fields/index.tsx
import Head from 'next/head'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'

interface CustomField {
  id: string
  name: string
  fieldFormat: string
  entityType: string
  required: boolean
  searchable: boolean
  filterable: boolean
  createdAt: string
}

export default function CustomFieldsListPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => fetch('/api/custom-fields').then((r) => r.json()),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/custom-fields/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  })

  const fields: CustomField[] = data?.fields ?? []

  const formatBadge = (format: string) => {
    const colors: Record<string, string> = {
      string: 'bg-gray-100 text-gray-800',
      int: 'bg-blue-100 text-blue-800',
      float: 'bg-cyan-100 text-cyan-800',
      bool: 'bg-purple-100 text-purple-800',
      date: 'bg-yellow-100 text-yellow-800',
      list: 'bg-green-100 text-green-800',
      user: 'bg-indigo-100 text-indigo-800',
      version: 'bg-orange-100 text-orange-800',
    }
    return (
      <Badge className={colors[format] || 'bg-gray-100 text-gray-800'}>
        {format}
      </Badge>
    )
  }

  return (
    <>
      <Head>
        <title>Custom Fields — Admin</title>
      </Head>
      <div className="container mx-auto max-w-6xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Custom Fields</h1>
          <Link href="/admin/custom-fields/new">
            <Button>+ New Custom Field</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No custom fields configured yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>{formatBadge(field.fieldFormat)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{field.entityType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {field.required && <Badge variant="danger">Required</Badge>}
                      {field.searchable && <Badge variant="secondary">Searchable</Badge>}
                      {field.filterable && <Badge variant="secondary">Filterable</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/admin/custom-fields/${field.id}`}>
                        <Button size="sm" variant="secondary">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (confirm(`Delete "${field.name}"?`)) {
                            deleteMut.mutate(field.id)
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
