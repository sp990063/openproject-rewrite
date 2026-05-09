// pages/settings/security.tsx — Security settings including 2FA management
import Head from 'next/head'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface User2FAStatus {
  totpEnabled: boolean
  backupCodesRemaining: number
}

export default function SecurityPage() {
  const qc = useQueryClient()
  const [setupStep, setSetupStep] = useState<'idle' | 'generating' | 'verifying' | 'done'>('idle')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  const { data: status } = useQuery({
    queryKey: ['user-2fa-status'],
    queryFn: () => fetch('/api/auth/2fa/status').then(r => r.json()),
  })

  const generateMut = useMutation({
    mutationFn: () => fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate' }),
    }).then(r => r.json()),
    onSuccess: (data) => {
      setSecret(data.secret)
      setQrCode(data.uri)
      setBackupCodes(data.backupCodes ?? [])
      setSetupStep('verifying')
    },
  })

  const enableMut = useMutation({
    mutationFn: (token: string) => fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable', token }),
    }).then(r => r.json()),
    onSuccess: () => {
      setSetupStep('done')
      qc.invalidateQueries({ queryKey: ['user-2fa-status'] })
    },
  })

  const disableMut = useMutation({
    mutationFn: () => fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    }).then(r => r.json()),
    onSuccess: () => {
      setSetupStep('idle')
      setQrCode('')
      setSecret('')
      setBackupCodes([])
      qc.invalidateQueries({ queryKey: ['user-2fa-status'] })
    },
  })

  const userStatus: User2FAStatus = status ?? { totpEnabled: false, backupCodesRemaining: 0 }

  return (
    <>
      <Head><title>Security Settings</title></Head>
      <div className="container mx-auto max-w-2xl py-8">
        <h1 className="text-2xl font-bold mb-6">Security Settings</h1>

        {/* 2FA Card */}
        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Authenticator App (TOTP)</p>
                  <p className="text-sm text-gray-500">
                    {userStatus.totpEnabled
                      ? `Enabled — ${userStatus.backupCodesRemaining} backup codes remaining`
                      : 'Not enabled'}
                  </p>
                </div>
                <Badge variant={userStatus.totpEnabled ? 'success' : 'warning'}>
                  {userStatus.totpEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {!userStatus.totpEnabled && setupStep === 'idle' && (
                <Button onClick={() => { generateMut.mutate(); setSetupStep('generating') }}>
                  Enable 2FA
                </Button>
              )}

              {(setupStep === 'generating' || setupStep === 'verifying') && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded text-sm">
                    <p className="font-medium mb-2">Scan this QR code with your authenticator app:</p>
                    {qrCode && <div className="bg-white p-2 rounded inline-block">{secret ? 'QR Code Ready' : 'Loading...'}</div>}
                    <p className="mt-2 text-gray-600">Or enter this secret manually: <code className="bg-gray-100 px-1 rounded">{secret}</code></p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Verification Code</label>
                    <Input
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => enableMut.mutate(token)}
                      disabled={enableMut.isPending || token.length !== 6}
                    >
                      {enableMut.isPending ? 'Verifying...' : 'Verify and Enable'}
                    </Button>
                    <Button variant="ghost" onClick={() => setSetupStep('idle')}>Cancel</Button>
                  </div>
                </div>
              )}

              {setupStep === 'done' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 p-4 rounded">
                    <p className="font-medium text-green-800">2FA Enabled Successfully!</p>
                    <p className="text-sm text-green-700 mt-1">Save these backup codes in a safe place:</p>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {backupCodes.map((code, i) => (
                        <code key={i} className="bg-white px-2 py-1 rounded text-sm">{code}</code>
                      ))}
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => disableMut.mutate()}>
                    Disable 2FA
                  </Button>
                </div>
              )}

              {userStatus.totpEnabled && setupStep === 'idle' && (
                <Button variant="danger" onClick={() => disableMut.mutate()}>
                  Disable 2FA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
