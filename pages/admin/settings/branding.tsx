export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import Head from 'next/head'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useBranding, useUpdateBranding } from '@/hooks/use-branding'
import { Button, Input } from '@/components/ui'

export default function BrandingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { data: branding, isLoading } = useBranding()
  const updateBranding = useUpdateBranding()

  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#1E40AF')

  React.useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logoUrl || '')
      setPrimaryColor(branding.primaryColor)
    }
  }, [branding])

  // Redirect non-admins
  React.useEffect(() => {
    if (session && !session.user?.isSystemAdmin) {
      router.push('/dashboard')
    }
  }, [session, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateBranding.mutateAsync({
        logoUrl: logoUrl || null,
        primaryColor,
      })
      alert('Branding updated successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update branding')
    }
  }

  if (!session?.user?.isSystemAdmin) {
    return null
  }

  return (
    <AuthenticatedLayout>
      <Head>
        <title>Branding - Admin Settings</title>
      </Head>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Branding & Colors</h1>

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL
              </label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a URL to your custom logo image
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#1E40AF"
                  className="w-32 font-mono"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Hex color code (e.g., #1E40AF for blue)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <div
                className="p-4 rounded-lg border border-gray-200"
                style={{ backgroundColor: `${primaryColor}10`, borderColor: primaryColor }}
              >
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      OP
                    </div>
                  )}
                  <span className="font-bold text-gray-900">OpenProject</span>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded text-white text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Primary Button
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <Button type="submit" disabled={updateBranding.isPending}>
              {updateBranding.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </AuthenticatedLayout>
  )
}
