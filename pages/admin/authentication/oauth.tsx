export const dynamic = 'force-dynamic'
// pages/admin/authentication/oauth.tsx
import Head from 'next/head'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function OAuthAdminPage() {
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['oauth-settings'],
    queryFn: () => fetch('/api/settings/oauth').then((r) => r.json()),
  })

  // Populate form when data loads
  if (data && !googleClientId && !googleClientSecret) {
    setGoogleClientId(data.googleClientId ?? '')
    setGoogleClientSecret(data.googleClientSecret ?? '')
  }

  const saveMut = useMutation({
    mutationFn: (payload: { googleClientId: string; googleClientSecret: string }) =>
      fetch('/api/settings/oauth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => refetch(),
  })

  const handleSave = () => {
    saveMut.mutate({ googleClientId, googleClientSecret })
  }

  const isConfigured = data?.isConfigured

  return (
    <>
      <Head>
        <title>OAuth Authentication — Admin</title>
      </Head>
      <div className="container mx-auto max-w-4xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">OAuth Authentication</h1>
          <p className="text-gray-500 mt-1">
            Configure OAuth providers for single sign-on (SSO).
          </p>
        </div>

        <div className="space-y-6">
          {/* Google OAuth */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Google OAuth</CardTitle>
                {isConfigured ? (
                  <Badge variant="success">Configured</Badge>
                ) : (
                  <Badge variant="warning">Not Configured</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Client ID"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="your-client-id.apps.googleusercontent.com"
                />
                <Input
                  label="Client Secret"
                  type="password"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="Your Google OAuth client secret"
                />
              </div>

              {saveMut.isSuccess && (
                <p className="text-sm text-green-600">Settings saved successfully!</p>
              )}
              {saveMut.isError && (
                <p className="text-sm text-red-600">Failed to save settings.</p>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} isLoading={saveMut.isPending}>
                  Save Google OAuth Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Get Google OAuth Credentials</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>
                  Go to the{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Google Cloud Console
                  </a>
                </li>
                <li>Create a new project or select an existing one.</li>
                <li>Navigate to "APIs & Services" &gt; "Credentials".</li>
                <li>Click "Create Credentials" &gt; "OAuth client ID".</li>
                <li>Set the application type to "Web application".</li>
                <li>
                  Add your callback URL to "Authorized redirect URIs":
                  <code className="block bg-gray-100 rounded px-2 py-1 mt-1 text-xs">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/google
                  </code>
                </li>
                <li>Copy the "Client ID" and "Client Secret" and paste them above.</li>
                <li>
                  Enable the "Google+ API" in "APIs & Services" &gt; "Library".
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Google OAuth:</span>
                {isConfigured ? (
                  <>
                    <Badge variant="success">Enabled</Badge>
                    <span className="text-sm text-gray-500">
                      Users can sign in with Google
                    </span>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary">Disabled</Badge>
                    <span className="text-sm text-gray-500">
                      Not configured — only email/password login available
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
