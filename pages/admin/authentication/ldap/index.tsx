export const dynamic = 'force-dynamic'
// pages/admin/authentication/ldap/index.tsx
import Head from 'next/head'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface LdapServer {
  id: string; name: string; url: string; port: number
  baseDn: string; bindDn?: string; useTLS: boolean; mappings: any[]
}

export default function LdapAdminPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', url: '', port: '389', baseDn: '',
    bindDn: '', bindPassword: '', useTLS: false,
  })

  const { data } = useQuery({
    queryKey: ['ldap-servers'],
    queryFn: () => fetch('/api/ldap/servers').then(r => r.json()),
  })
  const servers: LdapServer[] = data?.servers ?? []

  const createMut = useMutation({
    mutationFn: (payload: any) =>
      fetch('/api/ldap/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-servers'] }); setShowForm(false) },
  })

  const testMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ldap/servers/${id}/test`, { method: 'POST' }).then(r => r.json()),
  })

  const syncMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ldap/servers/${id}/sync`, { method: 'POST' }).then(r => r.json()),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ldap/servers/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-servers'] }); setEditingId(null) },
  })

  const handleEdit = (server: LdapServer) => {
    setEditingId(server.id)
    setForm({
      name: server.name,
      url: server.url,
      port: String(server.port),
      baseDn: server.baseDn,
      bindDn: server.bindDn ?? '',
      bindPassword: '',
      useTLS: server.useTLS,
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this LDAP server?')) {
      deleteMut.mutate(id)
    }
  }

  const handleSubmit = () => {
    const payload = { ...form, port: parseInt(form.port, 10) }
    if (editingId) {
      updateMut.mutate({ id: editingId, payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      fetch(`/api/ldap/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-servers'] }); setEditingId(null); setShowForm(false) },
  })

  return (
    <>
      <Head><title>LDAP Authentication — Admin</title></Head>
      <div className="container mx-auto max-w-4xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">LDAP Authentication</h1>
          <Button onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null) }}>
            {showForm ? 'Cancel' : '+ Add Server'}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader><CardTitle>{editingId ? 'Edit LDAP Server' : 'New LDAP Server'}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Corporate LDAP" />
                <Input label="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="ldap://ldap.example.com" />
                <Input label="Port" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} />
                <Input label="Base DN" value={form.baseDn} onChange={e => setForm({ ...form, baseDn: e.target.value })} placeholder="dc=example,dc=com" />
                <Input label="Bind DN" value={form.bindDn} onChange={e => setForm({ ...form, bindDn: e.target.value })} placeholder="cn=admin,dc=example,dc=com" />
                <Input label="Bind Password" type="password" value={form.bindPassword} onChange={e => setForm({ ...form, bindPassword: e.target.value })} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSubmit}>{editingId ? 'Update Server' : 'Create Server'}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {servers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No LDAP servers configured. Add one to get started.
          </div>
        )}

        {servers.map(server => (
          <Card key={server.id} className="mb-4">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{server.name}</h3>
                  <p className="text-sm text-gray-500">{server.url}:{server.port} — {server.baseDn}</p>
                  <Badge variant={server.useTLS ? 'success' : 'warning'}>
                    {server.useTLS ? 'TLS' : 'Plain'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary"
                    onClick={() => handleEdit(server)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => testMut.mutate(server.id)}>
                    {testMut.isPending ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => syncMut.mutate(server.id)}>
                    {syncMut.isPending ? 'Syncing...' : 'Sync Users'}
                  </Button>
                  <Button size="sm" variant="danger"
                    onClick={() => handleDelete(server.id)}>
                    {deleteMut.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
