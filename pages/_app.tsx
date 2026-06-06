// pages/_app.tsx
// Wraps the app with QueryClient, NextAuth Session, the v2 ThemeProvider,
// and the nuqs NuqsAdapter (Pages Router adapter — see nuqs/adapters/next/pages).
import '@/styles/globals.css'
import { SessionProvider } from 'next-auth/react'
import type { AppProps } from 'next/app'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/components/theme-provider'
import { NuqsAdapter } from 'nuqs/adapters/next/pages'

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <SessionProvider session={session}>
          <ThemeProvider defaultTheme="system" storageKey="op-rewrite-theme">
            <Component {...pageProps} />
          </ThemeProvider>
        </SessionProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  )
}
