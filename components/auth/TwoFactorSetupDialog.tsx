// components/auth/TwoFactorSetupDialog.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface TwoFactorSetupDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function TwoFactorSetupDialog({ open, onClose, onSuccess }: TwoFactorSetupDialogProps) {
  const [method, setMethod] = useState<'totp' | null>(null)
  const [step, setStep] = useState<'select' | 'qr' | 'done'>('select')
  const [token, setToken] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const handleGenerate = async () => {
    setPending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Setup failed')
      setQrUri(data.uri)
      setSecret(data.secret)
      setBackupCodes(data.backupCodes ?? [])
      setStep('qr')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (token.length !== 6) return
    setPending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')
      setStep('done')
      onSuccess?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
  }

  return (
    <Modal open={open} onClose={onClose} title="Enable Two-Factor Authentication">
      <div className="p-4 space-y-4">
        {step === 'select' && (
          <>
            <p className="text-sm text-gray-600">Choose a 2FA method:</p>
            <Button
              onClick={() => { setMethod('totp'); handleGenerate() }}
              disabled={pending}
              className="w-full"
            >
              {pending ? 'Generating...' : 'Authenticator App (TOTP)'}
            </Button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </>
        )}

        {step === 'qr' && (
          <>
            <div className="text-center">
              <p className="text-sm mb-2">Scan with your authenticator app:</p>
              <div className="bg-gray-100 p-4 rounded inline-block text-xs font-mono">{secret ? 'QR Ready' : 'Loading...'}</div>
              <p className="text-xs text-gray-500 mt-1">Secret: <code>{secret}</code></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Verification Code</label>
              <Input
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                disabled={pending}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={token.length !== 6 || pending}>
                {pending ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button variant="ghost" onClick={() => setStep('select')}>Back</Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <p className="font-medium text-green-800">2FA Enabled!</p>
              <p className="text-sm text-green-700 mt-1">Save these backup codes:</p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {backupCodes.map((code, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <code className="bg-white px-2 py-1 rounded text-sm">{code}</code>
                    <button
                      onClick={() => handleCopyCode(code)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                      aria-label="Copy code"
                    >📋</button>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={onClose}>Done</Button>
          </>
        )}
      </div>
    </Modal>
  )
}
