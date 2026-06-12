// scripts/screenshot-phase0.js
// Take 3 screenshots of the new vanilla SPA at different routes.
// Usage: node scripts/screenshot-phase0.js
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = '/tmp/phase0-screenshots'
fs.mkdirSync(OUT, { recursive: true })

const VITE = process.env.VITE_URL || 'http://127.0.0.1:5173'
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3001'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    console.log(`[browser ${msg.type()}]`, msg.text())
  })
  page.on('pageerror', (err) => console.error('[browser page error]', err.message, err.stack))
  page.on('requestfailed', (req) => console.error('[browser req fail]', req.url(), req.failure()?.errorText))

  // 1. Login via the backend (NextAuth) to set the session cookie
  console.log('1) Logging in via NextAuth at', BACKEND)
  // Use page.evaluate (runs in browser context with proper cookies) to login.
  // We go to BACKEND root first (fast) and then fetch in-page, rather than
  // navigating to /login (which can be slow on Next.js first compile).
  await page.goto(BACKEND + '/', { waitUntil: 'commit', timeout: 30000 })
  console.log('   landed on backend')
  const csrf = await page.evaluate(async (backend) => {
    const r = await fetch(backend + '/api/auth/csrf')
    return r.json()
  }, BACKEND)
  const csrfToken = csrf.csrfToken
  console.log('   csrf token len:', csrfToken?.length)

  const loginResult = await page.evaluate(async ({ backend, csrfToken }) => {
    const body = new URLSearchParams({
      csrfToken,
      email: 'demo@example.com',
      password: 'demo123',
      callbackUrl: backend + '/dashboard',
      redirect: 'false',
      json: 'true',
    })
    const r = await fetch(backend + '/api/auth/callback/credentials', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return { status: r.status, body: (await r.text()).slice(0, 200) }
  }, { backend: BACKEND, csrfToken })
  console.log('   login:', loginResult)

  const session = await page.evaluate(async (backend) => {
    const r = await fetch(backend + '/api/auth/session')
    return r.json()
  }, BACKEND)
  console.log('   session user:', session?.user?.email || 'NONE')

  // 2. Visit SPA — should boot shell, then redirect to /dashboard
  console.log('2) Visiting SPA at', VITE)
  await page.goto(VITE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(3000)  // let bootstrap + initial fetch settle
  const url1 = page.url()
  console.log('   landed at:', url1)
  await page.screenshot({ path: path.join(OUT, '01-spa-root.png'), fullPage: true })
  console.log('   shot 01-spa-root.png')

  // 3. Navigate to /dashboard
  console.log('3) Visiting /dashboard')
  await page.goto(VITE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(4000)  // let dashboard fetch + render
  await page.screenshot({ path: path.join(OUT, '02-dashboard.png'), fullPage: true })
  console.log('   shot 02-dashboard.png')

  // 4. Click a project link to test SPA nav
  console.log('4) Trying to click first sidebar project link')
  const firstProj = page.locator('.op-sidebar a[href^="/projects/"]').first()
  if (await firstProj.count() > 0) {
    const href = await firstProj.getAttribute('href')
    console.log('   clicking:', href)
    await firstProj.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(OUT, '03-project.png'), fullPage: true })
    console.log('   shot 03-project.png (URL:', page.url() + ')')
  } else {
    console.log('   no project link found, skipping')
  }

  // 5. Visit login (should redirect to Next.js login)
  console.log('5) Visit /login (Next.js route)')
  await page.goto(VITE + '/login', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(OUT, '04-login.png'), fullPage: true })
  console.log('   shot 04-login.png (URL:', page.url() + ')')

  // Done — print file sizes and force exit (Vite HMR SSE keeps process alive)
  await browser.close()
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png'))
  console.log('\n=== Screenshot summary ===')
  for (const f of files) {
    const st = fs.statSync(path.join(OUT, f))
    console.log(`  ${f}: ${st.size} bytes`)
  }
  console.log('Done.')
  process.exit(0)  // force exit — Vite HMR SSE keeps loop open
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
