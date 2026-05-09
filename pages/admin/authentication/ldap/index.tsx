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

  return (
    <>
      <Head><title>LDAP Authentication — Admin</title></Head>
      <div className="container mx-auto max-w-4xl py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">LDAP Authentication</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Server'}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader><CardTitle>New LDAP Server</CardTitle></CardHeader>
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
                <Button onClick={() => createMut.mutate(form)}>Create Server</Button>
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
                    onClick={() => testMut.mutate(server.id)}>
                    {testMut.isPending ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button size="sm" variant="secondary"
                    onClick={() => syncMut.mutate(server.id)}>
                    {syncMut.isPending ? 'Syncing...' : 'Sync Users'}
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
